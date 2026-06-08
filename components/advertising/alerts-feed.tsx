"use client";

import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import type { AdAlert } from "@/lib/firebase/ad-alerts";
import { timeAgo } from "@/lib/advertising-utils";

interface Props {
  alerts: AdAlert[];
  onResolve: (alertId: string) => void;
}

const tierConfig = {
  red: {
    border: "var(--danger)",
    bg: "rgba(229,118,118,0.06)",
    icon: XCircle,
    iconColor: "var(--danger)",
    label: "Critical",
  },
  yellow: {
    border: "var(--warning)",
    bg: "rgba(232,181,71,0.06)",
    icon: AlertTriangle,
    iconColor: "var(--warning)",
    label: "Warning",
  },
};

const metricLabels: Record<string, string> = {
  CPA: "Cost per Acquisition",
  ROAS: "Return on Ad Spend",
  CTR: "Click-through Rate",
  frequency: "Ad Frequency",
  spend: "Total Spend",
};

export function AlertsFeed({ alerts, onResolve }: Props) {
  if (alerts.length === 0) {
    return (
      <div
        style={{
          padding: 48,
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          color: "var(--text-tertiary)",
        }}
      >
        <CheckCircle size={32} style={{ color: "var(--success)" }} />
        <div style={{ fontSize: 14 }}>No open alerts — all campaigns are healthy.</div>
      </div>
    );
  }

  const sorted = [...alerts].sort((a, b) => {
    if (a.tier !== b.tier) return a.tier === "red" ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {sorted.map((alert) => {
        const cfg = tierConfig[alert.tier];
        const Icon = cfg.icon;

        return (
          <div
            key={alert.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 14,
              padding: "14px 16px",
              borderRadius: "var(--radius-md)",
              background: cfg.bg,
              borderLeft: `3px solid ${cfg.border}`,
            }}
          >
            <Icon
              size={18}
              style={{ color: cfg.iconColor, marginTop: 1, flexShrink: 0 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  fontSize: 13,
                  marginBottom: 2,
                }}
              >
                {alert.campaignName}
              </div>
              <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>
                {metricLabels[alert.metric] ?? alert.metric}: &nbsp;
                <strong style={{ color: cfg.iconColor }}>{alert.value.toFixed(2)}</strong>
                &nbsp;(threshold: {alert.threshold})
              </div>
              <div style={{ color: "var(--text-tertiary)", fontSize: 11, marginTop: 4 }}>
                {timeAgo(alert.createdAt)}
              </div>
            </div>
            <button
              onClick={() => onResolve(alert.id)}
              style={{
                background: "none",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-md)",
                padding: "3px 10px",
                fontSize: 11,
                color: "var(--text-secondary)",
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              Resolve
            </button>
          </div>
        );
      })}
    </div>
  );
}
