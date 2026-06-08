"use client";

import { getFirebaseFirestore } from "./firestore";
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, orderBy, query,
} from "firebase/firestore";

export interface VideoClip {
  id: string;
  name: string;
  videoUrl: string;
  hookEnd: number;
  bodyEnd: number;
  totalDuration: number;
  createdAt: string;
}

export interface CreateVideoClipInput {
  name: string;
  videoUrl: string;
  hookEnd: number;
  bodyEnd: number;
  totalDuration: number;
}

function clipsCol(uid: string, projectId: string) {
  return collection(getFirebaseFirestore(), "users", uid, "projects", projectId, "video-clips");
}

export async function createVideoClip(
  uid: string, projectId: string, input: CreateVideoClipInput
): Promise<string> {
  const ref = await addDoc(clipsCol(uid, projectId), {
    ...input,
    createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
  });
  return ref.id;
}

export async function updateVideoClipTimestamps(
  uid: string, projectId: string, clipId: string,
  data: { hookEnd: number; bodyEnd: number }
): Promise<void> {
  await updateDoc(doc(getFirebaseFirestore(), "users", uid, "projects", projectId, "video-clips", clipId), data);
}

export async function deleteVideoClip(uid: string, projectId: string, clipId: string): Promise<void> {
  await deleteDoc(doc(getFirebaseFirestore(), "users", uid, "projects", projectId, "video-clips", clipId));
}

export function subscribeToVideoClips(
  uid: string, projectId: string,
  cb: (clips: VideoClip[]) => void
): () => void {
  const q = query(clipsCol(uid, projectId), orderBy("createdAt", "desc"));
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<VideoClip, "id">) })));
  });
}
