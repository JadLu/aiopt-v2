"use client";

import { Sparkles, Flag } from "lucide-react";
import type { PhasesData } from "@/lib/mock-data";

interface PhasesVisualProps {
  data: PhasesData | null | undefined;
  onRegenerate: () => void;
}

const PHASE_COLORS = [
  "var(--accent-primary)",
  "var(--accent-secondary)",
  "var(--success)",
  "#C084FC",
  "var(--warning)",
];

export function PhasesVisual({ data, onRegenerate }: PhasesVisualProps) {
  if (!data) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "48px 24px", textAlign: "center" }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "color-mix(in srgb, var(--warning) 12%, transparent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Flag size={20} color="var(--warning)" strokeWidth={1.6} />
        </div>
        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", margin: 0 }}>No visual data yet</p>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>Regenerate the plan to get the graphical campaign phases.</p>
        <button className="btn-primary" style={{ width: "auto", marginTop: 4, padding: "8px 20px", fontSize: 13 }} onClick={onRegenerate}>
          <Sparkles size={13} /> Regenerate Plan
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Timeline strip */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto", paddingBottom: 4 }}>
        {data.phases.map(({ name, duration, budget_pct }, i) => {
          const color = PHASE_COLORS[i % PHASE_COLORS.length];
          const isLast = i === data.phases.length - 1;
          return (
            <div key={name} style={{ display: "flex", alignItems: "center", flexShrink: 0, flex: budget_pct }}>
              {/* Step node */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: `color-mix(in srgb, ${color} 15%, transparent)`, border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color }}>
                  {i + 1}
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color, whiteSpace: "nowrap" }}>{name}</span>
                <span style={{ fontSize: 10, color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>{duration}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color, background: `color-mix(in srgb, ${color} 10%, transparent)`, padding: "2px 7px", borderRadius: 99, whiteSpace: "nowrap" }}>{budget_pct}% budget</span>
              </div>
              {/* Connector */}
              {!isLast && (
                <div style={{ flex: 1, height: 2, background: `color-mix(in srgb, ${color} 30%, var(--border-default))`, minWidth: 24, margin: "0 4px", marginBottom: 52 }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Phase detail cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        {data.phases.map(({ name, objective, tactics, success_kpi }, i) => {
          const color = PHASE_COLORS[i % PHASE_COLORS.length];
          return (
            <div key={name} style={{ background: "var(--bg-elevated)", border: `1px solid color-mix(in srgb, ${color} 25%, var(--border-default))`, borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>

              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: `color-mix(in srgb, ${color} 14%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color }}>{i + 1}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{name}</span>
              </div>

              {/* Objective */}
              <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>{objective}</p>

              {/* Tactics */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Tactics</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {tactics.map((t) => (
                    <div key={t} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                      <div style={{ width: 4, height: 4, borderRadius: "50%", background: color, flexShrink: 0, marginTop: 5 }} />
                      <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{t}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Success KPI */}
              <div style={{ marginTop: "auto", padding: "8px 12px", background: `color-mix(in srgb, ${color} 8%, transparent)`, borderRadius: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>Success KPI</div>
                <div style={{ fontSize: 12, fontWeight: 600, color }}>{success_kpi}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
