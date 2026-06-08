import { type NextRequest } from "next/server";

const ALLOWED_HOSTS = [
  "res.cloudinary.com",
  "storage.googleapis.com",
  "firebasestorage.googleapis.com",
  // KIE AI / task result CDN hostnames
  "cdn.kie.ai",
  "kie.ai",
  "api.kie.ai",
];

function isAllowedUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") return false;
    return ALLOWED_HOSTS.some(
      (h) => parsed.hostname === h || parsed.hostname.endsWith("." + h)
    );
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const url      = request.nextUrl.searchParams.get("url");
  const filename = request.nextUrl.searchParams.get("filename");
  if (!url) return new Response("url is required", { status: 400 });

  if (!isAllowedUrl(url)) {
    return new Response("URL not allowed", { status: 403 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(url);
  } catch {
    return new Response("Failed to fetch resource", { status: 502 });
  }

  if (!upstream.ok) {
    return new Response("Resource not found", { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
  const blob = await upstream.arrayBuffer();

  // Derive a safe fallback filename from content-type when none is provided
  let safeFilename = filename;
  if (!safeFilename) {
    if (contentType.includes("video/mp4") || contentType.includes("video/")) {
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
  safeFilename = safeFilename.replace(/[^a-zA-Z0-9._-]/g, "_");

  // Force video/mp4 for mp4 files regardless of what the upstream reports
  const resolvedType =
    safeFilename.endsWith(".mp4") ? "video/mp4" : contentType;

  return new Response(blob, {
    headers: {
      "Content-Type": resolvedType,
      "Content-Disposition": `attachment; filename="${safeFilename}"`,
      "Cache-Control": "no-store",
    },
  });
}
