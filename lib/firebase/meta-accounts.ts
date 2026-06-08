"use client";

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseFirestore } from "./firestore";

export interface MetaAccount {
  id: string;
  name: string;
  accessToken: string;
  tokenExpiresAt: string;
  lastSyncedAt: string | null;
  targetRoas: number;
  targetCpa: number;
  status: "connected" | "expired" | "error";
  createdAt: string;
}

export interface CreateMetaAccountInput {
  id: string;
  name: string;
  accessToken: string;
  tokenExpiresAt: string;
  targetRoas?: number;
  targetCpa?: number;
}

function metaAccountsCol(uid: string) {
  return collection(getFirebaseFirestore(), "users", uid, "meta-accounts");
}

export async function createMetaAccount(
  uid: string,
  input: CreateMetaAccountInput
): Promise<void> {
  const ref = doc(metaAccountsCol(uid), input.id);
  await setDoc(ref, {
    id: input.id,
    name: input.name,
    accessToken: input.accessToken,
    tokenExpiresAt: input.tokenExpiresAt,
    lastSyncedAt: null,
    targetRoas: input.targetRoas ?? 2.5,
    targetCpa: input.targetCpa ?? 50,
    status: "connected",
    createdAt: new Date().toISOString(),
  });
}

export async function updateMetaAccount(
  uid: string,
  accountId: string,
  data: Partial<Omit<MetaAccount, "id" | "createdAt">>
): Promise<void> {
  const ref = doc(metaAccountsCol(uid), accountId);
  await updateDoc(ref, data as Record<string, unknown>);
}

export async function deleteMetaAccount(
  uid: string,
  accountId: string
): Promise<void> {
  const ref = doc(metaAccountsCol(uid), accountId);
  await deleteDoc(ref);
}

export function subscribeToMetaAccounts(
  uid: string,
  callback: (accounts: MetaAccount[]) => void
): Unsubscribe {
  const q = query(metaAccountsCol(uid), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const accounts = snap.docs.map((d) => d.data() as MetaAccount);
    callback(accounts);
  });
}
