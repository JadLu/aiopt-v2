"use client";

import { getFirebaseAuth } from "@/lib/firebase/auth";

/**
 * Drop-in replacement for fetch() that automatically attaches the current
 * user's Firebase ID token as a Bearer token.  All API routes that call
 * requireAuth() expect this header.
 */
export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error("Not authenticated");

  const token = await user.getIdToken();

  return fetch(input, {
    ...init,
    headers: {
      ...(init?.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${token}`,
    },
  });
}

/**
 * Best-effort extraction of a human-readable error from a failed API response.
 * Routes return either JSON `{ error }` or a short plain-text body.
 */
export async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return fallback;
    try {
      const parsed = JSON.parse(text) as { error?: unknown };
      if (typeof parsed.error === "string" && parsed.error) return parsed.error;
    } catch {
      /* not JSON */
    }
    return text.length <= 200 ? text : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Downloads a remote file through the authenticated /api/download proxy.
 * A plain <a href> can't send the Authorization header, so we fetch a blob.
 */
export async function downloadViaProxy(url: string, filename: string): Promise<void> {
  const res = await authFetch(
    `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`
  );
  if (!res.ok) throw new Error(await readApiError(res, `Download failed (${res.status})`));
  const blobUrl = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
}
