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
