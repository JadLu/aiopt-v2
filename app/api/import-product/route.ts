import { NextRequest } from "next/server";
import { requireAuth, AuthError, unauthorizedResponse } from "@/lib/api-auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { importProductSchema, parseBody } from "@/lib/validation";
import { FetchBlockedError, parseAndCheckUrl, safeFetch } from "@/lib/safe-fetch";
import { isAllowedProductHost } from "@/lib/product-hosts";
import { extractProduct } from "@/lib/product-extract";
import { sniffImage, uploadImageBuffer } from "@/lib/cloudinary-server";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_PAGE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * POST { url } → { name, description, imageUrl, host }
 * Free (no AI call); limited to 10 imports per 10 minutes per user.
 * The browser never receives page HTML — only the three extracted fields.
 */
export async function POST(request: NextRequest) {
  let uid: string;
  try { uid = await requireAuth(request); } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse();
    throw e;
  }

  const limited = await enforceRateLimit(uid, "import-product", 10, 10 * 60_000);
  if (limited) return limited;

  const parsed = await parseBody(request, importProductSchema);
  if (!parsed.ok) return parsed.response;

  // Cheap checks first, so unsupported links get a clear answer.
  let host: string;
  try {
    host = parseAndCheckUrl(parsed.data.url, isAllowedProductHost).hostname.toLowerCase();
  } catch (e) {
    return failure(e, "check");
  }

  let page;
  try {
    page = await safeFetch(parsed.data.url, {
      allowHost: isAllowedProductHost,
      maxBytes: MAX_PAGE_BYTES,
      allowTruncate: true,
      accept: "text/html,application/xhtml+xml",
      contentTypes: /^(text\/html|application\/xhtml\+xml)$/,
    });
  } catch (e) {
    return failure(e, "page");
  }

  const product = extractProduct(page.body.toString("utf8"), page.finalUrl);
  if (!product) {
    return Response.json(
      { error: "We couldn't read product details from that page. Fill them in manually." },
      { status: 422 }
    );
  }

  // The photo is best-effort: any failure still returns the text.
  let imageUrl: string | null = null;
  let imageNote: string | undefined;
  if (product.imageUrl) {
    try {
      const img = await safeFetch(product.imageUrl, {
        maxBytes: MAX_IMAGE_BYTES, // any public host (image CDNs differ), same network guard
        accept: "image/jpeg,image/png,image/webp",
        contentTypes: /^image\/(jpeg|png|webp)$/,
      });
      const mime = sniffImage(img.body);
      if (!mime) throw new FetchBlockedError("bad_type");
      imageUrl = await uploadImageBuffer(uid, img.body, mime);
    } catch (e) {
      console.warn("[import-product] image skipped", host, e instanceof FetchBlockedError ? e.code : "error");
      imageNote = "We couldn't copy the product photo. You can upload one yourself.";
    }
  } else {
    imageNote = "No product photo was found on that page.";
  }

  return Response.json({
    name: product.name,
    description: product.description,
    imageUrl,
    imageNote,
    host: page.finalUrl.hostname.toLowerCase(),
  });
}

function failure(e: unknown, stage: string): Response {
  if (e instanceof FetchBlockedError) {
    console.warn("[import-product]", stage, e.code);
    switch (e.code) {
      case "unsupported_host":
        return Response.json(
          { error: "That site isn't supported yet. Try AliExpress, Amazon, Shopify, noon, Jumia, eBay or Etsy, or fill the details in manually." },
          { status: 400 }
        );
      case "blocked":
        return Response.json({ error: "That link can't be imported. Use a public https product link." }, { status: 400 });
      case "timeout":
        return Response.json({ error: "The site took too long to respond. Try again or fill the details in manually." }, { status: 504 });
      default:
        return Response.json(
          { error: "We couldn't read that page (the site may block automatic import). Fill the details in manually." },
          { status: 502 }
        );
    }
  }
  console.error("[import-product] unexpected", stage);
  return Response.json({ error: "Import failed. Fill the details in manually." }, { status: 500 });
}
