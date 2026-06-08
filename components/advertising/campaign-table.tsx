"use client";

import { useState } from "react";
import { authFetch } from "@/lib/auth-fetch";
import { ChevronUp, ChevronDown, Pause, Play, Loader2 } from "lucide-react";
import type { MetaCampaign } from "@/lib/firebase/meta-campaigns";
import { CampaignHealthBadge } from "./campaign-health-badge";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/advertising-utils";

type SortKey = keyof Pick<
  MetaCampaign,
  "name" | "spend" | "impressions" | "ctr" | "cpc" | "roas" | "cpa" | "healthScore"
>;

interface Props {
  campaigns: MetaCampaign[];
  accessToken: string;
  onCampaignUpdated: (campaignId: string, newStatus: MetaCampaign["status"]) => void;
}

const tierRowBg: Record<string, string> = {
  green:  "rgba(76,183,130,0.06)",
  yellow: "rgba(232,181,71,0.06)",
  red:    "rgba(229,118,118,0.06)",
};

export function CampaignTable({ campaigns, accessToken, onCampaignUpdated }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortAsc, setSortAsc] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  const sorted = [...campaigns].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === "string" && typeof bv === "string") {
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    const an = av as number;
    const bn = bv as number;
    return sortAsc ? an - bn : bn - an;
  });

  async function handleAction(campaign: MetaCampaign) {
    const action = campaign.status === "ACTIVE" ? "PAUSE" : "ACTIVE";
    setActionLoading(campaign.id);
    try {
      const res = await authFetch("/api/meta/campaign-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: campaign.id,
          action,
          accessToken,
        }),
      });
      if (res.ok) {
        const newStatus = action === "PAUSE" ? "PAUSED" : "ACTIVE";
        onCampaignUpdated(campaign.id, newStatus as MetaCampaign["status"]);
      }
    } finally {
      setActionLoading(null);
    }
  }

  const cols: { key: SortKey; label: string; align?: "right" }[] = [
    { key: "name", label: "Campaign" },
    { key: "spend", label: "Spend", align: "right" },
    { key: "impressions", label: "Impr.", align: "right" },
    { key: "ctr", label: "CTR", align: "right" },
    { key: "cpc", label: "CPC", align: "right" },
    { key: "roas", label: "ROAS", align: "right" },
    { key: "cpa", label: "CPA", align: "right" },
    { key: "healthScore", label: "Health", align: "right" },
  ];

  if (campaigns.length === 0) {
    return (
      <div
        style={{
          padding: 48,
          textAlign: "center",
          color: "var(--text-tertiary)",
          fontSize: 14,
        }}
      >
        No campaigns found. Sync your account or create a campaign in Meta Ads Manager.
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border-default)" }}>
            {cols.map((col) => (
              <th
                key={col.key}
                onClick={() => toggleSort(col.key)}
                style={{
                  padding: "10px 12px",
                  textAlign: col.align ?? "left",
                  color: "var(--text-secondary)",
                  fontWeight: 600,
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  cursor: "pointer",
                  userSelect: "none",
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  {col.label}
                  {sortKey === col.key ? (
                    sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                  ) : null}
                </span>
              </th>
            ))}
            <th
              style={{
                padding: "10px 12px",
                textAlign: "center",
                color: "var(--text-secondary)",
                fontWeight: 600,
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((campaign) => (
            <tr
              key={campaign.id}
              style={{
                background: tierRowBg[campaign.healthTier],
                borderBottom: "1px solid var(--border-default)",
                transition: "background 0.15s",
              }}
            >
              <td style={{ padding: "12px 12px" }}>
                <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                  {campaign.name}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-tertiary)",
                    marginTop: 2,
                    textTransform: "uppercase",
                  }}
                >
                  {campaign.status} · {campaign.objective}
                </div>
              </td>
              <td style={{ padding: "12px 12px", textAlign: "right", color: "var(--text-primary)" }}>
                {formatCurrency(campaign.spend)}
              </td>
              <td style={{ padding: "12px 12px", textAlign: "right", color: "var(--text-secondary)" }}>
                {formatNumber(campaign.impressions)}
              </td>
              <td style={{ padding: "12px 12px", textAlign: "right", color: "var(--text-secondary)" }}>
                {formatPercent(campaign.ctr)}
              </td>
              <td style={{ padding: "12px 12px", textAlign: "right", color: "var(--text-secondary)" }}>
                {formatCurrency(campaign.cpc)}
              </td>
              <td
                style={{
                  padding: "12px 12px",
                  textAlign: "right",
                  fontWeight: 600,
                  color:
                    campaign.roas >= 2
                      ? "var(--success)"
                      : campaign.roas >= 1
                      ? "var(--warning)"
                      : "var(--danger)",
                }}
              >
                {campaign.roas > 0 ? `${campaign.roas.toFixed(2)}x` : "—"}
              </td>
              <td style={{ padding: "12px 12px", textAlign: "right", color: "var(--text-secondary)" }}>
                {campaign.cpa > 0 ? formatCurrency(campaign.cpa) : "—"}
              </td>
              <td style={{ padding: "12px 12px", textAlign: "right" }}>
                <CampaignHealthBadge
                  score={campaign.healthScore}
                  tier={campaign.healthTier}
                  size="sm"
                />
              </td>
              <td style={{ padding: "12px 12px", textAlign: "center" }}>
                <button
                  onClick={() => handleAction(campaign)}
                  disabled={actionLoading === campaign.id}
                  title={campaign.status === "ACTIVE" ? "Pause campaign" : "Resume campaign"}
                  style={{
                    background: "none",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-md)",
                    padding: "4px 8px",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    color: "var(--text-secondary)",
                    transition: "all 0.15s",
                  }}
                >
                  {actionLoading === campaign.id ? (
                    <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                  ) : campaign.status === "ACTIVE" ? (
                    <Pause size={14} />
                  ) : (
                    <Play size={14} />
                  )}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
