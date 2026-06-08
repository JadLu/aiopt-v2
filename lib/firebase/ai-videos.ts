"use client";

import { getFirebaseFirestore } from "./firestore";
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, orderBy, query,
} from "firebase/firestore";

export type VideoStatus = "pending" | "done" | "failed";

export interface AiVideo {
  id: string;
  prompt: string;
  videoUrl: string;
  taskId?: string;
  status?: VideoStatus;
  aspectRatio: string;
  duration: string;   // "5" | "8" | "10"
  resolution: string; // "720p" | "1080p" | "4k"
  createdAt: string;
}

export interface CreateAiVideoInput {
  prompt: string;
  videoUrl: string;
  aspectRatio: string;
  duration: string;
  resolution: string;
  taskId?: string;
  status?: VideoStatus;
}

function videosCol(uid: string, projectId: string) {
  return collection(getFirebaseFirestore(), "users", uid, "projects", projectId, "ai-videos");
}

export async function createAiVideo(
  uid: string, projectId: string, input: CreateAiVideoInput
): Promise<string> {
  const ref = await addDoc(videosCol(uid, projectId), {
    ...input,
    createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
  });
  return ref.id;
}

export async function updateAiVideoUrl(
  uid: string, projectId: string, videoId: string, videoUrl: string
): Promise<void> {
  await updateDoc(
    doc(getFirebaseFirestore(), "users", uid, "projects", projectId, "ai-videos", videoId),
    { videoUrl, status: "done" }
  );
}

export async function failAiVideo(uid: string, projectId: string, videoId: string): Promise<void> {
  await updateDoc(
    doc(getFirebaseFirestore(), "users", uid, "projects", projectId, "ai-videos", videoId),
    { status: "failed", taskId: null }
  );
}

export async function deleteAiVideo(uid: string, projectId: string, videoId: string): Promise<void> {
  await deleteDoc(
    doc(getFirebaseFirestore(), "users", uid, "projects", projectId, "ai-videos", videoId)
  );
}

export function subscribeToAiVideos(
  uid: string, projectId: string,
  cb: (videos: AiVideo[]) => void
): () => void {
  const q = query(videosCol(uid, projectId), orderBy("createdAt", "desc"));
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<AiVideo, "id">) })));
  });
}
