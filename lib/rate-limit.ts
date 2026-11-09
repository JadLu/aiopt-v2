import { getAdminFirestore } from "@/lib/firebase/admin";

/**
 * Server-only fixed-window rate limiter backed by a Firestore counter.
 * Stored in the top-level `rateLimits` collection, which has no client rules
 * (denied by default) — a user subcollection would let clients reset it.
 *
 * Returns a 429 Response when the limit is exceeded, otherwise null.
 */
export async function enforceRateLimit(
  uid: string,
  bucket: string,
  limit = 10,
  windowMs = 60_000
): Promise<Response | null> {
  const db = getAdminFirestore();
  const ref = db.collection("rateLimits").doc(`${uid}_${bucket}`);
  const now = Date.now();

  const retryAfterMs = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() as { windowStart?: number; count?: number } | undefined;
    const windowStart = data?.windowStart ?? 0;

    if (!data || now - windowStart >= windowMs) {
      tx.set(ref, { windowStart: now, count: 1 });
      return 0;
    }
    if ((data.count ?? 0) >= limit) {
      return windowMs - (now - windowStart);
    }
    tx.update(ref, { count: (data.count ?? 0) + 1 });
    return 0;
  });

  if (retryAfterMs > 0) {
    return new Response("Too many requests. Please slow down.", {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
    });
  }
  return null;
}
