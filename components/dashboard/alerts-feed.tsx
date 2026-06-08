import type { AdAlert } from "@/lib/firebase/ad-alerts";
import { Bell, CheckCircle2 } from "lucide-react";

const TIER_LABEL: Record<AdAlert["tier"], string> = { red: "Critical", yellow: "Warning" };

function formatMetricValue(metric: string, value: number): string {
  switch (metric) {
    case "CPA":   return `$${value.toFixed(2)}`;
    case "ROAS":  return `${value.toFixed(1)}x`;
    case "CTR":   return `${value.toFixed(2)}%`;
    case "spend": return value >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${value.toFixed(0)}`;
    default:      return value.toFixed(1);
  }
}

function formatRelativeTime(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60)   return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function AlertsFeed({ alerts }: { alerts: AdAlert[] }) {
  const criticalCount = alerts.filter((a) => a.tier === "red").length;

  return (
    <div className="glass-card" style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Bell size={16} strokeWidth={1.8} color="var(--text-secondary)" />
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.2px" }}>Alerts</span>
        </div>
        {criticalCount > 0 && (
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            minWidth: 20, height: 20, padding: "0 6px", borderRadius: 999,
            background: "var(--danger)", color: "#fff", fontSize: 11, fontWeight: 700,
          }}>
            {criticalCount}
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "24px 0", textAlign: "center" }}>
          <CheckCircle2 size={28} strokeWidth={1.4} color="var(--success)" style={{ opacity: 0.7 }} />
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", margin: 0 }}>All clear</p>
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0, lineHeight: 1.5 }}>
            No active alerts.<br />Connect Meta Ads to start monitoring.
          </p>
        </div>
      ) : (
        <div>
          {alerts.map((alert) => (
            <div key={alert.id} className="alert-item">
              <div className={`alert-dot ${alert.tier}`} style={{ marginTop: 5 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {alert.campaignName}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>
                  {alert.metric}: <strong>{formatMetricValue(alert.metric, alert.value)}</strong>
                  {" · "}threshold {formatMetricValue(alert.metric, alert.threshold)}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                  {TIER_LABEL[alert.tier]} · {formatRelativeTime(alert.createdAt)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
