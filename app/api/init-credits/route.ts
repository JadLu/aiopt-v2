import { NextRequest } from "next/server";
import { requireAuth, AuthError, unauthorizedResponse } from "@/lib/api-auth";
import { adminInitUserCredits } from "@/lib/firebase/admin-credits";

export const runtime = "nodejs";

/** Idempotent: creates users/{uid}.credits = 0 on first sign-in only. */
export async function POST(request: NextRequest) {
  let uid: string;
  try { uid = await requireAuth(request); } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse();
    throw e;
  }
  await adminInitUserCredits(uid);
  return Response.json({ ok: true });
}
