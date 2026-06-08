"use client";

import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  query,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseFirestore } from "./firestore";

export type HealthTier = "green" | "yellow" | "red";
export type CampaignStatus = "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED";

export interface MetaCampaign {
  id: string;
  accountId: string;
  name: string;
  status: CampaignStatus;
  objective: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  cpc: number;
  purchases: number;
  roas: number;
  cpa: number;
  frequency: number;
  healthScore: number;
  healthTier: HealthTier;
  syncedAt: string;
}

function metaCampaignsCol(uid: string) {
  return collection(getFirebaseFirestore(), "users", uid, "meta-campaigns");
}

export async function upsertMetaCampaigns(
  uid: string,
  campaigns: MetaCampaign[]
): Promise<void> {
  const db = getFirebaseFirestore();
  const writes = campaigns.map((c) => {
    const ref = doc(
      collection(db, "users", uid, "meta-campaigns"),
      c.id
    );
    return setDoc(ref, c, { merge: true });
  });
  await Promise.all(writes);
}

export function subscribeToMetaCampaigns(
  uid: string,
  accountId: string,
  callback: (campaigns: MetaCampaign[]) => void
): Unsubscribe {
  // Filter client-side to avoid composite index requirement
  const q = query(metaCampaignsCol(uid));
  return onSnapshot(q, (snap) => {
    const campaigns = snap.docs
      .map((d) => d.data() as MetaCampaign)
      .filter((c) => c.accountId === accountId)
      .sort((a, b) => b.spend - a.spend);
    callback(campaigns);
  });
}

export function subscribeToAllMetaCampaigns(
  uid: string,
  callback: (campaigns: MetaCampaign[]) => void
): Unsubscribe {
  const q = query(metaCampaignsCol(uid));
  return onSnapshot(q, (snap) => {
    const campaigns = snap.docs
      .map((d) => d.data() as MetaCampaign)
      .sort((a, b) => b.spend - a.spend);
    callback(campaigns);
  });
}
