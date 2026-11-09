import { NextRequest } from "next/server";
import { signCloudinaryParams as sign } from "@/lib/cloudinary-server";
import { requireAuth, AuthError, unauthorizedResponse } from "@/lib/api-auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { parseBody, uploadSignatureSchema } from "@/lib/validation";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

type Purpose = "product" | "clips" | "lp-photos" | "lp-gifs" | "renders";

const PURPOSES: Record<Purpose, { kind: "image" | "video"; formats: string; unique: boolean }> = {
  "product":   { kind: "image", formats: "jpg,jpeg,png,webp", unique: false }, // one per project, overwritten
  "lp-photos": { kind: "image", formats: "jpg,jpeg,png,webp", unique: true },
  "lp-gifs":   { kind: "image", formats: "gif",               unique: true },
  "clips":     { kind: "video", formats: "mp4,webm,mov",      unique: true },
  "renders":   { kind: "video", formats: "mp4,webm",          unique: true },
};

export async function POST(request: NextRequest) {
  let uid: string;
  try { uid = await requireAuth(request); } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse();
    throw e;
  }

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    return new Response("Cloudinary is not configured", { status: 500 });
  }

  const limited = await enforceRateLimit(uid, "upload", 30);
  if (limited) return limited;

  const parsed = await parseBody(request, uploadSignatureSchema);
  if (!parsed.ok) return parsed.response;
  const { kind, projectId, purpose } = parsed.data;

  const cfg = PURPOSES[purpose];
  if (cfg.kind !== kind) {
    return Response.json({ error: `"${purpose}" uploads must be of kind "${cfg.kind}"` }, { status: 400 });
  }

  // Path is built server-side from the verified uid — the client can't pick it.
  const base = `users/${uid}/projects/${projectId}/${purpose}`;
  const publicId = cfg.unique ? `${base}/${Date.now()}` : base;
  const timestamp = Math.floor(Date.now() / 1000);

  const signature = sign(
    { allowed_formats: cfg.formats, public_id: publicId, timestamp },
    apiSecret
  );

  return Response.json({
    signature,
    timestamp,
    apiKey,
    cloudName,
    publicId,
    allowedFormats: cfg.formats,
    resourceType: kind, // "image" | "video" → upload endpoint
    maxBytes: kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES,
  });
}
