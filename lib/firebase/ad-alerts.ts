"use client";

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseFirestore } from "./firestore";

export interface AdAlert {
  id: string;
  ruleId: string;
  campaignId: string;
  campaignName: string;
  metric: string;
  value: number;
  threshold: number;
  tier: "yellow" | "red";
  resolvedAt: string | null;
  createdAt: string;
}

export interface CreateAdAlertInput {
  ruleId: string;
  campaignId: string;
  campaignName: string;
  metric: string;
  value: number;
  threshold: number;
  tier: "yellow" | "red";
}

function adAlertsCol(uid: string) {
  return collection(getFirebaseFirestore(), "users", uid, "ad-alerts");
}

export async function createAdAlert(
  uid: string,
  input: CreateAdAlertInput
): Promise<string> {
  const ref = await addDoc(adAlertsCol(uid), {
    ...input,
    resolvedAt: null,
    createdAt: new Date().toISOString(),
  });
  return ref.id;
}

export async function resolveAdAlert(
  uid: string,
  alertId: string
): Promise<void> {
  const ref = doc(adAlertsCol(uid), alertId);
  await updateDoc(ref, { resolvedAt: new Date().toISOString() });
}

export function subscribeToAdAlerts(
  uid: string,
  callback: (alerts: AdAlert[]) => void,
  includeResolved = false
): Unsubscribe {
  // Avoid composite index requirement by filtering/sorting client-side
  const q = query(adAlertsCol(uid), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    let alerts = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<AdAlert, "id">),
    }));
    if (!includeResolved) {
      alerts = alerts.filter((a) => a.resolvedAt === null);
    }
    callback(alerts);
  });
}
