import { type NextRequest } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";

export class AuthError extends Error {}

/**
 * Verifies the Firebase ID token in the Authorization header.
 * Returns the authenticated uid, or throws AuthError on failure.
 */
export async function requireAuth(request: NextRequest): Promise<string> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthError("Missing Authorization header");
  }

  const token = authHeader.slice(7);
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    throw new AuthError("Invalid or expired token");
  }
}

export function unauthorizedResponse(): Response {
  return new Response("Unauthorized", { status: 401 });
}
