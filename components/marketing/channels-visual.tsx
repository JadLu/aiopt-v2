"use client";

import { Sparkles, DollarSign, TrendingUp, Star } from "lucide-react";
import type { ChannelsData } from "@/lib/mock-data";

interface ChannelsVisualProps {
  data: ChannelsData | null | undefined;
  onRegenerate: () => void;
}

function Bar({ pct, color = "var(--accent-secondary)", height = 8 }: { pct: number; color?: string; height?: number }) {
  return (
    <div style={{ background: "var(--bg-subtle)", borderRadius: 99, overflow: "hidden", height }}>
      <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.4s ease" }} />
    </div>
  );
}

export function ChannelsVisual({ data, onRegenerate }: ChannelsVisualProps) {
  if (!data) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "48px 24px", textAlign: "center" }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "color-mix(in srgb, var(--accent-secondary) 12%, transparent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <DollarSign size={20} color="var(--accent-secondary)" strokeWidth={1.6} />
        </div>
        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", margin: 0 }}>No visual data yet</p>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>Regenerate the plan to get the graphical channel breakdown.</p>
        <button className="btn-primary" style={{ width: "auto", marginTop: 4, padding: "8px 20px", fontSize: 13 }} onClick={onRegenerate}>
          <Sparkles size={13} /> Regenerate Plan
        </button>
      </div>
    );
  }

  const sorted = [...data.channels].sort((a, b) => b.budget_pct - a.budget_pct);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Total budget header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", background: "color-mix(in srgb, var(--accent-secondary) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--accent-secondary) 20%, transparent)", borderRadius: 12 }}>
        <DollarSign size={16} color="var(--accent-secondary)" strokeWidth={1.8} />
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Recommended Monthly Budget</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginLeft: "auto" }}>{data.total_budget}</span>
      </div>

      {/* Channel cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {sorted.map((ch) => (
          <div
            key={ch.name}
            style={{
              background: "var(--bg-elevated)",
              border: `1px solid ${ch.primary ? "var(--accent-secondary)" : "var(--border-default)"}`,
              borderRadius: 12,
              padding: "16px 18px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{ch.name}</span>
                {ch.primary && (
                  <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 600, color: "var(--accent-secondary)", background: "color-mix(in srgb, var(--accent-secondary) 12%, transparent)", padding: "2px 7px", borderRadius: 99 }}>
                    <Star size={9} fill="var(--accent-secondary)" /> Primary
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
                <span style={{ fontSize: 12, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 4 }}>
                  <TrendingUp size={11} strokeWidth={1.8} /> {ch.expected_roas}
                </span>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--accent-secondary)" }}>{ch.budget_pct}%</span>
              </div>
            </div>

            <Bar pct={ch.budget_pct} color={ch.primary ? "var(--accent-secondary)" : "var(--accent-primary)"} />

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {ch.formats.map((f) => (
                <span key={f} style={{ fontSize: 11, color: "var(--text-secondary)", background: "var(--bg-subtle)", border: "1px solid var(--border-default)", borderRadius: 6, padding: "3px 8px" }}>{f}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
