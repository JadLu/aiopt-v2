import { NextRequest } from "next/server";
import { UNTRUSTED_RULE, untrusted } from "@/lib/prompt-safety";
import { requireAuth, AuthError, unauthorizedResponse } from "@/lib/api-auth";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { adminDeductCredits, adminRefundCredits } from "@/lib/firebase/admin-credits";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import { enforceRateLimit } from "@/lib/rate-limit";
import { regenerateAngleSchema, angleSchema, parseBody } from "@/lib/validation";
import { collectResponseText } from "@/lib/kie-text";

export const runtime = "nodejs";
export const maxDuration = 120;

const COST = CREDIT_COSTS.ANGLE;

const SYSTEM_PROMPT = `You are an expert direct-response marketing strategist for MENA e-commerce. You write marketing angles: distinct audience segments a product can be sold to, each with the reasons it should convert.
Reply with ONE JSON object and nothing else (no markdown fence, no commentary):
{"name":"","size":"","traits":["","",""]}
- name: a short, specific audience/angle name.
- size: a short size or reach estimate (e.g. "~2.1M people").
- traits: exactly 3 short sentences about who they are, what they care about and why this product converts for them.
Write in the same language as the existing angles you are shown.`;

interface Segment {
  name: string;
  size?: string;
  traits?: string[];
  starred?: boolean;
}

/** Pulls the first {...} object out of a model reply. */
function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}

export async function POST(request: NextRequest) {
  let uid: string;
  try { uid = await requireAuth(request); } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse();
    throw e;
  }

  const apiKey = process.env.KIE_AI_API_KEY;
  if (!apiKey) return new Response("KIE_AI_API_KEY is not configured", { status: 500 });

  const limited = await enforceRateLimit(uid, "generate");
  if (limited) return limited;

  const parsed = await parseBody(request, regenerateAngleSchema);
  if (!parsed.ok) return parsed.response;
  const { projectId, index, name } = parsed.data;

  // Read the project (and the angle being replaced) from the server's own copy, never from the client.
  const db = getAdminFirestore();
  const ref = db.collection("users").doc(uid).collection("projects").doc(projectId);
  const snap = await ref.get();
  if (!snap.exists) return new Response("Project not found", { status: 404 });
  const data = snap.data() ?? {};
  const segments: Segment[] = data.planVisualData?.market?.segments ?? [];
  if (!segments[index] || segments[index].name !== name) {
    return Response.json({ error: "angle_changed" }, { status: 409 });
  }

  const deduction = await adminDeductCredits(uid, COST);
  if (!deduction.success) {
    return Response.json(
      { error: "insufficient_credits", required: COST, balance: deduction.balance },
      { status: 402 }
    );
  }

  try {
    const others = segments.filter((_, i) => i !== index).map((s) => `- ${s.name}`).join("\n") || "(none)";
    const text = await collectResponseText(apiKey, {
      system: SYSTEM_PROMPT,
      user: [
        UNTRUSTED_RULE,
        `Product: ${untrusted("name", String(data.name ?? ""), 200)}`,
        `Description: ${data.description ? untrusted("description", String(data.description)) : "Not provided"}`,
        `Target markets: ${data.country}`,
        `Angle to replace: ${segments[index].name}`,
        `Other angles already in the plan (do not repeat them):\n${others}`,
        `Write ONE new, clearly different angle.`,
      ].join("\n"),
      imageUrl: typeof data.productImageUrl === "string" ? data.productImageUrl : undefined,
      effort: "low",
    });

    const angle = angleSchema.safeParse(extractJson(text));
    if (!angle.success) throw new Error("The AI returned an unusable angle");

    // Replace only that slot, re-checking inside a transaction so a concurrent edit isn't clobbered.
    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(ref);
      const current: Segment[] = fresh.data()?.planVisualData?.market?.segments ?? [];
      if (!current[index] || current[index].name !== name) throw new Error("angle_changed");
      const next = [...current];
      next[index] = { ...angle.data, ...(current[index].starred ? { starred: true } : {}) };
      tx.update(ref, { "planVisualData.market.segments": next });
    });

    return Response.json({ angle: angle.data });
  } catch (err) {
    await adminRefundCredits(uid, COST).catch(() => console.error("[regenerate-angle] refund failed"));
    if (err instanceof Error && err.message === "angle_changed") {
      return Response.json({ error: "angle_changed" }, { status: 409 });
    }
    console.error("[regenerate-angle] failed:", err instanceof Error ? err.message : err);
    return new Response("Could not regenerate this angle. You were not charged.", { status: 502 });
  }
}
