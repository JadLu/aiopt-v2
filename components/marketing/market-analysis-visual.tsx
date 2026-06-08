"use client";

import { useState } from "react";
import { Sparkles, Users, TrendingUp, Globe, BarChart2, Layers, Plus, X } from "lucide-react";
import type { MarketAnalysisData } from "@/lib/mock-data";

interface MarketAnalysisVisualProps {
  data: MarketAnalysisData | null | undefined;
  onRegenerate: () => void;
  onAddAngle?: (angle: { name: string; size: string; traits: string[] }) => void;
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

const EMPTY_FORM = { name: "", size: "", traits: ["", "", ""] as [string, string, string] };

export function MarketAnalysisVisual({ data, onRegenerate, onAddAngle }: MarketAnalysisVisualProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<{ name: string; size: string; traits: [string, string, string] }>(EMPTY_FORM);

  function openModal() {
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function handleSubmit() {
    if (!form.name.trim() || !onAddAngle) return;
    onAddAngle({
      name: form.name.trim(),
      size: form.size.trim(),
      traits: form.traits.map(t => t.trim()).filter(Boolean),
    });
    setModalOpen(false);
  }

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
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Marketing Angle */}
        {(segments.length > 0 || onAddAngle) && (
          <div style={{ background: "var(--chip)", border: "1px solid var(--hairline)", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: ".06em" }}>Marketing Angle</div>
              {onAddAngle && (
                <button
                  onClick={openModal}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    fontSize: 11, fontWeight: 600, color: "var(--accent-primary)",
                    background: "color-mix(in srgb, var(--accent-primary) 10%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)",
                    borderRadius: "var(--r-input)", padding: "4px 10px", cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                >
                  <Plus size={11} strokeWidth={2.2} /> Add Angle
                </button>
              )}
            </div>

            {segments.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                {segments.map(({ name, size, traits }) => (
                  <div key={name} style={{
                    background: "var(--glass-strong)", border: "1px solid var(--hairline)",
                    borderRadius: 10, padding: "12px 14px",
                    display: "flex", flexDirection: "column", gap: 8,
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {name}
                    </span>
                    {size && (
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--accent-primary)", background: "color-mix(in srgb, var(--accent-primary) 12%, transparent)", padding: "3px 8px", borderRadius: 999, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%", display: "block" }}>
                        {size}
                      </span>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {traits.slice(0, 3).map((t) => (
                        <span key={t} style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0, textAlign: "center", padding: "12px 0" }}>
                No angles yet — add your first marketing angle above.
              </p>
            )}
          </div>
        )}

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

      </div>

      {/* Add Marketing Angle modal */}
      {modalOpen && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}
          onClick={() => setModalOpen(false)}
        >
          <div
            style={{
              background: "var(--bg-base)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--r-card)",
              padding: 28,
              width: "100%", maxWidth: 440,
              boxShadow: "var(--card-shadow)",
              display: "flex", flexDirection: "column", gap: 20,
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.2 }}>Add Marketing Angle</div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>Define a specific audience angle to target</div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", padding: 4, borderRadius: 8, display: "flex", alignItems: "center" }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Angle Name */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                Angle Name <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <input
                className="auth-input"
                placeholder="e.g. Eco-conscious Millennials"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                autoFocus
              />
            </div>

            {/* Audience Size */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                Audience Size <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-tertiary)" }}>optional</span>
              </label>
              <input
                className="auth-input"
                placeholder="e.g. 12M+ users"
                value={form.size}
                onChange={e => setForm(f => ({ ...f, size: e.target.value }))}
              />
            </div>

            {/* Key Traits */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                Key Traits <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-tertiary)" }}>up to 3</span>
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {([0, 1, 2] as const).map(i => (
                  <input
                    key={i}
                    className="auth-input"
                    placeholder={
                      i === 0 ? "e.g. Values sustainability" :
                      i === 1 ? "e.g. Mobile-first shopper" :
                      "e.g. Premium price tolerance"
                    }
                    value={form.traits[i]}
                    onChange={e => {
                      const next = [...form.traits] as [string, string, string];
                      next[i] = e.target.value;
                      setForm(f => ({ ...f, traits: next }));
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn-secondary" style={{ width: "auto", padding: "8px 18px", fontSize: 13 }} onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                style={{ width: "auto", padding: "8px 18px", fontSize: 13, opacity: form.name.trim() ? 1 : 0.5 }}
                disabled={!form.name.trim()}
                onClick={handleSubmit}
              >
                <Plus size={13} /> Add Angle
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
