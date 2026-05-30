"use client";

import {
  collection,
  addDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseFirestore } from "./firestore";
import type { Project, MarketAnalysisData, PlanVisualData } from "@/lib/mock-data";

const EMOJI_POOL = ["📦", "🛍️", "💄", "📱", "🎮", "👟", "🏋️", "🌿", "✨", "🔧", "🎯", "🚀"];

export interface CreateProjectInput {
  name: string;
  description: string;
  country: string;
  targetCpa: number;
  targetRoas: number;
}

function docToProject(id: string, d: Record<string, unknown>): Project {
  return {
    id,
    name: d.name as string,
    description: d.description as string,
    emoji: d.emoji as string,
    status: d.status as Project["status"],
    country: d.country as string,
    targetCpa: (d.targetCpa as number) ?? 0,
    targetRoas: (d.targetRoas as number) ?? 0,
    healthIndex: (d.healthIndex as number) ?? 0,
    cpa: (d.cpa as number) ?? 0,
    roas: (d.roas as number) ?? 0,
    spend: (d.spend as number) ?? 0,
    lastActivity: (d.lastActivity as { toDate?: () => Date })?.toDate
      ? formatRelativeTime((d.lastActivity as { toDate: () => Date }).toDate())
      : "just now",
    createdAt: (d.createdAt as { toDate?: () => Date })?.toDate
      ? (d.createdAt as { toDate: () => Date }).toDate().toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
    marketingPlan: d.marketingPlan as string | undefined,
    marketAnalysisData: (() => {
      const raw = d.marketAnalysisData;
      if (!raw) return undefined;
      if (typeof raw === "string") {
        try { return JSON.parse(raw) as MarketAnalysisData; } catch { return undefined; }
      }
      return raw as MarketAnalysisData;
    })(),
    planVisualData: (() => {
      const raw = d.planVisualData;
      if (!raw) return undefined;
      if (typeof raw === "string") {
        try { return JSON.parse(raw) as PlanVisualData; } catch { return undefined; }
      }
      return raw as PlanVisualData;
    })(),
    productImageUrl: d.productImageUrl as string | undefined,
  };
}

export async function createProject(uid: string, input: CreateProjectInput): Promise<string> {
  const db = getFirebaseFirestore();
  const colRef = collection(db, "users", uid, "projects");
  const emoji = EMOJI_POOL[Math.floor(Math.random() * EMOJI_POOL.length)];

  const docRef = await addDoc(colRef, {
    name: input.name,
    description: input.description,
    emoji,
    status: "in-draft",
    country: input.country,
    targetCpa: input.targetCpa,
    targetRoas: input.targetRoas,
    healthIndex: 0,
    cpa: 0,
    roas: 0,
    spend: 0,
    lastActivity: serverTimestamp(),
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}

export async function deleteProject(uid: string, projectId: string): Promise<void> {
  const db = getFirebaseFirestore();
  await deleteDoc(doc(db, "users", uid, "projects", projectId));
}

export async function updateProject(
  uid: string,
  projectId: string,
  data: Partial<{ marketingPlan: string; marketAnalysisData: MarketAnalysisData | null; planVisualData: PlanVisualData | null; productImageUrl: string; status: Project["status"] }>
): Promise<void> {
  const db = getFirebaseFirestore();
  await updateDoc(doc(db, "users", uid, "projects", projectId), {
    ...data,
    lastActivity: serverTimestamp(),
  });
}

export async function getProject(uid: string, projectId: string): Promise<Project | null> {
  const db = getFirebaseFirestore();
  const snap = await getDoc(doc(db, "users", uid, "projects", projectId));
  if (!snap.exists()) return null;
  return docToProject(snap.id, snap.data() as Record<string, unknown>);
}

export function subscribeToProject(
  uid: string,
  projectId: string,
  cb: (project: Project | null) => void
): Unsubscribe {
  const db = getFirebaseFirestore();
  return onSnapshot(doc(db, "users", uid, "projects", projectId), (snap) => {
    cb(snap.exists() ? docToProject(snap.id, snap.data() as Record<string, unknown>) : null);
  });
}

export function subscribeToProjects(
  uid: string,
  cb: (projects: Project[]) => void
): Unsubscribe {
  const db = getFirebaseFirestore();
  const q = query(
    collection(db, "users", uid, "projects"),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const projects = snapshot.docs.map((d) =>
      docToProject(d.id, d.data() as Record<string, unknown>)
    );
    cb(projects);
  });
}

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
