"use client";

import { Sparkles, Clock } from "lucide-react";
import type { ChannelsData } from "@/lib/mock-data";

interface ChannelsVisualProps {
  data: ChannelsData | null | undefined;
  onRegenerate: () => void;
}

/* Brand-accurate platform colors */
const PLATFORM_COLORS: Record<string, string> = {
  meta:      "#1877F2",
  facebook:  "#1877F2",
  instagram: "#E1306C",
  tiktok:    "#EE1D52",
  snapchat:  "#FFCC00",
  youtube:   "#FF0000",
  google:    "#4285F4",
  twitter:   "#1DA1F2",
  x:         "#1DA1F2",
  pinterest: "#E60023",
  linkedin:  "#0A66C2",
};

function getPlatformColor(name: string): string {
  const key = name.toLowerCase().split(/[\s·+,/]/)[0].trim();
  return PLATFORM_COLORS[key] ?? "var(--accent-primary)";
}

/* Parse "$180/day" → 180, "$5,400/month" → 180, "$1,260/week" → 180 */
function parseDailyRate(total: string): number | null {
  const m = total.replace(/,/g, "").match(/([\d.]+)\s*\/\s*(day|month|week)/i);
  if (!m) return null;
  const amount = parseFloat(m[1]);
  const period = m[2].toLowerCase();
  if (period === "day")   return amount;
  if (period === "week")  return Math.round(amount / 7);
  if (period === "month") return Math.round(amount / 30);
  return null;
}

export function ChannelsVisual({ data, onRegenerate }: ChannelsVisualProps) {
  if (!data) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "28px 16px", textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>Regenerate the plan to get the channel breakdown.</p>
        <button className="btn-primary" style={{ width: "auto", padding: "7px 18px", fontSize: 12 }} onClick={onRegenerate}>
          <Sparkles size={12} /> Regenerate Plan
        </button>
      </div>
    );
  }

  const sorted = [...data.channels].sort((a, b) => b.budget_pct - a.budget_pct);
  const dailyRate = parseDailyRate(data.total_budget);
  const primaryChannel = sorted.find((c) => c.primary);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {sorted.map((ch) => {
        const color = getPlatformColor(ch.name);
        const dailyCost = dailyRate ? Math.round(dailyRate * ch.budget_pct / 100) : null;

        return (
          <div key={ch.name}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
              {/* Platform dot + name */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                  background: color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: color === "#FFCC00" ? "#000" : "#fff" }}>
                    {ch.name[0].toUpperCase()}
                  </span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{ch.name}</span>
                {ch.primary && (
                  <span style={{ fontSize: 10, fontWeight: 600, color: "var(--accent-primary)", background: "color-mix(in srgb, var(--accent-primary) 12%, transparent)", padding: "2px 7px", borderRadius: 999 }}>
                    Primary
                  </span>
                )}
              </div>
              {/* Pct + daily cost */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)" }}>{ch.budget_pct}%</span>
                {dailyCost !== null && (
                  <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500 }}>${dailyCost}/day</span>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ height: 5, background: "var(--chip)", borderRadius: 999, overflow: "hidden" }}>
              <div style={{
                width: `${Math.min(100, ch.budget_pct)}%`,
                height: "100%",
                background: color,
                borderRadius: 999,
                transition: "width 0.5s var(--ease)",
              }} />
            </div>
          </div>
        );
      })}

      {/* Footer */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginTop: 4,
        paddingTop: 12, borderTop: "1px solid var(--hairline)",
        color: "var(--text-tertiary)", fontSize: 12,
      }}>
        <Clock size={12} strokeWidth={1.8} style={{ flexShrink: 0 }} />
        <span>
          Total budget <strong style={{ color: "var(--text-primary)" }}>{data.total_budget}</strong>
        </span>
        {primaryChannel && (
          <span style={{ marginLeft: "auto" }}>via {primaryChannel.name}</span>
        )}
      </div>
    </div>
  );
}
