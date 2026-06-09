"use client";

import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseFirestore } from "./firestore";

export const CREDIT_COSTS = {
  MARKETING_PLAN: 20,
  PHOTO: 35,
  LANDING_PAGE: 35,
} as const;

export function videoCreditCost(duration: string): number {
  const num = parseInt(duration, 10);
  if (num >= 10) return 300;
  if (num >= 8) return 260;
  return 240; // 5s / 6s
}

function userRef(uid: string) {
  return doc(getFirebaseFirestore(), "users", uid);
}

/**
 * Set credits:0 only if the field doesn't already exist.
 * Safe to call on every sign-in — idempotent via transaction.
 */
export async function initUserCredits(uid: string): Promise<void> {
  const db = getFirebaseFirestore();
  const ref = doc(db, "users", uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists() || snap.data()?.credits === undefined) {
      tx.set(ref, { credits: 0, createdAt: serverTimestamp() }, { merge: true });
    }
  });
}

/**
 * Atomically deduct `amount` credits.
 * Returns { success: true } if deducted, or { success: false, balance } if not enough.
 */
export async function deductCredits(
  uid: string,
  amount: number
): Promise<{ success: true } | { success: false; balance: number }> {
  const db = getFirebaseFirestore();
  const ref = doc(db, "users", uid);
  let outcome: { success: true } | { success: false; balance: number } = {
    success: false,
    balance: 0,
  };
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const balance: number = snap.data()?.credits ?? 0;
    if (balance >= amount) {
      tx.set(ref, { credits: balance - amount }, { merge: true });
      outcome = { success: true };
    } else {
      outcome = { success: false, balance };
    }
  });
  return outcome;
}

/** Atomically refund `amount` credits (called when an API call fails after deduction). */
export async function refundCredits(uid: string, amount: number): Promise<void> {
  const db = getFirebaseFirestore();
  const ref = doc(db, "users", uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const balance: number = snap.data()?.credits ?? 0;
    tx.set(ref, { credits: balance + amount }, { merge: true });
  });
}

/** One-time read of the current credit balance. */
export async function getCredits(uid: string): Promise<number> {
  const snap = await getDoc(userRef(uid));
  return snap.data()?.credits ?? 0;
}

/** Real-time subscription to the credit balance. */
export function subscribeToCredits(
  uid: string,
  cb: (credits: number) => void,
  onError?: () => void
): Unsubscribe {
  return onSnapshot(
    userRef(uid),
    (snap) => { cb(snap.data()?.credits ?? 0); },
    () => { onError?.(); }
  );
}
