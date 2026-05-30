import type { Alert } from "@/lib/mock-data";
import { Bell } from "lucide-react";

const TIER_LABEL = { red: "Critical", yellow: "Warning", green: "Healthy" };

export function AlertsFeed({ alerts }: { alerts: Alert[] }) {
  return (
    <div className="card" style={{ padding: "18px 20px" }}>
      <div className="section-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Bell size={15} strokeWidth={1.8} color="var(--text-secondary)" />
          <span className="section-title">Alerts</span>
        </div>
        {alerts.filter((a) => a.tier === "red").length > 0 && (
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 20, height: 20, borderRadius: "50%",
            background: "var(--danger)", color: "white", fontSize: 11, fontWeight: 700,
          }}>
            {alerts.filter((a) => a.tier === "red").length}
          </span>
        )}
      </div>

      <div>
        {alerts.map((alert) => (
          <div key={alert.id} className="alert-item">
            <div className={`alert-dot ${alert.tier}`} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {alert.campaign}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                {alert.metric}: <strong>{alert.value}</strong> (threshold: {alert.threshold})
              </div>
              <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>
                {TIER_LABEL[alert.tier]} · {alert.time}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
