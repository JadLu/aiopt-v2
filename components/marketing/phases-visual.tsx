"use client";

import { Sparkles } from "lucide-react";
import type { PhasesData } from "@/lib/mock-data";

interface PhasesVisualProps {
  data: PhasesData | null | undefined;
  onRegenerate: () => void;
}

const PHASE_COLORS = [
  { from: "#5AC8D6", to: "#6FB1E8" },
  { from: "#6FB1E8", to: "#9B8FE8" },
  { from: "#9B8FE8", to: "#C084FC" },
  { from: "#34C759", to: "#30D158" },
  { from: "#FF9F0A", to: "#FFB340" },
];

export function PhasesVisual({ data, onRegenerate }: PhasesVisualProps) {
  if (!data) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "32px 24px", textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>Regenerate the plan to get the campaign phases.</p>
        <button className="btn-primary" style={{ width: "auto", marginTop: 4, padding: "8px 20px", fontSize: 13 }} onClick={onRegenerate}>
          <Sparkles size={13} /> Regenerate Plan
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {data.phases.map(({ name, duration, objective, success_kpi, budget_pct }, i) => {
        const { from, to } = PHASE_COLORS[i % PHASE_COLORS.length];
        return (
          <div key={name} style={{ display: "flex", gap: 14 }}>
            {/* Number badge + vertical line */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 800, color: "#fff", flexShrink: 0,
              }}>
                {i + 1}
              </div>
              {i < data.phases.length - 1 && (
                <div style={{ width: 2, flex: 1, minHeight: 16, background: "var(--hairline)", borderRadius: 1, margin: "4px 0" }} />
              )}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0, paddingBottom: i < data.phases.length - 1 ? 8 : 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{name}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", background: "var(--chip)", padding: "2px 8px", borderRadius: 99 }}>
                  {duration}
                </span>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 6px", lineHeight: 1.55 }}>{objective}</p>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: from }}>
                {budget_pct}% budget · {success_kpi}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
