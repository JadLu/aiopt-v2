"use client";

import { Sparkles, Users, TrendingUp, Globe, BarChart2, Layers } from "lucide-react";
import type { MarketAnalysisData } from "@/lib/mock-data";

interface MarketAnalysisVisualProps {
  data: MarketAnalysisData | null | undefined;
  onRegenerate: () => void;
}

const COMPETITION_COLOR: Record<string, string> = {
  low: "var(--success)",
  medium: "var(--warning)",
  high: "var(--danger)",
};

const PRIORITY_COLOR: Record<string, string> = {
  primary: "var(--accent-primary)",
  secondary: "var(--accent-secondary)",
  tertiary: "#C084FC",
};

function StatCard({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: "var(--bg-elevated)",
      border: "1px solid var(--border-default)",
      borderRadius: 12,
      padding: "16px 18px",
      display: "flex",
      flexDirection: "column",
      gap: 6,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500 }}>
        <Icon size={12} strokeWidth={1.8} />
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{sub}</div>}
    </div>
  );
}

function Bar({ pct, color = "var(--accent-primary)", height = 8 }: { pct: number; color?: string; height?: number }) {
  return (
    <div style={{ background: "var(--bg-subtle)", borderRadius: 99, overflow: "hidden", height }}>
      <div style={{
        width: `${Math.min(100, Math.max(0, pct))}%`,
        height: "100%",
        background: color,
        borderRadius: 99,
        transition: "width 0.4s ease",
      }} />
    </div>
  );
}

export function MarketAnalysisVisual({ data, onRegenerate }: MarketAnalysisVisualProps) {
  if (!data) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "48px 24px", textAlign: "center" }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "color-mix(in srgb, var(--accent-primary) 12%, transparent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <BarChart2 size={20} color="var(--accent-primary)" strokeWidth={1.6} />
        </div>
        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", margin: 0 }}>No visual data yet</p>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>
          Regenerate the plan to get the graphical market analysis.
        </p>
        <button
          className="btn-primary"
          style={{ width: "auto", marginTop: 4, padding: "8px 20px", fontSize: 13 }}
          onClick={onRegenerate}
        >
          <Sparkles size={13} /> Regenerate Plan
        </button>
      </div>
    );
  }

  const { stats, demographics, regions, platforms, segments } = data;
  const competitionKey = stats.competition.toLowerCase() as keyof typeof COMPETITION_COLOR;
  const competitionColor = COMPETITION_COLOR[competitionKey] ?? "var(--text-secondary)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* KPI stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        <StatCard icon={Globe} label="Market Size" value={stats.market_size} />
        <StatCard icon={Users} label="Audience Size" value={stats.audience_size} />
        <StatCard icon={TrendingUp} label="Growth Rate" value={stats.growth_rate} />
        <div style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          borderRadius: 12,
          padding: "16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500 }}>
            <Layers size={12} strokeWidth={1.8} />Competition
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: competitionColor, lineHeight: 1 }}>{stats.competition}</div>
        </div>
      </div>

      {/* Demographics + Platforms row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Demographics */}
        <div style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          borderRadius: 12,
          padding: "16px 18px",
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14 }}>Demographics</div>

          {/* Age distribution */}
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500, marginBottom: 10 }}>Age Distribution</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {demographics.ages.filter(a => a.pct > 0).map(({ label, pct }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 44, fontSize: 11, color: "var(--text-secondary)", flexShrink: 0 }}>{label}</div>
                <div style={{ flex: 1 }}>
                  <Bar pct={pct} />
                </div>
                <div style={{ width: 30, fontSize: 11, color: "var(--text-secondary)", textAlign: "right", flexShrink: 0 }}>{pct}%</div>
              </div>
            ))}
          </div>

          {/* Gender split */}
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500, marginBottom: 8 }}>Gender Split</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", width: 44, flexShrink: 0 }}>{demographics.gender.label_a}</div>
            <div style={{ flex: 1, background: "var(--bg-subtle)", borderRadius: 99, overflow: "hidden", height: 8, display: "flex" }}>
              <div style={{ width: `${demographics.gender.pct_a}%`, background: "var(--accent-primary)", height: "100%", borderRadius: "99px 0 0 99px" }} />
              <div style={{ flex: 1, background: "var(--accent-secondary)", height: "100%", borderRadius: "0 99px 99px 0" }} />
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", width: 30, textAlign: "right", flexShrink: 0 }}>{demographics.gender.label_b}</div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 11, color: "var(--accent-primary)", fontWeight: 600 }}>{demographics.gender.pct_a}%</span>
            <span style={{ fontSize: 11, color: "var(--accent-secondary)", fontWeight: 600 }}>{demographics.gender.pct_b}%</span>
          </div>
        </div>

        {/* Platform priority */}
        <div style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          borderRadius: 12,
          padding: "16px 18px",
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14 }}>Platform Priority</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[...platforms].sort((a, b) => b.score - a.score).map(({ name, score }) => (
              <div key={name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 78, fontSize: 11, color: "var(--text-secondary)", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                <div style={{ flex: 1 }}>
                  <Bar pct={score} color="var(--accent-secondary)" />
                </div>
                <div style={{ width: 28, fontSize: 11, color: "var(--text-secondary)", textAlign: "right", flexShrink: 0 }}>{score}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Geographic focus */}
      <div style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-default)",
        borderRadius: 12,
        padding: "16px 18px",
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14 }}>Geographic Focus</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
          {regions.map(({ name, priority, pct }) => {
            const prioKey = priority.toLowerCase() as keyof typeof PRIORITY_COLOR;
            const color = PRIORITY_COLOR[prioKey] ?? "var(--text-tertiary)";
            return (
              <div key={name} style={{
                background: "var(--bg-subtle)",
                border: `1px solid var(--border-default)`,
                borderRadius: 10,
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{name}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, color, padding: "2px 7px",
                    background: `color-mix(in srgb, ${color} 14%, transparent)`,
                    borderRadius: 99,
                  }}>{priority}</span>
                </div>
                <Bar pct={pct} color={color} height={6} />
                <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{pct}% market share</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Audience segments */}
      {segments.length > 0 && (
        <div style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          borderRadius: 12,
          padding: "16px 18px",
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14 }}>Audience Segments</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
            {segments.map(({ name, size, traits }) => (
              <div key={name} style={{
                background: "var(--bg-subtle)",
                border: "1px solid var(--border-default)",
                borderRadius: 10,
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{name}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: "var(--accent-primary)",
                    background: "color-mix(in srgb, var(--accent-primary) 12%, transparent)",
                    padding: "2px 8px", borderRadius: 99,
                    flexShrink: 0,
                  }}>{size}</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {traits.map((t) => (
                    <span key={t} style={{
                      fontSize: 10, color: "var(--text-tertiary)",
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border-default)",
                      borderRadius: 6, padding: "2px 7px",
                    }}>{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
