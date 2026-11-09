"use client";

import { useState } from "react";
import { Star, RotateCw, ArrowRight, Plus, Loader2 } from "lucide-react";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import { LiquidButton } from "@/components/ui/liquid-button";

export interface AngleItem {
  name: string;
  size: string;
  traits: string[];
  starred?: boolean;
}

interface AnglesSectionProps {
  angles: AngleItem[];
  /** The plan is still being written and the market section isn't there yet. */
  loading: boolean;
  /** Plan is generating: angle actions are paused. */
  paused: boolean;
  selected?: number;
  /** Index of the angle currently being regenerated. */
  busyIndex: number | null;
  error?: string | null;
  onStar: (index: number) => void;
  onRegenerate: (index: number) => void;
  onUse: (index: number) => void;
  onAdd: (angle: { name: string; size: string; traits: string[] }) => void;
}

const EMPTY = { name: "", size: "", why: "" };

export function AnglesSection({
  angles, loading, paused, selected, busyIndex, error,
  onStar, onRegenerate, onUse, onAdd,
}: AnglesSectionProps) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY);

  function submit() {
    const name = form.name.trim();
    if (!name) return;
    onAdd({
      name,
      size: form.size.trim(),
      traits: form.why.split("\n").map((t) => t.trim()).filter(Boolean).slice(0, 3),
    });
    setForm(EMPTY);
    setAdding(false);
  }

  return (
    <section aria-label="Marketing angles" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h2 className="section-title">Marketing angles</h2>
        <span className="page-sub" style={{ fontSize: 13.5 }}>
          Pick the angle to test. Your creatives are written for it.
        </span>
      </div>

      {error && <p role="alert" className="field-error" style={{ margin: 0 }}>{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {loading
          ? [1, 2, 3].map((n) => (
              <article key={n} data-hue={n} className="glass angle-card" aria-busy="true">
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="angle-num">ANGLE {n}</span>
                  <span className="pulse" style={{ fontSize: 12, color: "var(--accent-primary)" }}>Writing…</span>
                </div>
                <div className="shimmer" style={{ height: 22, width: "70%" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div className="shimmer" style={{ height: 11 }} />
                  <div className="shimmer" style={{ height: 11, width: "80%" }} />
                </div>
                <div className="shimmer" style={{ height: 42, borderRadius: 14, marginTop: "auto" }} />
              </article>
            ))
          : angles.map((a, i) => {
              const busy = busyIndex === i;
              const isSelected = selected === i;
              return (
                <article key={`${i}-${a.name}`} data-hue={(i % 6) + 1} className={`glass angle-card lift${isSelected ? " selected" : ""}`} aria-busy={busy || undefined}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span className="angle-num">ANGLE {i + 1}{isSelected ? " · CHOSEN" : ""}</span>
                    <div style={{ display: "flex", gap: 2 }}>
                      <button
                        type="button"
                        className={`icon-btn-sm${a.starred ? " starred" : ""}`}
                        aria-label={a.starred ? `Unstar ${a.name}` : `Star ${a.name}`}
                        aria-pressed={!!a.starred}
                        disabled={paused || busy}
                        onClick={() => onStar(i)}
                      >
                        <Star size={16} fill={a.starred ? "currentColor" : "none"} strokeWidth={1.8} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn-sm"
                        aria-label={`Regenerate ${a.name} (${CREDIT_COSTS.ANGLE} credits)`}
                        title={`Regenerate this angle · ${CREDIT_COSTS.ANGLE} credits`}
                        disabled={paused || busyIndex !== null}
                        onClick={() => onRegenerate(i)}
                      >
                        {busy ? <Loader2 size={15} className="spinner" /> : <RotateCw size={15} strokeWidth={2} />}
                      </button>
                    </div>
                  </div>

                  {busy ? (
                    <>
                      <div className="shimmer" style={{ height: 22, width: "70%" }} />
                      <div className="shimmer" style={{ height: 11 }} />
                      <div className="shimmer" style={{ height: 11, width: "80%" }} />
                    </>
                  ) : (
                    <>
                      <h3 className="angle-name" dir="auto">{a.name}</h3>
                      {a.size && <span className="stat-chip" style={{ alignSelf: "flex-start" }} dir="auto">{a.size}</span>}
                      {a.traits.length > 0 && (
                        <ul className="angle-traits" dir="auto">
                          {a.traits.slice(0, 3).map((t) => <li key={t}>{t}</li>)}
                        </ul>
                      )}
                    </>
                  )}

                  <button
                    type="button"
                    className={`angle-use${a.starred || isSelected ? " primary" : ""}`}
                    disabled={paused || busy}
                    onClick={() => onUse(i)}
                  >
                    Use this angle <ArrowRight size={15} strokeWidth={2.2} aria-hidden />
                  </button>
                </article>
              );
            })}

        {!loading && (adding ? (
          <form
            className="angle-add"
            onSubmit={(e) => { e.preventDefault(); submit(); }}
            aria-label="Add an angle"
          >
            <span className="angle-num">NEW ANGLE</span>
            <input
              className="input-well" dir="auto" maxLength={120} required autoFocus
              placeholder="Who is this angle for?" aria-label="Angle name"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className="input-well" dir="auto" maxLength={160}
              placeholder="Audience size (optional)" aria-label="Audience size"
              value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })}
            />
            <textarea
              className="input-well" dir="auto" rows={3} maxLength={600}
              placeholder="Why it should convert (one point per line)" aria-label="Why it should convert"
              value={form.why} onChange={(e) => setForm({ ...form, why: e.target.value })}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn-secondary glass-inner" style={{ width: "auto", minHeight: 44 }} onClick={() => { setAdding(false); setForm(EMPTY); }}>
                Cancel
              </button>
              <LiquidButton type="submit" style={{ flex: 1 }}>Add angle</LiquidButton>
            </div>
          </form>
        ) : (
          <button type="button" className="angle-add angle-add-btn" disabled={paused} onClick={() => setAdding(true)}>
            <Plus size={18} aria-hidden /> Add your own angle
          </button>
        ))}
      </div>
    </section>
  );
}
