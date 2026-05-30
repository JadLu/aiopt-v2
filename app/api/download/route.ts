import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) return new Response("url is required", { status: 400 });

  let upstream: Response;
  try {
    upstream = await fetch(url);
  } catch {
    return new Response("Failed to fetch image", { status: 502 });
  }

  if (!upstream.ok) {
    return new Response("Image not found", { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const blob = await upstream.arrayBuffer();

  return new Response(blob, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="creative.${ext}"`,
      "Cache-Control": "no-store",
    },
  });
}
