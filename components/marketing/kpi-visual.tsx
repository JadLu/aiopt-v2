"use client";

import { Sparkles, Target, TrendingUp, TrendingDown } from "lucide-react";
import type { KpiData } from "@/lib/mock-data";

interface KpiVisualProps {
  data: KpiData | null | undefined;
  onRegenerate: () => void;
}

function parseNumeric(val: string): number {
  return parseFloat(val.replace(/[^0-9.]/g, "")) || 0;
}

function isBetter(target: string, benchmark: string, lowerIsBetter: boolean): boolean {
  const t = parseNumeric(target);
  const b = parseNumeric(benchmark);
  if (t === 0 || b === 0) return true;
  return lowerIsBetter ? t <= b : t >= b;
}

export function KpiVisual({ data, onRegenerate }: KpiVisualProps) {
  if (!data) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "48px 24px", textAlign: "center" }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "color-mix(in srgb, var(--success) 12%, transparent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Target size={20} color="var(--success)" strokeWidth={1.6} />
        </div>
        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", margin: 0 }}>No visual data yet</p>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>Regenerate the plan to get the graphical KPI benchmarks.</p>
        <button className="btn-primary" style={{ width: "auto", marginTop: 4, padding: "8px 20px", fontSize: 13 }} onClick={onRegenerate}>
          <Sparkles size={13} /> Regenerate Plan
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Primary KPIs */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Primary Targets</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          {data.primary_metrics.map(({ name, target, benchmark, description, lower_is_better }) => {
            const better = isBetter(target, benchmark, lower_is_better);
            const accentColor = better ? "var(--success)" : "var(--danger)";
            const TrendIcon = lower_is_better
              ? (better ? TrendingDown : TrendingUp)
              : (better ? TrendingUp : TrendingDown);
            return (
              <div key={name} style={{ background: "var(--bg-elevated)", border: `1px solid color-mix(in srgb, ${accentColor} 30%, var(--border-default))`, borderRadius: 14, padding: "20px 22px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)" }}>{name}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, color: accentColor, background: `color-mix(in srgb, ${accentColor} 12%, transparent)`, padding: "3px 8px", borderRadius: 99 }}>
                    <TrendIcon size={10} strokeWidth={2} />
                    {better ? "On Target" : "Ambitious"}
                  </span>
                </div>
                <div style={{ fontSize: 32, fontWeight: 800, color: accentColor, lineHeight: 1, marginBottom: 6 }}>{target}</div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{description}</div>
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-default)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>MENA Benchmark</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>{benchmark}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Secondary metrics */}
      {data.secondary_metrics.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Supporting Metrics</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
            {data.secondary_metrics.map(({ name, target, benchmark, lower_is_better }) => {
              const better = isBetter(target, benchmark, lower_is_better);
              const color = better ? "var(--success)" : "var(--danger)";
              return (
                <div key={name} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 6 }}>{name}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color, marginBottom: 8 }}>{target}</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>Benchmark</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>{benchmark}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
