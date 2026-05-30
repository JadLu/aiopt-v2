import { type NextRequest } from "next/server";

const KIE_AI_BASE = "https://api.kie.ai";

function findUrl(node: unknown): string | null {
  if (typeof node === "string" && node.startsWith("http")) return node;
  if (Array.isArray(node)) {
    for (const item of node) { const u = findUrl(item); if (u) return u; }
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    for (const key of ["imageUrl", "image_url", "url", "cover", "resource", "result", "output", "downloadUrl", "works"]) {
      const u = findUrl(obj[key]); if (u) return u;
    }
    for (const v of Object.values(obj)) { const u = findUrl(v); if (u) return u; }
  }
  return null;
}

export async function GET(request: NextRequest) {
  const taskId = request.nextUrl.searchParams.get("taskId");
  if (!taskId) {
    return new Response("taskId is required", { status: 400 });
  }

  const apiKey = process.env.KIE_AI_API_KEY;
  if (!apiKey) {
    return new Response("KIE_AI_API_KEY is not configured", { status: 500 });
  }

  let data: Record<string, unknown>;
  try {
    const upstream = await fetch(
      `${KIE_AI_BASE}/api/v1/jobs/queryTask?taskId=${encodeURIComponent(taskId)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    data = await upstream.json() as Record<string, unknown>;
    console.log(`[status] kie.ai queryTask response for taskId=${taskId}:`, JSON.stringify(data));
  } catch (err) {
    console.error(`[status] fetch error for taskId=${taskId}:`, err);
    return Response.json({ status: "pending" });
  }

  // kie.ai wraps results under data.data
  const payload = (data.data && typeof data.data === "object")
    ? data.data as Record<string, unknown>
    : data;

  const rawStatus = String(payload.status ?? payload.state ?? "").toLowerCase();
  const isFailed  = rawStatus === "failed" || rawStatus === "error";
  const isDone    = rawStatus === "succeeded" || rawStatus === "success" || rawStatus === "done" || rawStatus === "completed";

  if (isFailed) {
    return Response.json({ status: "failed" });
  }

  if (isDone) {
    const imageUrl = findUrl(payload.works) ?? findUrl(payload.output) ?? findUrl(payload.result) ?? findUrl(payload.outputs) ?? findUrl(payload);
    if (imageUrl) {
      return Response.json({ status: "success", imageUrl });
    }
    // Marked done but no URL yet — treat as still pending
    return Response.json({ status: "pending" });
  }

  return Response.json({ status: "pending" });
}
