/** SERVER-ONLY Cloudinary helpers (uses the API secret). */
import { createHash } from "node:crypto";
import { isOwnCloudinaryUrl } from "@/lib/validation";

/** Cloudinary signature: sha1("k=v&k=v" sorted by key + api_secret). */
export function signCloudinaryParams(params: Record<string, string | number>, secret: string): string {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(toSign + secret).digest("hex");
}

export type ImageMime = "image/jpeg" | "image/png" | "image/webp";

/** Identify an image by its bytes, ignoring whatever the server claimed. */
export function sniffImage(buf: Buffer): ImageMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

/** Signed upload of bytes we fetched ourselves. Returns the secure_url on OUR account. */
export async function uploadImageBuffer(uid: string, buf: Buffer, mime: ImageMime): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) throw new Error("Cloudinary is not configured");

  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `users/${uid}/imports/${Date.now()}`;
  const allowed = "jpg,jpeg,png,webp";
  const signature = signCloudinaryParams({ allowed_formats: allowed, public_id: publicId, timestamp }, apiSecret);

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buf)], { type: mime }), "import");
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  form.append("public_id", publicId);
  form.append("allowed_formats", allowed);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Cloudinary upload failed (${res.status})`);
  const data = (await res.json()) as { secure_url?: unknown };
  if (typeof data.secure_url !== "string" || !isOwnCloudinaryUrl(data.secure_url)) {
    throw new Error("Unexpected Cloudinary response");
  }
  return data.secure_url;
}
