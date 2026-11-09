import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";

/**
 * Server-only. Async KIE jobs (image/video) are recorded at
 * users/{uid}/jobs/{taskId} so that status polling is limited to the owner
 * and a failed job is refunded exactly once.
 */

export type JobKind = "image" | "video";
export type JobStatus = "pending" | "done" | "failed";

export interface Job {
  uid: string;
  cost: number;
  kind: JobKind;
  status: JobStatus;
  refunded: boolean;
  createdAtMs: number;
  /** Project the job belongs to (used for notification text and links). */
  projectId?: string;
}

/** A job still pending after this long is treated as failed (and refunded). */
export const JOB_STALE_MS = 10 * 60 * 1000;

function jobRef(uid: string, taskId: string) {
  return getAdminFirestore().collection("users").doc(uid).collection("jobs").doc(taskId);
}

export async function createJob(
  uid: string,
  taskId: string,
  data: { cost: number; kind: JobKind; projectId?: string }
): Promise<void> {
  await jobRef(uid, taskId).set({
    uid,
    cost: data.cost,
    kind: data.kind,
    status: "pending",
    refunded: false,
    ...(data.projectId ? { projectId: data.projectId } : {}),
    createdAtMs: Date.now(),
    createdAt: FieldValue.serverTimestamp(),
  });
}

/** Returns the job only if it exists under the caller's own uid and kind matches. */
export async function getOwnedJob(uid: string, taskId: string, kind: JobKind): Promise<Job | null> {
  const snap = await jobRef(uid, taskId).get();
  if (!snap.exists) return null;
  const job = snap.data() as Job;
  if (job.uid !== uid || job.kind !== kind) return null;
  return job;
}

export async function markJobDone(uid: string, taskId: string): Promise<void> {
  await jobRef(uid, taskId).update({ status: "done" }).catch(() => { /* ignore */ });
}

/**
 * Marks the job failed and returns its cost to the user in ONE transaction,
 * only if it hasn't been refunded yet. Safe to call on every poll.
 * Returns true if a refund was issued by this call.
 */
export async function refundJobOnce(uid: string, taskId: string): Promise<boolean> {
  const db = getAdminFirestore();
  const jRef = jobRef(uid, taskId);
  const uRef = db.collection("users").doc(uid);
  return db.runTransaction(async (tx) => {
    const [jSnap, uSnap] = await Promise.all([tx.get(jRef), tx.get(uRef)]);
    if (!jSnap.exists) return false;
    const job = jSnap.data() as Job;
    if (job.uid !== uid || job.refunded || job.status === "done") return false;
    const balance: number = uSnap.data()?.credits ?? 0;
    tx.set(uRef, { credits: balance + job.cost }, { merge: true });
    tx.update(jRef, { refunded: true, status: "failed" });
    return true;
  });
}
