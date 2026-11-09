import { type NextRequest } from "next/server";
import { requireAuth, AuthError, unauthorizedResponse } from "@/lib/api-auth";

export const runtime = "nodejs";

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

// Exact hostnames only (no suffix matching) so a tenant/subdomain on a shared
// host can't be used to reach arbitrary content. Bare "kie.ai" was removed.
const ALLOWED_HOSTS = new Set([
  "res.cloudinary.com",
  "cdn.kie.ai",
  "api.kie.ai",
  "storage.googleapis.com",
  "firebasestorage.googleapis.com",
]);

function isAllowedUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return (
      parsed.protocol === "https:" &&
      !parsed.username &&
      !parsed.password &&
      parsed.port === "" &&
      ALLOWED_HOSTS.has(parsed.hostname)
    );
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  try { await requireAuth(request); } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse();
    throw e;
  }

  const url      = request.nextUrl.searchParams.get("url");
  const filename = request.nextUrl.searchParams.get("filename");
  if (!url) return new Response("url is required", { status: 400 });

  if (!isAllowedUrl(url)) {
    return new Response("URL not allowed", { status: 403 });
  }

  let upstream: Response;
  try {
    // "manual": a redirect can't carry us to a host outside the allowlist.
    upstream = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(30_000) });
  } catch {
    return new Response("Failed to fetch resource", { status: 502 });
  }

  if (upstream.status >= 300 && upstream.status < 400) {
    await upstream.body?.cancel().catch(() => { /* ignore */ });
    return new Response("Redirects are not allowed", { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    await upstream.body?.cancel().catch(() => { /* ignore */ });
    return new Response("Resource not found", { status: 502 });
  }

  const declared = Number(upstream.headers.get("content-length") ?? "0");
  if (declared > MAX_BYTES) {
    await upstream.body.cancel().catch(() => { /* ignore */ });
    return new Response("File too large", { status: 413 });
  }

  // Stream with a hard byte cap (content-length can be absent or wrong).
  const reader = upstream.body.getReader();
  let total = 0;
  const limited = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) { controller.close(); return; }
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel().catch(() => { /* ignore */ });
        controller.error(new Error("File too large"));
        return;
      }
      controller.enqueue(value);
    },
    cancel() { return reader.cancel(); },
  });

  const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";

  // Derive a safe fallback filename from content-type when none is provided
  let safeFilename = filename;
  if (!safeFilename) {
    if (contentType.includes("video/")) {
      safeFilename = "video.mp4";
    } else if (contentType.includes("png")) {
      safeFilename = "creative.png";
    } else if (contentType.includes("webp")) {
      safeFilename = "creative.webp";
    } else {
      safeFilename = "creative.jpg";
    }
  }

  // Strip everything except safe filename characters to prevent header injection
  safeFilename = safeFilename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);

  // Force video/mp4 for mp4 files regardless of what the upstream reports
  const resolvedType =
    safeFilename.endsWith(".mp4") ? "video/mp4" : contentType;

  const headers: Record<string, string> = {
    "Content-Type": resolvedType,
    "Content-Disposition": `attachment; filename="${safeFilename}"`,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (declared > 0) headers["Content-Length"] = String(declared);

  return new Response(limited, { headers });
}
