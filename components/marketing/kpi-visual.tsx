"use client";

import { Sparkles } from "lucide-react";
import type { KpiData } from "@/lib/mock-data";

interface KpiVisualProps {
  data: KpiData | null | undefined;
  onRegenerate: () => void;
}

function parseNumeric(val: string): number {
  return parseFloat(val.replace(/[^0-9.]/g, "")) || 0;
}

function progressPct(target: string, benchmark: string, lowerIsBetter: boolean): number {
  const t = parseNumeric(target);
  const b = parseNumeric(benchmark);
  if (!b) return 70;
  if (lowerIsBetter) {
    return Math.min(100, Math.max(10, (b / Math.max(t, 0.01)) * 80));
  }
  return Math.min(100, Math.max(10, (t / b) * 80));
}

function isBetter(target: string, benchmark: string, lowerIsBetter: boolean): boolean {
  const t = parseNumeric(target);
  const b = parseNumeric(benchmark);
  if (!t || !b) return true;
  return lowerIsBetter ? t <= b : t >= b;
}

function KpiRow({ name, target, benchmark, lower_is_better }: { name: string; target: string; benchmark: string; lower_is_better: boolean }) {
  const better = isBetter(target, benchmark, lower_is_better);
  const pct = progressPct(target, benchmark, lower_is_better);
  const color = better ? "var(--success)" : "var(--warning)";
  const label = lower_is_better ? `≤ ${benchmark}` : `${benchmark} target`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>{name}</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)" }}>
          {target} <span style={{ fontWeight: 400, color: "var(--text-tertiary)" }}>/ {label}</span>
        </span>
      </div>
      <div style={{ height: 6, background: "var(--chip)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.4s var(--ease)" }} />
      </div>
    </div>
  );
}

export function KpiVisual({ data, onRegenerate }: KpiVisualProps) {
  if (!data) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "32px 24px", textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>Regenerate the plan to get the KPI benchmarks.</p>
        <button className="btn-primary" style={{ width: "auto", marginTop: 4, padding: "8px 20px", fontSize: 13 }} onClick={onRegenerate}>
          <Sparkles size={13} /> Regenerate Plan
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {data.primary_metrics.map((m) => (
        <KpiRow key={m.name} {...m} />
      ))}

      {data.secondary_metrics.length > 0 && (
        <>
          <div style={{ height: 1, background: "var(--hairline)", margin: "2px 0" }} />
          {data.secondary_metrics.map((m) => (
            <KpiRow key={m.name} name={m.name} target={m.target} benchmark={m.benchmark} lower_is_better={m.lower_is_better} />
          ))}
        </>
      )}
    </div>
  );
}
