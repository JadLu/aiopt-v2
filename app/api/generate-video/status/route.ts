import { type NextRequest } from "next/server";

const KIE_AI_BASE = "https://api.kie.ai";

export async function GET(request: NextRequest) {
  const taskId = request.nextUrl.searchParams.get("taskId");
  if (!taskId) return new Response("taskId is required", { status: 400 });

  const apiKey = process.env.KIE_AI_API_KEY;
  if (!apiKey) return new Response("KIE_AI_API_KEY is not configured", { status: 500 });

  let upstream: Response;
  try {
    upstream = await fetch(
      `${KIE_AI_BASE}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
  } catch (err) {
    console.error(`[video-status] network error for taskId=${taskId}:`, err);
    return Response.json({ status: "pending" });
  }

  const data = await upstream.json() as { code: number; msg: string; data?: Record<string, unknown> };
  console.log(`[video-status] recordInfo HTTP ${upstream.status} for taskId=${taskId}:`, JSON.stringify(data));

  const payload = data.data;
  if (!payload) return Response.json({ status: "pending" });

  const state = String(payload.state ?? "").toLowerCase();

  if (state === "fail") {
    return Response.json({ status: "failed" });
  }

  if (state === "success") {
    // resultJson is a stringified JSON: '{"resultUrls":["https://....mp4"]}'
    let videoUrl: string | null = null;
    try {
      const parsed = JSON.parse(String(payload.resultJson ?? "{}")) as { resultUrls?: string[] };
      videoUrl = parsed.resultUrls?.[0] ?? null;
    } catch {
      console.warn(`[video-status] could not parse resultJson for taskId=${taskId}:`, payload.resultJson);
    }

    if (videoUrl) return Response.json({ status: "success", videoUrl });
    // Succeeded but URL not yet populated — keep polling
    return Response.json({ status: "pending" });
  }

  // waiting / queuing / generating — still in progress
  return Response.json({ status: "pending" });
}
