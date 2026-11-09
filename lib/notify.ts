import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import type { NotificationType } from "@/lib/notification-types";

/**
 * Server-only. Writes in-app notifications to users/{uid}/notifications.
 * Clients can read them (and mark them read) but never create them, see firestore.rules.
 * Notifying must never break the request that triggers it, so every helper swallows errors.
 */

interface NotifyInput {
  type: NotificationType;
  title: string;
  body: string;
  href?: string;
  /** Deterministic doc id: makes the notification idempotent (a second call with the same id is ignored). */
  id?: string;
}

export async function notify(uid: string, n: NotifyInput): Promise<void> {
  try {
    const col = getAdminFirestore().collection("users").doc(uid).collection("notifications");
    const data = {
      type: n.type,
      title: n.title,
      body: n.body,
      ...(n.href ? { href: n.href } : {}),
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    };
    if (n.id) await col.doc(n.id).create(data);
    else await col.add(data);
  } catch (err) {
    // 6 = ALREADY_EXISTS: the idempotent write was already done by an earlier call.
    if ((err as { code?: number }).code === 6) return;
    console.error("[notify] failed:", err instanceof Error ? err.message : err);
  }
}

/** Reads the project's display name for notification text (falls back to a generic label). */
export async function projectLabel(uid: string, projectId: string | undefined): Promise<string> {
  if (!projectId) return "your project";
  try {
    const snap = await getAdminFirestore().collection("users").doc(uid).collection("projects").doc(projectId).get();
    const name = snap.data()?.name;
    return typeof name === "string" && name ? `“${name}”` : "your project";
  } catch {
    return "your project";
  }
}

export function projectHref(projectId: string | undefined): string | undefined {
  return projectId ? `/projects/${projectId}` : undefined;
}

/** Once per day at most, when a charge takes the balance below the threshold. */
export async function notifyLowCredits(uid: string, balance: number): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  await notify(uid, {
    id: `credits-low-${day}`,
    type: "credits_low",
    title: "Credits running low",
    body: `You have ${balance} credit${balance === 1 ? "" : "s"} left. A marketing plan costs ${CREDIT_COSTS.MARKETING_PLAN}.`,
  });
}
