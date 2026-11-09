import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "./admin";
import { LOW_CREDITS_THRESHOLD } from "@/lib/notification-types";
import { notifyLowCredits } from "@/lib/notify";

/**
 * Server-only (Admin SDK) credit operations. Credits are NEVER modified from
 * the browser — firestore.rules makes users/{uid} read-only for clients.
 */

function assertAmount(amount: number): void {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error(`Invalid credit amount: ${amount}`);
  }
}

/** Sets credits: 0 only if the field doesn't exist yet. Idempotent. */
export async function adminInitUserCredits(uid: string): Promise<void> {
  const db = getAdminFirestore();
  const ref = db.collection("users").doc(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data()?.credits === undefined) {
      tx.set(ref, { credits: 0, createdAt: FieldValue.serverTimestamp() }, { merge: true });
    }
  });
}

export async function adminDeductCredits(
  uid: string,
  amount: number
): Promise<{ success: true; balance: number } | { success: false; balance: number }> {
  assertAmount(amount);
  const db = getAdminFirestore();
  const ref = db.collection("users").doc(uid);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const balance: number = snap.data()?.credits ?? 0;
    if (balance >= amount) {
      tx.set(ref, { credits: balance - amount }, { merge: true });
      return { success: true as const, before: balance, balance: balance - amount };
    }
    return { success: false as const, before: balance, balance };
  });

  // Heads-up when this charge crosses the low-credits line (deduped to once a day).
  if (result.success && result.before >= LOW_CREDITS_THRESHOLD && result.balance < LOW_CREDITS_THRESHOLD) {
    await notifyLowCredits(uid, result.balance);
  }
  return result.success
    ? { success: true as const, balance: result.balance }
    : { success: false as const, balance: result.balance };
}

export async function adminRefundCredits(uid: string, amount: number): Promise<void> {
  assertAmount(amount);
  const db = getAdminFirestore();
  const ref = db.collection("users").doc(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const balance: number = snap.data()?.credits ?? 0;
    tx.set(ref, { credits: balance + amount }, { merge: true });
  });
}
