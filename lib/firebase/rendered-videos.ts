"use client";

import { getFirebaseFirestore } from "./firestore";
import {
  collection, addDoc, deleteDoc, doc,
  onSnapshot, orderBy, query,
} from "firebase/firestore";

export interface RenderedVideo {
  id: string;
  videoUrl: string;
  durationSec: number;
  clipCount: number;
  createdAt: string;
}

export interface CreateRenderedVideoInput {
  videoUrl: string;
  durationSec: number;
  clipCount: number;
}

function renderedCol(uid: string, projectId: string) {
  return collection(
    getFirebaseFirestore(),
    "users", uid, "projects", projectId, "rendered-videos"
  );
}

export async function createRenderedVideo(
  uid: string, projectId: string, input: CreateRenderedVideoInput
): Promise<string> {
  const ref = await addDoc(renderedCol(uid, projectId), {
    ...input,
    createdAt: new Date().toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    }),
  });
  return ref.id;
}

export async function deleteRenderedVideo(
  uid: string, projectId: string, videoId: string
): Promise<void> {
  await deleteDoc(
    doc(getFirebaseFirestore(), "users", uid, "projects", projectId, "rendered-videos", videoId)
  );
}

export function subscribeToRenderedVideos(
  uid: string,
  projectId: string,
  cb: (videos: RenderedVideo[]) => void
): () => void {
  const q = query(renderedCol(uid, projectId), orderBy("createdAt", "desc"));
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<RenderedVideo, "id">) })));
  });
}
