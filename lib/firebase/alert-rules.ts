"use client";

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseFirestore } from "./firestore";

export type AlertMetric = "CPA" | "ROAS" | "CTR" | "frequency" | "spend";
export type AlertOperator = ">" | "<";
export type AlertTier = "yellow" | "red";
export type AlertScope = "account" | "campaign";

export interface AlertRule {
  id: string;
  metric: AlertMetric;
  operator: AlertOperator;
  threshold: number;
  tier: AlertTier;
  scope: AlertScope;
  campaignId?: string;
  enabled: boolean;
  createdAt: string;
}

export interface CreateAlertRuleInput {
  metric: AlertMetric;
  operator: AlertOperator;
  threshold: number;
  tier: AlertTier;
  scope: AlertScope;
  campaignId?: string;
}

function alertRulesCol(uid: string) {
  return collection(getFirebaseFirestore(), "users", uid, "alert-rules");
}

export async function createAlertRule(
  uid: string,
  input: CreateAlertRuleInput
): Promise<string> {
  const ref = await addDoc(alertRulesCol(uid), {
    ...input,
    enabled: true,
    createdAt: new Date().toISOString(),
  });
  return ref.id;
}

export async function updateAlertRule(
  uid: string,
  ruleId: string,
  data: Partial<Omit<AlertRule, "id" | "createdAt">>
): Promise<void> {
  const ref = doc(alertRulesCol(uid), ruleId);
  await updateDoc(ref, data as Record<string, unknown>);
}

export async function deleteAlertRule(
  uid: string,
  ruleId: string
): Promise<void> {
  const ref = doc(alertRulesCol(uid), ruleId);
  await deleteDoc(ref);
}

export function subscribeToAlertRules(
  uid: string,
  callback: (rules: AlertRule[]) => void
): Unsubscribe {
  const q = query(alertRulesCol(uid), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const rules = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<AlertRule, "id">),
    }));
    callback(rules);
  });
}
