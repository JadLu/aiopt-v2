"use client";

// Client side of in-app notifications. Documents are CREATED by the server only
// (lib/notify.ts); the client can list them, mark them read and delete them.

import {
  collection, query, orderBy, limit, onSnapshot, doc, updateDoc, deleteDoc, writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseFirestore } from "./firestore";
import type { AppNotification, NotificationType } from "@/lib/notification-types";

const MAX_LISTED = 50;

function col(uid: string) {
  return collection(getFirebaseFirestore(), "users", uid, "notifications");
}

export function subscribeToNotifications(
  uid: string,
  cb: (items: AppNotification[]) => void,
  onError?: () => void
): Unsubscribe {
  const q = query(col(uid), orderBy("createdAt", "desc"), limit(MAX_LISTED));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => {
        const data = d.data();
        const ts = data.createdAt as { toMillis?: () => number } | null | undefined;
        return {
          id: d.id,
          type: data.type as NotificationType,
          title: String(data.title ?? ""),
          body: String(data.body ?? ""),
          href: typeof data.href === "string" ? data.href : undefined,
          read: data.read === true,
          // A just-written doc has a null server timestamp until the server confirms it.
          createdAt: ts?.toMillis?.() ?? Date.now(),
        };
      }));
    },
    () => onError?.()
  );
}

export async function markNotificationRead(uid: string, id: string): Promise<void> {
  await updateDoc(doc(col(uid), id), { read: true });
}

export async function markAllNotificationsRead(uid: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const batch = writeBatch(getFirebaseFirestore());
  for (const id of ids) batch.update(doc(col(uid), id), { read: true });
  await batch.commit();
}

export async function deleteNotification(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(col(uid), id));
}
