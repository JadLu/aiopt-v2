"use client";

import { authFetch, readApiError } from "@/lib/auth-fetch";

export interface ImportedProduct {
  name: string;
  description: string;
  imageUrl: string | null;
  imageNote?: string;
  host: string;
}

export type ImportResult =
  | { ok: true; data: ImportedProduct }
  | { ok: false; message: string };

/** Asks the server to read a product page. Free; the server does all the fetching. */
export async function importProduct(url: string): Promise<ImportResult> {
  try {
    const res = await authFetch("/api/import-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.trim() }),
    });
    if (!res.ok) {
      return { ok: false, message: await readApiError(res, "Import failed. Fill the details in manually.") };
    }
    return { ok: true, data: (await res.json()) as ImportedProduct };
  } catch {
    return { ok: false, message: "Couldn't reach the server. Check your connection and try again." };
  }
}
