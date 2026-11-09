import { NextRequest, after } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { UNTRUSTED_RULE, untrusted } from "@/lib/prompt-safety";
import { requireAuth, AuthError, unauthorizedResponse } from "@/lib/api-auth";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { adminDeductCredits, adminRefundCredits } from "@/lib/firebase/admin-credits";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import { enforceRateLimit } from "@/lib/rate-limit";
import { marketingPlanSchema, parseBody } from "@/lib/validation";
import { collectResponseText } from "@/lib/kie-text";
import { notify, projectHref } from "@/lib/notify";

export const runtime = "nodejs";
// Hobby + Fluid Compute caps at 300s. Generation is reasoning-heavy and can
// legitimately take several minutes — this is the longest window available
// on the current plan.
export const maxDuration = 300;

const CREDIT_COST = CREDIT_COSTS.MARKETING_PLAN;

const SYSTEM_PROMPT = `You are an expert marketing strategist specializing in MENA (Middle East and North Africa) e-commerce. You understand the unique cultural dynamics, consumer behaviors, and digital ecosystems of markets including Saudi Arabia, UAE, Egypt, Morocco, Kuwait, Bahrain, Qatar, Oman, Jordan, Lebanon, and Tunisia.

Your expertise covers:
- MENA consumer psychology, cultural sensitivities, and regional purchasing patterns
- High-performing digital advertising platforms in the region: Meta (Facebook/Instagram), TikTok, Snapchat, Google Ads
- Influencer marketing landscape across the Gulf, Levant, and North Africa
- Seasonal strategies: Ramadan, Eid, White Friday, and National Day campaigns
- Bilingual marketing (Arabic/English) and RTL content considerations
- Regional e-commerce platforms: Noon, Amazon.ae, Namshi, Jumia, Zid, Salla
- Performance benchmarks: CPA, ROAS, CPM, CTR specific to MENA markets
- Payment preferences: cash-on-delivery (COD) in Egypt and Morocco vs. card payments in Gulf states
- Shipping and logistics nuances by country

Generate comprehensive, actionable, data-driven marketing plans tailored to the specific MENA country and product. Always structure plans with clear sections, specific platforms and tactics, budget recommendations, and measurable goals aligned with the given performance targets.`;

interface ProjectInput {
  id: string;
  name: string;
  description: string;
  country: string;
  emoji: string;
  productImageUrl?: string;
}

function buildPrompt(project: ProjectInput): string {
  return `Generate a comprehensive marketing plan for this e-commerce product:

${UNTRUSTED_RULE}

Product: ${project.emoji} ${untrusted("name", project.name, 200)}
Description: ${project.description ? untrusted("description", project.description) : "Not provided"}
Target Market: ${project.country}

Structure your plan with these sections:
1. Market & Audience Analysis (${project.country}-specific insights)
2. Marketing Channels & Budget Allocation
3. Content & Creative Strategy
4. Campaign Phases (Awareness → Testing → Scaling)
5. Key Performance Indicators & Benchmarks
6. 30-Day Action Plan (prioritized quick wins)

Be specific: name exact platforms, ad formats, audience segments, and realistic budget splits.
IMPORTANT: At the very start of each section below, embed the corresponding JSON data block BEFORE any narrative text. Use real data — no placeholders.

--- Section 1: Market & Audience Analysis ---
\`\`\`json:market-analysis
{"stats":{"market_size":"","audience_size":"","growth_rate":"","competition":"Low|Medium|High"},"demographics":{"ages":[{"label":"13-17","pct":0},{"label":"18-24","pct":0},{"label":"25-34","pct":0},{"label":"35-44","pct":0},{"label":"45+","pct":0}],"gender":{"label_a":"Women","pct_a":0,"label_b":"Men","pct_b":0}},"regions":[{"name":"","priority":"Primary|Secondary|Tertiary","pct":0}],"platforms":[{"name":"","score":0}],"segments":[{"name":"","size":"","traits":["",""]}]}
\`\`\`
Rules: age pct sum=100, region pct sum=100, platform score 0-100, 3-5 platforms, 2-4 segments.

--- Section 2: Marketing Channels & Budget Allocation ---
\`\`\`json:channels
{"total_budget":"","channels":[{"name":"","budget_pct":0,"formats":[""],"expected_roas":"","primary":false}]}
\`\`\`
Rules: budget_pct sum=100, exactly one channel has primary:true, 3-5 channels.

--- Section 3: Content & Creative Strategy ---
\`\`\`json:content
{"tone":"","pillars":[{"name":"","pct":0,"description":""}],"formats":[{"type":"","platforms":[""],"frequency":"","score":0}],"hooks":["","",""]}
\`\`\`
Rules: pillar pct sum=100, format score 0-100, 3-5 pillars, 3-5 formats, exactly 3 hooks.

--- Section 4: Campaign Phases ---
\`\`\`json:phases
{"phases":[{"name":"","duration":"","budget_pct":0,"objective":"","tactics":["","",""],"success_kpi":""}]}
\`\`\`
Rules: budget_pct sum=100, exactly 3 phases (Awareness, Testing, Scaling), 3 tactics each.

--- Section 5: Key Performance Indicators & Benchmarks ---
\`\`\`json:kpi
{"primary_metrics":[{"name":"","target":"","benchmark":"","description":"","lower_is_better":true}],"secondary_metrics":[{"name":"","target":"","benchmark":"","lower_is_better":false}]}
\`\`\`
Rules: exactly 2 primary metrics (CPA then ROAS), 4-6 secondary metrics (CTR, CPM, Add-to-Cart Rate, Conversion Rate, etc).

--- Section 6: 30-Day Action Plan ---
\`\`\`json:action
{"weeks":[{"label":"Week 1","focus":"","tasks":[{"task":"","priority":"high","owner":""}]}]}
\`\`\`
Rules: exactly 4 weeks, 3-5 tasks each, priority must be exactly "high", "medium", or "low".`;
}

function parseBlock(fullText: string, slug: string): unknown {
  const re = new RegExp("```json:" + slug + "\\n([\\s\\S]*?)```");
  const m = fullText.match(re);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

/** Plan block slug (as written in the prompt) → key in planVisualData / planDraft. */
const BLOCKS = {
  "market-analysis": "market",
  channels: "channels",
  content: "content",
  phases: "phases",
  kpi: "kpi",
  action: "action",
} as const;

async function runGeneration(uid: string, project: ProjectInput): Promise<void> {
  const db = getAdminFirestore();
  const projectRef = db.collection("users").doc(uid).collection("projects").doc(project.id);

  try {
    const apiKey = process.env.KIE_AI_API_KEY;
    if (!apiKey) throw new Error("KIE_AI_API_KEY is not configured");

    // Publish each section to `planDraft` the moment its JSON block is complete, so the
    // project page can show the plan filling in while it is still being written.
    const emitted = new Set<string>();
    let writes: Promise<unknown> = Promise.resolve();
    const onText = (text: string, delta: string) => {
      if (!delta.includes("`")) return; // a block can only complete on a code fence
      for (const [slug, key] of Object.entries(BLOCKS)) {
        if (emitted.has(slug)) continue;
        const value = parseBlock(text, slug);
        if (value === null) continue;
        emitted.add(slug);
        writes = writes
          .then(() => projectRef.update({ [`planDraft.${key}`]: value }))
          .catch(() => { /* draft is best-effort; the final write below is authoritative */ });
      }
    };

    const fullText = await collectResponseText(apiKey, {
      system: SYSTEM_PROMPT,
      user: buildPrompt(project),
      imageUrl: project.productImageUrl,
      effort: "medium",
      onText,
    });
    await writes;
    const planVisualData: Record<string, unknown> = {
      market:   parseBlock(fullText, "market-analysis"),
      channels: parseBlock(fullText, "channels"),
      content:  parseBlock(fullText, "content"),
      phases:   parseBlock(fullText, "phases"),
      kpi:      parseBlock(fullText, "kpi"),
      action:   parseBlock(fullText, "action"),
    };
    const cleanedData = Object.fromEntries(
      Object.entries(planVisualData).filter(([, v]) => v !== null)
    );

    await projectRef.update({
      marketingPlan: fullText,
      planVisualData: cleanedData,
      status: "active",
      marketingPlanStatus: "done",
      marketingPlanError: null,
      planDraft: FieldValue.delete(),
      lastActivity: new Date(),
    });
    await notify(uid, {
      id: `plan-ready-${project.id}-${Date.now()}`,
      type: "plan_ready",
      title: "Your marketing plan is ready",
      body: `The plan for “${project.name}” is finished. Pick an angle to start on creatives.`,
      href: projectHref(project.id),
    });
  } catch (err) {
    console.error(`[marketing-plan] generation failed for project ${project.id}:`, err);
    await adminRefundCredits(uid, CREDIT_COST).catch(() => console.error("[marketing-plan] refund failed"));
    await projectRef.update({
      marketingPlanStatus: "failed",
      marketingPlanError: err instanceof Error ? err.message : "Something went wrong",
      planDraft: FieldValue.delete(),
    }).catch(() => { /* project may have been deleted mid-generation */ });
    await notify(uid, {
      id: `plan-failed-${project.id}-${Date.now()}`,
      type: "generation_failed",
      title: "Marketing plan failed",
      body: `We couldn’t finish the plan for “${project.name}”. Your ${CREDIT_COST} credits were refunded.`,
      href: projectHref(project.id),
    });
  }
}

export async function POST(request: NextRequest) {
  let uid: string;
  try { uid = await requireAuth(request); } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse();
    throw e;
  }

  if (!process.env.KIE_AI_API_KEY) {
    return new Response("KIE_AI_API_KEY is not configured", { status: 500 });
  }

  const limited = await enforceRateLimit(uid, "generate");
  if (limited) return limited;

  const parsed = await parseBody(request, marketingPlanSchema);
  if (!parsed.ok) return parsed.response;
  const project: ProjectInput = parsed.data.project;

  const deduction = await adminDeductCredits(uid, CREDIT_COST);
  if (!deduction.success) {
    return Response.json(
      { error: "insufficient_credits", required: CREDIT_COST, balance: deduction.balance },
      { status: 402 }
    );
  }

  const db = getAdminFirestore();
  try {
    await db.collection("users").doc(uid).collection("projects").doc(project.id).update({
      marketingPlanStatus: "generating",
      marketingPlanError: null,
      planDraft: {},
    });
  } catch {
    // Project missing / write failed — don't keep the credits.
    await adminRefundCredits(uid, CREDIT_COST).catch(() => console.error("[marketing-plan] refund failed"));
    return new Response("Project not found", { status: 404 });
  }

  // Runs after the response is sent; on Vercel with Fluid Compute this keeps
  // executing (up to maxDuration) even if the client disconnects.
  after(() => runGeneration(uid, project));

  return Response.json({ status: "started" });
}
