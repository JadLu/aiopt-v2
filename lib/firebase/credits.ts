"use client";

// Read-only on the client. Credits are changed ONLY by API routes
// (lib/firebase/admin-credits.ts); costs live in lib/credit-costs.ts.

import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { getFirebaseFirestore } from "./firestore";

function userRef(uid: string) {
  return doc(getFirebaseFirestore(), "users", uid);
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
