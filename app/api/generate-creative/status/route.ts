import { type NextRequest } from "next/server";

const KIE_AI_BASE = "https://api.kie.ai";

function findUrl(node: unknown): string | null {
  if (typeof node === "string" && node.startsWith("http")) return node;
  if (Array.isArray(node)) {
    for (const item of node) { const u = findUrl(item); if (u) return u; }
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    for (const key of ["imageUrl", "image_url", "url", "cover", "resource", "result", "output", "downloadUrl", "works", "images", "urls", "outputs", "results"]) {
      const u = findUrl(obj[key]); if (u) return u;
    }
    for (const v of Object.values(obj)) { const u = findUrl(v); if (u) return u; }
  }
  return null;
}

export async function GET(request: NextRequest) {
  const taskId = request.nextUrl.searchParams.get("taskId");
  if (!taskId) return new Response("taskId is required", { status: 400 });

  const apiKey = process.env.KIE_AI_API_KEY;
  if (!apiKey) return new Response("KIE_AI_API_KEY is not configured", { status: 500 });

  // Try POST /queryTask first (consistent with createTask naming convention),
  // then fall back to GET with taskId as query param.
  const attempts: Array<{ label: string; fn: () => Promise<Response> }> = [
    {
      label: "POST /queryTask",
      fn: () => fetch(`${KIE_AI_BASE}/api/v1/jobs/queryTask`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      }),
    },
    {
      label: "GET /queryTask",
      fn: () => fetch(`${KIE_AI_BASE}/api/v1/jobs/queryTask?taskId=${encodeURIComponent(taskId)}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
    },
  ];

  let lastRaw: unknown = null;

  for (const { label, fn } of attempts) {
    let upstream: Response;
    try {
      upstream = await fn();
    } catch (err) {
      console.error(`[status] ${label} network error:`, err);
      continue;
    }

    let raw: unknown;
    try {
      raw = await upstream.json();
    } catch {
      console.warn(`[status] ${label} HTTP ${upstream.status} — non-JSON body`);
      continue;
    }

    console.log(`[status] ${label} HTTP ${upstream.status} response:`, JSON.stringify(raw));
    lastRaw = raw;

    if (!upstream.ok) continue; // e.g. 404 / 401 — try next variant

    const data = raw as Record<string, unknown>;

    // kie.ai wraps payload under data.data
    const payload = (data.data && typeof data.data === "object")
      ? data.data as Record<string, unknown>
      : data;

    const rawStatus = String(payload.status ?? payload.state ?? "").toLowerCase();
    const isFailed  = rawStatus === "failed" || rawStatus === "error";
    const isDone    = rawStatus === "succeeded" || rawStatus === "success" || rawStatus === "done" || rawStatus === "completed" || rawStatus === "finished";

    if (isFailed) return Response.json({ status: "failed" });

    if (isDone) {
      const imageUrl =
        findUrl(payload.works)   ??
        findUrl(payload.output)  ??
        findUrl(payload.result)  ??
        findUrl(payload.outputs) ??
        findUrl(payload.results) ??
        findUrl(payload);
      if (imageUrl) return Response.json({ status: "success", imageUrl });
      // Marked done but URL not yet in payload — keep polling
      return Response.json({ status: "pending" });
    }

    // Still running
    return Response.json({ status: "pending" });
  }

  // All attempts failed or returned non-OK — log the last response for debugging
  console.warn(`[status] all endpoint attempts failed for taskId=${taskId}. Last raw:`, JSON.stringify(lastRaw));
  return Response.json({ status: "pending" });
}
