"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, BellRing, Check, Trash2 } from "lucide-react";
import { useNotifications } from "@/lib/contexts/notifications-context";
import { NotificationContent } from "@/components/notifications/notification-item";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { LiquidButton } from "@/components/ui/liquid-button";
import { EmptyState } from "@/components/ui/empty-state";
import { useRouter } from "next/navigation";

type Filter = "all" | "unread";

export default function NotificationsPage() {
  const router = useRouter();
  const { items, unread, loading, error, markRead, markAllRead, remove } = useNotifications();
  const [filter, setFilter] = useState<Filter>("all");

  const visible = filter === "unread" ? items.filter((n) => !n.read) : items;

  return (
    <div style={{ padding: "32px 16px 48px", display: "flex", flexDirection: "column", gap: 24 }}>
      <header className="page-header" style={{ alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 className="page-title">Notifications</h1>
          <span className="page-sub" style={{ fontSize: 14 }}>
            {unread > 0 ? `${unread} unread` : "You’re all caught up"} · plans, creatives, failures and credits
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button type="button" className="btn-secondary glass-inner" style={{ width: "auto", minHeight: 44, padding: "0 18px" }} disabled={unread === 0} onClick={() => markAllRead().catch(() => {})}>
            <Check size={15} aria-hidden /> Mark all read
          </button>
        </div>
      </header>

      <SegmentedControl
        ariaLabel="Filter notifications"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "All", count: items.length },
          { value: "unread", label: "Unread", count: unread },
        ]}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {loading ? (
          [1, 2, 3].map((i) => <div key={i} className="shimmer" style={{ height: 84, borderRadius: 22 }} />)
        ) : error ? (
          <EmptyState
            icon={<Bell size={24} />}
            title="Notifications aren’t available yet"
            description="They couldn’t be loaded. If you just updated the app, the database rules may still need to be deployed."
            action={<LiquidButton onClick={() => router.push("/dashboard")}>Back to dashboard</LiquidButton>}
          />
        ) : visible.length === 0 ? (
          filter === "unread" && items.length > 0 ? (
            <EmptyState
              icon={<BellRing size={24} />}
              title="No unread notifications"
              description="Everything has been read."
              action={<LiquidButton onClick={() => setFilter("all")}>Show all notifications</LiquidButton>}
            />
          ) : (
            <EmptyState
              icon={<BellRing size={24} />}
              title="Nothing here yet"
              description="We’ll tell you when a plan is ready, creatives finish, a generation fails (credits refunded) or your credits run low."
              action={<LiquidButton onClick={() => router.push("/projects")}>Go to projects</LiquidButton>}
            />
          )
        ) : (
          visible.map((n) => (
            <article key={n.id} className="glass notif-card">
              {n.href ? (
                <Link
                  href={n.href}
                  className="notif-row"
                  style={{ flex: 1, minWidth: 0 }}
                  onClick={() => { if (!n.read) markRead(n.id).catch(() => {}); }}
                >
                  <NotificationContent n={n} />
                </Link>
              ) : (
                <div className="notif-row" style={{ flex: 1, minWidth: 0, cursor: "default" }}>
                  <NotificationContent n={n} />
                </div>
              )}
              <div style={{ display: "flex", gap: 2 }}>
                {!n.read && (
                  <button type="button" className="icon-btn-sm" aria-label={`Mark “${n.title}” as read`} onClick={() => markRead(n.id).catch(() => {})}>
                    <Check size={16} />
                  </button>
                )}
                <button type="button" className="icon-btn-sm" aria-label={`Delete “${n.title}”`} onClick={() => remove(n.id).catch(() => {})}>
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
