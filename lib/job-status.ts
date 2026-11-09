import { type NextRequest } from "next/server";
import { requireAuth, AuthError, unauthorizedResponse } from "@/lib/api-auth";
import { getOwnedJob, markJobDone, refundJobOnce, JOB_STALE_MS, type JobKind } from "@/lib/jobs";
import { taskIdSchema } from "@/lib/validation";
import { notify, projectLabel, projectHref } from "@/lib/notify";

const KIE_AI_BASE = "https://api.kie.ai";

/**
 * Shared GET handler for /api/generate-creative/status and
 * /api/generate-video/status.
 *  - Only returns results for a taskId recorded under the caller's own
 *    users/{uid}/jobs (anything else → 404).
 *  - Refunds the job's cost exactly once when KIE reports failure or the job
 *    has been pending longer than JOB_STALE_MS.
 */
export async function handleJobStatus(
  request: NextRequest,
  kind: JobKind,
  resultKey: "imageUrl" | "videoUrl"
): Promise<Response> {
  let uid: string;
  try { uid = await requireAuth(request); } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse();
    throw e;
  }

  const parsedId = taskIdSchema.safeParse(request.nextUrl.searchParams.get("taskId"));
  if (!parsedId.success) return new Response("taskId is required", { status: 400 });
  const taskId = parsedId.data;

  const job = await getOwnedJob(uid, taskId, kind);
  if (!job) return new Response("Not found", { status: 404 });

  // Already settled by an earlier poll.
  if (job.status === "failed") return Response.json({ status: "failed" });

  const apiKey = process.env.KIE_AI_API_KEY;
  if (!apiKey) return new Response("KIE_AI_API_KEY is not configured", { status: 500 });

  const stale = Date.now() - job.createdAtMs > JOB_STALE_MS;
  const noun = kind === "image" ? "image" : "video";
  const fail = async () => {
    const refunded = await refundJobOnce(uid, taskId);
    if (refunded) {
      await notify(uid, {
        id: `job-failed-${taskId}`,
        type: "generation_failed",
        title: `Your ${noun} couldn’t be generated`,
        body: `${await projectLabel(uid, job.projectId)}: the ${noun} failed. Your ${job.cost} credits were refunded.`,
        href: projectHref(job.projectId),
      });
    }
    return Response.json({ status: "failed" });
  };

  let payload: Record<string, unknown> | undefined;
  try {
    const upstream = await fetch(
      `${KIE_AI_BASE}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    const data = await upstream.json() as { data?: Record<string, unknown> };
    payload = data.data;
    console.log(`[${kind}-status] HTTP ${upstream.status} taskId=${taskId} state=${String(payload?.state ?? "none")}`);
  } catch {
    console.error(`[${kind}-status] request failed taskId=${taskId}`);
    return stale ? fail() : Response.json({ status: "pending" });
  }

  const state = String(payload?.state ?? "").toLowerCase();

  if (state === "fail") return fail();

  if (state === "success") {
    // resultJson is a stringified JSON: '{"resultUrls":["https://..."]}'
    let url: string | null = null;
    try {
      const parsed = JSON.parse(String(payload?.resultJson ?? "{}")) as { resultUrls?: string[] };
      url = parsed.resultUrls?.[0] ?? null;
    } catch {
      console.warn(`[${kind}-status] unparseable resultJson taskId=${taskId}`);
    }
    if (url) {
      await markJobDone(uid, taskId);
      await notify(uid, {
        id: `job-done-${taskId}`,
        type: "creatives_ready",
        title: `Your ${noun} is ready`,
        body: `${await projectLabel(uid, job.projectId)}: a new ${noun} was added to your creatives.`,
        href: projectHref(job.projectId),
      });
      return Response.json({ status: "success", [resultKey]: url });
    }
    // Succeeded but URL not yet populated — keep polling (unless stale)
  }

  return stale ? fail() : Response.json({ status: "pending" });
}
