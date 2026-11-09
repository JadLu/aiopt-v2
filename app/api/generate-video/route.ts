import { NextRequest } from "next/server";
import { requireAuth, AuthError, unauthorizedResponse } from "@/lib/api-auth";
import { adminDeductCredits, adminRefundCredits } from "@/lib/firebase/admin-credits";
import { videoCreditCost } from "@/lib/credit-costs";
import { enforceRateLimit } from "@/lib/rate-limit";
import { generateVideoSchema, parseBody } from "@/lib/validation";
import { createJob } from "@/lib/jobs";

export const runtime = "nodejs";

const KIE_AI_BASE = "https://api.kie.ai";

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

  const parsed = await parseBody(request, generateVideoSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  // Price is derived from the validated duration that is also sent to KIE.
  const cost = videoCreditCost(body.duration);

  const deduction = await adminDeductCredits(uid, cost);
  if (!deduction.success) {
    return Response.json(
      { error: "insufficient_credits", required: cost, balance: deduction.balance },
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
        model: "gemini-omni-video",
        input: {
          prompt:       body.prompt,
          image_urls:   body.imageUrls,
          aspect_ratio: body.aspectRatio,
          duration:     body.duration,
          resolution:   body.resolution,
        },
      }),
    });
    const data = await upstream.json() as { code: number; msg: string; data?: Record<string, unknown> };
    taskId = data.code === 200 ? (data.data?.taskId as string | undefined) : undefined;
    console.log(`[generate-video] createTask HTTP ${upstream.status} code=${data.code} taskId=${taskId ?? "none"}`);
  } catch {
    console.error("[generate-video] createTask request failed");
  }

  if (!taskId) {
    await adminRefundCredits(uid, cost).catch(() => console.error("[generate-video] refund failed"));
    return Response.json({ error: "Video generation failed. You were not charged." }, { status: 502 });
  }

  try {
    await createJob(uid, taskId, { cost, kind: "video", projectId: body.projectId });
  } catch {
    await adminRefundCredits(uid, cost).catch(() => { /* logged below */ });
    console.error(`[generate-video] createJob failed taskId=${taskId}`);
    return Response.json({ error: "Video generation failed. You were not charged." }, { status: 500 });
  }

  return Response.json({ taskId });
}
