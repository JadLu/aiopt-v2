"use client";

import { getFirebaseFirestore } from "./firestore";
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, orderBy, query,
} from "firebase/firestore";

export type LandingPageStatus = "pending" | "done" | "failed";
export type Copyframe = "AIDA" | "PAS" | "FAP";

export interface LandingPageCriteria {
  segment?: string;
  channel?: string;
  pillar?: string;
  hook?: string;
  tone?: string;
  language?: string;
}

export interface AiLandingPage {
  id: string;
  html: string;
  copyframe: Copyframe;
  prompt: string;
  criteria: LandingPageCriteria;
  status: LandingPageStatus;
  createdAt: string;
}

export interface CreateAiLandingPageInput {
  html: string;
  copyframe: Copyframe;
  prompt: string;
  criteria: LandingPageCriteria;
  status: LandingPageStatus;
}

function landingPagesCol(uid: string, projectId: string) {
  return collection(
    getFirebaseFirestore(),
    "users", uid, "projects", projectId, "ai-landing-pages"
  );
}

export async function createAiLandingPage(
  uid: string, projectId: string, input: CreateAiLandingPageInput
): Promise<string> {
  const ref = await addDoc(landingPagesCol(uid, projectId), {
    ...input,
    createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
  });
  return ref.id;
}

export async function updateAiLandingPageHtml(
  uid: string, projectId: string, pageId: string, html: string
): Promise<void> {
  await updateDoc(
    doc(getFirebaseFirestore(), "users", uid, "projects", projectId, "ai-landing-pages", pageId),
    { html, status: "done" }
  );
}

export async function failAiLandingPage(
  uid: string, projectId: string, pageId: string
): Promise<void> {
  await updateDoc(
    doc(getFirebaseFirestore(), "users", uid, "projects", projectId, "ai-landing-pages", pageId),
    { status: "failed" }
  );
}

export async function deleteAiLandingPage(
  uid: string, projectId: string, pageId: string
): Promise<void> {
  await deleteDoc(
    doc(getFirebaseFirestore(), "users", uid, "projects", projectId, "ai-landing-pages", pageId)
  );
}

export function subscribeToAiLandingPages(
  uid: string, projectId: string,
  cb: (pages: AiLandingPage[]) => void
): () => void {
  const q = query(landingPagesCol(uid, projectId), orderBy("createdAt", "desc"));
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<AiLandingPage, "id">) })));
  });
}
