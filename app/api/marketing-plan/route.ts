import { NextRequest } from "next/server";
import { requireAuth, AuthError, unauthorizedResponse } from "@/lib/api-auth";

const KIE_AI_API = "https://api.kie.ai/codex/v1/responses";

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

export async function POST(request: NextRequest) {
  try { await requireAuth(request); } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse();
    throw e;
  }

  const apiKey = process.env.KIE_AI_API_KEY;
  if (!apiKey) {
    return new Response("KIE_AI_API_KEY is not configured", { status: 500 });
  }

  let project: {
    name: string;
    description: string;
    country: string;
    targetCpa: number;
    targetRoas: number;
    emoji: string;
    productImageUrl?: string;
  };

  try {
    const body = await request.json();
    project = body.project;
  } catch {
    return new Response("Invalid request body", { status: 400 });
  }

  if (!project?.name || !project?.country) {
    return new Response("Missing required project fields", { status: 400 });
  }

  const upstream = await fetch(KIE_AI_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5-5",
      stream: true,
      reasoning: { effort: "high" },
      input: [
        {
          role: "developer",
          content: [{ type: "input_text", text: SYSTEM_PROMPT }],
        },
        {
          role: "user",
          content: [
            ...(project.productImageUrl
              ? [{ type: "input_image" as const, image_url: project.productImageUrl }]
              : []),
            {
              type: "input_text",
              text: `Generate a comprehensive marketing plan for this e-commerce product:

Product: ${project.emoji} ${project.name}
Description: ${project.description || "Not provided"}
Target Market: ${project.country}
Performance Targets: CPA ≤ $${project.targetCpa} | ROAS ≥ ${project.targetRoas}x

Structure your plan with these sections:
1. Market & Audience Analysis (${project.country}-specific insights)
2. Marketing Channels & Budget Allocation
3. Content & Creative Strategy
4. Campaign Phases (Awareness → Testing → Scaling)
5. Key Performance Indicators & Benchmarks
6. 30-Day Action Plan (prioritized quick wins)

Be specific: name exact platforms, ad formats, audience segments, and realistic budget splits. Align all recommendations with the CPA and ROAS targets.

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
Rules: exactly 4 weeks, 3-5 tasks each, priority must be exactly "high", "medium", or "low".`,
            },
          ],
        },
      ],
    }),
  });

  if (!upstream.ok) {
    const errText = await upstream.text();
    return new Response(`API error: ${errText}`, { status: upstream.status });
  }

  if (!upstream.body) {
    return new Response("Empty response from API", { status: 502 });
  }

  const encoder = new TextEncoder();
  const upstreamReader = upstream.body.getReader();

  const stream = new ReadableStream({
    async start(controller) {
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = "";
      let lastHeartbeat = Date.now();

      try {
        while (true) {
          const { done, value } = await upstreamReader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("event:")) {
              currentEvent = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              const dataStr = line.slice(5).trim();
              if (dataStr === "[DONE]") {
                controller.close();
                return;
              }
              if (currentEvent === "response.output_text.delta") {
                try {
                  const parsed = JSON.parse(dataStr) as { delta?: string };
                  if (parsed.delta) {
                    controller.enqueue(encoder.encode(parsed.delta));
                    lastHeartbeat = Date.now();
                  }
                } catch {
                  // skip malformed JSON
                }
              }
            } else if (line === "") {
              currentEvent = "";
            }
          }

          // Send heartbeat comment every 5s of inactivity to keep connection alive
          if (Date.now() - lastHeartbeat > 5000) {
            controller.enqueue(encoder.encode(": heartbeat\n"));
            lastHeartbeat = Date.now();
          }
        }
      } catch (err) {
        controller.error(err);
      } finally {
        upstreamReader.releaseLock();
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
