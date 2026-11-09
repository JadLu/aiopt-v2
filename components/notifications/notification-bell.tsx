"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { useNotifications } from "@/lib/contexts/notifications-context";
import { NotificationContent } from "./notification-item";
import type { AppNotification } from "@/lib/notification-types";

const PREVIEW_COUNT = 6;

/** Glass bell button with an unread badge and a short list of the latest notifications. */
export function NotificationBell() {
  const router = useRouter();
  const { items, unread, loading, error, markRead, markAllRead } = useNotifications();
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const open = pos !== null;

  useEffect(() => {
    if (!open) return;
    const close = () => setPos(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setPos(null); btnRef.current?.focus(); }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  function openItem(n: AppNotification) {
    setPos(null);
    if (!n.read) markRead(n.id).catch(() => {});
    if (n.href) router.push(n.href);
  }

  const preview = items.slice(0, PREVIEW_COUNT);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="glass icon-glass bell-btn"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(e) => {
          if (open) { setPos(null); return; }
          const rect = e.currentTarget.getBoundingClientRect();
          setPos({ top: rect.bottom + 8, right: Math.max(12, window.innerWidth - rect.right) });
        }}
      >
        <Bell size={18} strokeWidth={1.8} />
        {unread > 0 && <span className="bell-badge tabular" aria-hidden>{unread > 9 ? "9+" : unread}</span>}
      </button>

      {pos && createPortal(
        <div
          role="dialog"
          aria-label="Notifications"
          className="glass notif-pop"
          onMouseDown={(e) => e.stopPropagation()}
          style={{ top: pos.top, right: pos.right }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 8px" }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Notifications</h2>
            <button type="button" className="sidebar-link" disabled={unread === 0} onClick={() => markAllRead().catch(() => {})}>
              Mark all read
            </button>
          </div>

          <div style={{ maxHeight: 380, overflowY: "auto", padding: "0 8px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
            {preview.map((n) => (
              <button key={n.id} type="button" className="notif-row" onClick={() => openItem(n)}>
                <NotificationContent n={n} />
              </button>
            ))}
            {preview.length === 0 && (
              <p style={{ margin: 0, padding: "18px 12px", fontSize: 13.5, color: "var(--text-secondary)" }}>
                {loading ? "Loading…" : error ? "Notifications aren’t available right now." : "You’re all caught up. Plan and creative updates will show up here."}
              </p>
            )}
          </div>

          <Link href="/notifications" className="notif-foot" onClick={() => setPos(null)}>
            See all notifications
          </Link>
        </div>,
        document.body
      )}
    </>
  );
}
