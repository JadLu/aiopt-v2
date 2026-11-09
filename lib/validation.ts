import { z } from "zod";

/**
 * Server-only request validation for API routes.
 * Every route parses its body through one of these schemas and returns 400
 * on failure — never trust client-supplied values.
 */

// ── Allowlists (must match the options offered in the studio UIs) ──────────
export const IMAGE_ASPECT_RATIOS = ["1:1", "4:5", "9:16"] as const;
export const IMAGE_RESOLUTIONS = ["1K", "2K", "4K"] as const;
export const VIDEO_ASPECT_RATIOS = ["9:16", "16:9", "1:1"] as const;
export const VIDEO_DURATIONS = ["5", "8", "10"] as const;
export const VIDEO_RESOLUTIONS = ["480p", "720p", "1080p"] as const;
export const COPYFRAMES = ["AIDA", "PAS", "FAP"] as const;

export const MAX_PROMPT_LENGTH = 2000;
export const MAX_IMAGE_URLS = 4;

// ── Own-Cloudinary URL check ───────────────────────────────────────────────
/** https only, host res.cloudinary.com, path under OUR cloud name. */
export function isOwnCloudinaryUrl(raw: string): boolean {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloud) return false;
  try {
    const u = new URL(raw);
    return (
      u.protocol === "https:" &&
      u.hostname === "res.cloudinary.com" &&
      u.port === "" &&
      !u.username &&
      !u.password &&
      u.pathname.startsWith(`/${cloud}/`)
    );
  } catch {
    return false;
  }
}

const cloudinaryUrl = z
  .string()
  .max(2048)
  .refine(isOwnCloudinaryUrl, { message: "Must be an https URL on our Cloudinary account" });

const cloudinaryUrlList = z.array(cloudinaryUrl).max(MAX_IMAGE_URLS);

/** Optional URL field: "", null and undefined all mean "not provided". */
const optionalCloudinaryUrl = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  cloudinaryUrl.optional()
);
const optionalText = (max: number) =>
  z.string().max(max).nullish().transform((v) => v ?? "");

const projectId = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/, "Invalid id");

const prompt = z.string().trim().min(1).max(MAX_PROMPT_LENGTH);

// ── Route schemas ──────────────────────────────────────────────────────────
export const generateCreativeSchema = z.object({
  prompt,
  projectId: projectId.optional(),
  aspectRatio: z.enum(IMAGE_ASPECT_RATIOS).default("1:1"),
  resolution: z.enum(IMAGE_RESOLUTIONS).default("1K"),
  imageInput: cloudinaryUrlList.default([]),
});

export const generateVideoSchema = z.object({
  prompt,
  projectId: projectId.optional(),
  aspectRatio: z.enum(VIDEO_ASPECT_RATIOS).default("9:16"),
  duration: z.enum(VIDEO_DURATIONS).default("8"),
  resolution: z.enum(VIDEO_RESOLUTIONS).default("720p"),
  imageUrls: cloudinaryUrlList.default([]),
});

export const taskIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/, "Invalid taskId");

const critText = z.string().max(500).nullish().transform((v) => v ?? undefined);

export const generateLandingPageSchema = z.object({
  project: z.object({
    name: z.string().trim().min(1).max(200),
    description: optionalText(4000),
    country: z.string().trim().min(1).max(500),
    emoji: optionalText(16),
    productImageUrl: optionalCloudinaryUrl,
    photoUrls: cloudinaryUrlList.nullish().transform((v) => v ?? undefined),
    gifUrl: optionalCloudinaryUrl,
  }),
  copyframe: z.enum(COPYFRAMES),
  language: z.enum(["fr", "en", "auto"]).optional(),
  criteria: z
    .object({
      segment: critText,
      pillar: critText,
      hook: critText,
      tone: critText,
    })
    .prefault({}),
});

export const marketingPlanSchema = z.object({
  project: z.object({
    id: projectId,
    name: z.string().trim().min(1).max(200),
    description: optionalText(MAX_PROMPT_LENGTH),
    country: z.string().trim().min(1).max(500),
    emoji: optionalText(16),
    productImageUrl: optionalCloudinaryUrl,
  }),
});

export const regenerateAngleSchema = z.object({
  projectId,
  index: z.number().int().min(0).max(49),
  /** Name of the angle being replaced; guards against replacing the wrong card after a concurrent edit. */
  name: z.string().max(300),
});

/** Shape the AI must return for one marketing angle. */
export const angleSchema = z.object({
  name: z.string().trim().min(1).max(120),
  size: z.string().trim().max(160).default(""),
  traits: z.array(z.string().trim().min(1).max(200)).min(1).max(5),
});

export const importProductSchema = z.object({
  url: z.string().trim().url().max(2048),
});

export const uploadSignatureSchema = z.object({
  kind: z.enum(["image", "video"]),
  projectId,
  purpose: z.enum(["product", "clips", "lp-photos", "lp-gifs", "renders"]),
});

// ── Helper ─────────────────────────────────────────────────────────────────
export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: Response };

/** Reads JSON from the request and validates it. Failure → ready-made 400. */
export async function parseBody<S extends z.ZodType>(
  request: Request,
  schema: S
): Promise<ParseResult<z.output<S>>> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return { ok: false, response: new Response("Invalid request body", { status: 400 }) };
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    const msg = result.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
      .join("; ");
    return { ok: false, response: Response.json({ error: `Invalid request — ${msg}` }, { status: 400 }) };
  }
  return { ok: true, data: result.data };
}
