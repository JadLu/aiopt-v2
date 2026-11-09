import { ClipboardCheck, Sparkles, AlertTriangle, Zap } from "lucide-react";
import type { AppNotification, NotificationType } from "@/lib/notification-types";
import { timeAgo } from "@/lib/format-time";

const ICONS: Record<NotificationType, typeof Zap> = {
  plan_ready: ClipboardCheck,
  creatives_ready: Sparkles,
  generation_failed: AlertTriangle,
  credits_low: Zap,
};

export function NotificationIcon({ type }: { type: NotificationType }) {
  const Icon = ICONS[type] ?? Zap;
  return (
    <span className={`notif-icon ${type}`} aria-hidden>
      <Icon size={16} strokeWidth={1.9} />
    </span>
  );
}

/** Icon + text + time for one notification. Rendered inside a button/link by the caller. */
export function NotificationContent({ n }: { n: AppNotification }) {
  return (
    <>
      <NotificationIcon type={n.type} />
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2, textAlign: "left" }}>
        <span style={{ fontSize: 13.5, fontWeight: n.read ? 500 : 700, color: "var(--text-primary)" }}>{n.title}</span>
        <span dir="auto" style={{ fontSize: 12.5, lineHeight: 1.45, color: "var(--text-secondary)" }}>{n.body}</span>
        <span className="tabular" style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>{timeAgo(n.createdAt)}</span>
      </span>
      {!n.read && <span className="notif-dot" aria-label="Unread" />}
    </>
  );
}
