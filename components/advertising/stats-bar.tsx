"use client";

import { DollarSign, TrendingUp, Activity, Bell } from "lucide-react";
import type { MetaCampaign } from "@/lib/firebase/meta-campaigns";
import type { AdAlert } from "@/lib/firebase/ad-alerts";
import { formatCurrency } from "@/lib/advertising-utils";

interface Props {
  campaigns: MetaCampaign[];
  alerts: AdAlert[];
}

export function StatsBar({ campaigns, alerts }: Props) {
  const activeCampaigns = campaigns.filter(
    (c) => c.status === "ACTIVE"
  ).length;

  const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);

  const campaignsWithRoas = campaigns.filter((c) => c.roas > 0);
  const avgRoas =
    campaignsWithRoas.length > 0
      ? campaignsWithRoas.reduce((sum, c) => sum + c.roas, 0) /
        campaignsWithRoas.length
      : 0;

  const openAlerts = alerts.length;

  const stats = [
    {
      label: "Total Spend",
      value: formatCurrency(totalSpend),
      icon: DollarSign,
      color: "var(--accent-primary)",
    },
    {
      label: "Avg ROAS",
      value: avgRoas > 0 ? `${avgRoas.toFixed(2)}x` : "—",
      icon: TrendingUp,
      color: "var(--success)",
    },
    {
      label: "Active Campaigns",
      value: String(activeCampaigns),
      icon: Activity,
      color: "var(--accent-secondary)",
    },
    {
      label: "Open Alerts",
      value: String(openAlerts),
      icon: Bell,
      color: openAlerts > 0 ? "var(--danger)" : "var(--text-tertiary)",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 16,
        marginBottom: 24,
      }}
    >
      {stats.map((s) => (
        <div
          key={s.label}
          className="card"
          style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "var(--radius-md)",
              background: `${s.color}18`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <s.icon size={18} style={{ color: s.color }} />
          </div>
          <div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "var(--text-primary)",
                lineHeight: 1.2,
              }}
            >
              {s.value}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
              {s.label}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
