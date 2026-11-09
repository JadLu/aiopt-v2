import { NextRequest } from "next/server";
import { requireAuth, AuthError, unauthorizedResponse } from "@/lib/api-auth";
import { adminDeductCredits, adminRefundCredits } from "@/lib/firebase/admin-credits";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import { enforceRateLimit } from "@/lib/rate-limit";
import { generateCreativeSchema, parseBody } from "@/lib/validation";
import { createJob } from "@/lib/jobs";

export const runtime = "nodejs";

const KIE_AI_BASE = "https://api.kie.ai";
const COST = CREDIT_COSTS.PHOTO;

export async function POST(request: NextRequest) {
  let uid: string;
  try { uid = await requireAuth(request); } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse();
    throw e;
  }

  const apiKey = process.env.KIE_AI_API_KEY;
  if (!apiKey) {
    return new Response("KIE_AI_API_KEY is not configured", { status: 500 });
  }

  const limited = await enforceRateLimit(uid, "generate");
  if (limited) return limited;

  const parsed = await parseBody(request, generateCreativeSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const deduction = await adminDeductCredits(uid, COST);
  if (!deduction.success) {
    return Response.json(
      { error: "insufficient_credits", required: COST, balance: deduction.balance },
      { status: 402 }
    );
  }

  let taskId: string | undefined;
  try {
    const upstream = await fetch(`${KIE_AI_BASE}/api/v1/jobs/createTask`, {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "nano-banana-2",
        input: {
          prompt:        body.prompt,
          image_input:   body.imageInput,
          aspect_ratio:  body.aspectRatio,
          resolution:    body.resolution,
          output_format: "jpg",
        },
      }),
    });
    const data = await upstream.json() as { code: number; msg: string; data?: Record<string, unknown> };
    taskId = data.code === 200 ? (data.data?.taskId as string | undefined) : undefined;
    console.log(`[generate-creative] createTask HTTP ${upstream.status} code=${data.code} taskId=${taskId ?? "none"}`);
  } catch {
    console.error("[generate-creative] createTask request failed");
  }

  if (!taskId) {
    await adminRefundCredits(uid, COST).catch(() => console.error("[generate-creative] refund failed"));
    return Response.json({ error: "Generation failed. You were not charged." }, { status: 502 });
  }

  try {
    await createJob(uid, taskId, { cost: COST, kind: "image", projectId: body.projectId });
  } catch {
    // Without a job record the task can't be polled or refunded — refund now.
    await adminRefundCredits(uid, COST).catch(() => { /* logged below */ });
    console.error(`[generate-creative] createJob failed taskId=${taskId}`);
    return Response.json({ error: "Generation failed. You were not charged." }, { status: 500 });
  }

  return Response.json({ taskId });
}
