/**
 * SERVER-ONLY. Pulls a product name, description and main image out of an HTML
 * page (JSON-LD Product → Open Graph → Twitter → <title>/meta description).
 * Everything returned is plain text. Raw HTML is never returned or logged.
 */

export const MAX_NAME = 80;
export const MAX_DESCRIPTION = 500;

export interface ExtractedProduct {
  name: string;
  description: string;
  /** Absolute https URL, or null. */
  imageUrl: string | null;
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—",
  hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", trade: "™", reg: "®", copy: "©",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : " ";
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Plain text only: no tags, no control or bidi-override characters. */
export function cleanText(input: unknown, max: number): string {
  if (typeof input !== "string") return "";
  let s = input.replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, " ").replace(/<[^>]*>/g, " ");
  s = decodeEntities(s);
  s = s.replace(/<[^>]*>/g, " "); // tags that were entity-encoded
  s = s
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g, " ")
    .replace(/[​-‏‪-‮⁠-⁩﻿]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

// ── Tag scanning ───────────────────────────────────────────────────────────
function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  return m ? (m[1] ?? m[2] ?? m[3]) : undefined;
}

function metaMap(html: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const key = (attr(tag, "property") ?? attr(tag, "name") ?? attr(tag, "itemprop"))?.toLowerCase();
    const content = attr(tag, "content");
    if (key && content && !map.has(key)) map.set(key, decodeEntities(content));
  }
  return map;
}

function jsonLdNodes(html: string): unknown[] {
  const out: unknown[] = [];
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    try { out.push(JSON.parse(m[1].trim())); } catch { /* malformed block: ignore */ }
  }
  return out;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function findProduct(node: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 6) return null;
  if (Array.isArray(node)) {
    for (const n of node) { const f = findProduct(n, depth + 1); if (f) return f; }
    return null;
  }
  if (!isRecord(node)) return null;
  const t = node["@type"];
  const types = Array.isArray(t) ? t : [t];
  if (types.some((x) => typeof x === "string" && /(^|[/#:])Product$/i.test(x))) return node;
  if ("@graph" in node) return findProduct(node["@graph"], depth + 1);
  return null;
}

function firstImage(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) { for (const x of v) { const r = firstImage(x); if (r) return r; } return undefined; }
  if (isRecord(v)) return firstImage(v.url ?? v.contentUrl);
  return undefined;
}

function toHttps(raw: string | undefined, base: URL): string | null {
  if (!raw) return null;
  try {
    const u = new URL(decodeEntities(raw.trim()), base);
    if (u.protocol === "http:" && u.hostname) u.protocol = "https:"; // upgrade; the fetch still validates it
    return u.protocol === "https:" && raw.length <= 2048 ? u.toString() : null;
  } catch { return null; }
}

export function extractProduct(html: string, pageUrl: URL): ExtractedProduct | null {
  const meta = metaMap(html);
  const product = findProduct(jsonLdNodes(html));

  const titleTag = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(html)?.[1];
  const linkImage = (() => {
    const m = /<link\b[^>]*rel\s*=\s*["']?image_src["']?[^>]*>/i.exec(html);
    return m ? attr(m[0], "href") : undefined;
  })();

  const name = cleanText(
    (product?.name as unknown) ?? meta.get("og:title") ?? meta.get("twitter:title") ?? titleTag,
    MAX_NAME
  );
  if (!name) return null;

  const description = cleanText(
    (product?.description as unknown) ?? meta.get("og:description") ?? meta.get("twitter:description") ?? meta.get("description"),
    MAX_DESCRIPTION
  );

  const imageUrl = toHttps(
    firstImage(product?.image) ?? meta.get("og:image:secure_url") ?? meta.get("og:image") ?? meta.get("twitter:image") ?? linkImage,
    pageUrl
  );

  return { name, description, imageUrl };
}
