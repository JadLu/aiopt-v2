"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/contexts/auth-context";
import {
  subscribeToNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification,
} from "@/lib/firebase/notifications";
import type { AppNotification } from "@/lib/notification-types";

interface NotificationsValue {
  items: AppNotification[];
  unread: number;
  /** True until the first snapshot (or error) arrives. */
  loading: boolean;
  /** The list couldn't be read (for example the Firestore rules aren't deployed yet). */
  error: boolean;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsValue | null>(null);

type Snapshot = { uid: string | null; items: AppNotification[]; error: boolean };

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  // Keyed by uid so a different user never sees the previous user's list.
  const [snap, setSnap] = useState<Snapshot>({ uid: null, items: [], error: false });

  useEffect(() => {
    if (!uid) return;
    return subscribeToNotifications(
      uid,
      (items) => setSnap({ uid, items, error: false }),
      () => setSnap({ uid, items: [], error: true })
    );
  }, [uid]);

  const value = useMemo<NotificationsValue>(() => {
    const current = snap.uid === uid;
    const items = current ? snap.items : [];
    return {
      items,
      unread: items.filter((n) => !n.read).length,
      loading: !!uid && !current,
      error: current && snap.error,
      markRead: async (id) => { if (uid) await markNotificationRead(uid, id); },
      markAllRead: async () => { if (uid) await markAllNotificationsRead(uid, items.filter((n) => !n.read).map((n) => n.id)); },
      remove: async (id) => { if (uid) await deleteNotification(uid, id); },
    };
  }, [snap, uid]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used inside <NotificationsProvider>");
  return ctx;
}
