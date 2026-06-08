"use client";

import type { HealthTier } from "@/lib/firebase/meta-campaigns";

interface Props {
  score: number;
  tier: HealthTier;
  size?: "sm" | "md";
}

const tierConfig: Record<HealthTier, { dot: string; label: string; bg: string }> = {
  green:  { dot: "var(--success)",  label: "Healthy",  bg: "rgba(76,183,130,0.12)" },
  yellow: { dot: "var(--warning)",  label: "Warning",  bg: "rgba(232,181,71,0.12)" },
  red:    { dot: "var(--danger)",   label: "Critical", bg: "rgba(229,118,118,0.12)" },
};

export function CampaignHealthBadge({ score, tier, size = "md" }: Props) {
  const cfg = tierConfig[tier];
  const isSmall = size === "sm";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: isSmall ? 4 : 6,
        padding: isSmall ? "2px 8px" : "4px 10px",
        borderRadius: "var(--radius-md)",
        background: cfg.bg,
        fontSize: isSmall ? 11 : 12,
        fontWeight: 600,
        color: cfg.dot,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: isSmall ? 6 : 7,
          height: isSmall ? 6 : 7,
          borderRadius: "50%",
          background: cfg.dot,
          flexShrink: 0,
        }}
      />
      {score}
    </span>
  );
}
