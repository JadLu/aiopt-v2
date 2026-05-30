"use client";

import {
  collection, addDoc, onSnapshot, query, orderBy,
  serverTimestamp, type Unsubscribe, doc, updateDoc, deleteDoc,
} from "firebase/firestore";
import { getFirebaseFirestore } from "./firestore";

export interface AiCreative {
  id: string;
  prompt: string;
  imageUrl: string;
  taskId?: string;
  status?: "pending" | "done" | "failed";
  aspectRatio: string;
  resolution: string;
  createdAt: string;
}

export interface CreateAiCreativeInput {
  prompt: string;
  imageUrl: string;
  aspectRatio: string;
  resolution: string;
  taskId?: string;
  status?: "pending" | "done" | "failed";
}

export async function createAiCreative(
  uid: string,
  projectId: string,
  input: CreateAiCreativeInput
): Promise<string> {
  const db = getFirebaseFirestore();
  const colRef = collection(db, "users", uid, "projects", projectId, "ai-creatives");
  const docRef = await addDoc(colRef, { ...input, createdAt: serverTimestamp() });
  return docRef.id;
}

export async function updateAiCreativeImageUrl(
  uid: string,
  projectId: string,
  creativeId: string,
  imageUrl: string
): Promise<void> {
  const db = getFirebaseFirestore();
  await updateDoc(
    doc(db, "users", uid, "projects", projectId, "ai-creatives", creativeId),
    { imageUrl, status: "done" }
  );
}

export async function failAiCreative(
  uid: string,
  projectId: string,
  creativeId: string
): Promise<void> {
  const db = getFirebaseFirestore();
  await updateDoc(
    doc(db, "users", uid, "projects", projectId, "ai-creatives", creativeId),
    { status: "failed" }
  );
}

export async function deleteAiCreative(
  uid: string,
  projectId: string,
  creativeId: string
): Promise<void> {
  const db = getFirebaseFirestore();
  await deleteDoc(doc(db, "users", uid, "projects", projectId, "ai-creatives", creativeId));
}

export function subscribeToAiCreatives(
  uid: string,
  projectId: string,
  cb: (creatives: AiCreative[]) => void
): Unsubscribe {
  const db = getFirebaseFirestore();
  const q = query(
    collection(db, "users", uid, "projects", projectId, "ai-creatives"),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snapshot) => {
    const creatives: AiCreative[] = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        prompt: data.prompt as string,
        imageUrl: (data.imageUrl as string) ?? "",
        taskId: data.taskId as string | undefined,
        status: data.status as "pending" | "done" | "failed" | undefined,
        aspectRatio: data.aspectRatio as string,
        resolution: data.resolution as string,
        createdAt: (data.createdAt as { toDate?: () => Date })?.toDate
          ? (data.createdAt as { toDate: () => Date }).toDate().toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
      };
    });
    cb(creatives);
  });
}
