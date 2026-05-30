"use client";

import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseFirestore } from "./firestore";
import type { Creative } from "@/lib/mock-data";

export interface CreateCreativeInput {
  name: string;
  type: "photo" | "video";
  url: string;
}

export async function createCreative(
  uid: string,
  projectId: string,
  input: CreateCreativeInput
): Promise<string> {
  const db = getFirebaseFirestore();
  const colRef = collection(db, "users", uid, "projects", projectId, "creatives");
  const docRef = await addDoc(colRef, {
    name: input.name,
    type: input.type,
    url: input.url,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export function subscribeToCreatives(
  uid: string,
  projectId: string,
  cb: (creatives: Creative[]) => void
): Unsubscribe {
  const db = getFirebaseFirestore();
  const q = query(
    collection(db, "users", uid, "projects", projectId, "creatives"),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const creatives: Creative[] = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name as string,
        type: data.type as "photo" | "video",
        url: data.url as string,
        createdAt: (data.createdAt as { toDate?: () => Date })?.toDate
          ? (data.createdAt as { toDate: () => Date }).toDate().toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
      };
    });
    cb(creatives);
  });
}
