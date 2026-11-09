"use client";

import { useState, type ElementType, type ReactNode } from "react";
import { Globe, Share2, PenSquare, Clock, BarChart3, Flag, RotateCw, ChevronDown, Info, Eye, EyeOff } from "lucide-react";
import { MarketAnalysisVisual } from "@/components/marketing/market-analysis-visual";
import { ChannelsVisual } from "@/components/marketing/channels-visual";
import { ContentVisual } from "@/components/marketing/content-visual";
import { PhasesVisual } from "@/components/marketing/phases-visual";
import { KpiVisual } from "@/components/marketing/kpi-visual";
import { ActionVisual } from "@/components/marketing/action-visual";
import { AnglesSection, type AngleItem } from "./angles-section";
import type { PlanVisualData } from "@/lib/mock-data";

export type PlanKey = keyof PlanVisualData;

export const PLAN_SECTIONS: { key: PlanKey; label: string; icon: ElementType }[] = [
  { key: "market",   label: "Market",    icon: Globe },
  { key: "channels", label: "Channels",  icon: Share2 },
  { key: "content",  label: "Content",   icon: PenSquare },
  { key: "phases",   label: "Phases",    icon: Clock },
  { key: "kpi",      label: "KPIs",      icon: BarChart3 },
  { key: "action",   label: "This week", icon: Flag },
];

type SectionState = "done" | "writing" | "waiting";

function sectionStates(data: PlanVisualData, generating: boolean): Record<PlanKey, SectionState> {
  let nextAssigned = false;
  const out = {} as Record<PlanKey, SectionState>;
  for (const s of PLAN_SECTIONS) {
    if (data[s.key]) out[s.key] = "done";
    else if (generating && !nextAssigned) { out[s.key] = "writing"; nextAssigned = true; }
    else out[s.key] = "waiting";
  }
  return out;
}

export function countDraftSections(data: PlanVisualData | undefined): number {
  if (!data) return 0;
  return PLAN_SECTIONS.filter((s) => !!data[s.key]).length;
}

// ── Headline extraction: one takeaway + up to two key facts per section ────
interface Headline { takeaway: string; facts: string[] }

const t = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Cut prose to a headline length at a word boundary. */
function shorten(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max * 0.6)).trimEnd().replace(/[,;:.\-–—]$/, "")}…`;
}

/** Key facts are short chips. Anything that reads like a sentence is left for the details view. */
const MAX_FACT = 42;
const facts = (...xs: (string | false | undefined)[]): string[] =>
  xs.filter((x): x is string => !!x && x.length <= MAX_FACT).slice(0, 2);

/** "1.5-2.5 million" out of a longer audience description, if there is one near the start. */
function leadingFigure(s: string): string {
  const m = /^[^\d]{0,24}?(~?\d[\d.,]*(?:\s?[-–]\s?\d[\d.,]*)?\s?(?:million|billion|thousand|[kKmMbB]\b)?)/i.exec(s);
  return m ? m[1].trim() : "";
}

function headline(key: PlanKey, data: PlanVisualData): Headline | null {
  switch (key) {
    case "market": {
      const d = data.market;
      if (!d) return null;
      const s = d.stats ?? {};
      const audience = t(s.audience_size);
      const figure = audience ? leadingFigure(audience) : "";
      return {
        takeaway: figure ? `${figure} potential buyers` : audience ? shorten(audience, 80) : "Your market at a glance",
        facts: facts(t(s.market_size) && `Market ${t(s.market_size)}`, t(s.competition) && `${t(s.competition)} competition`),
      };
    }
    case "channels": {
      const list = [...(data.channels?.channels ?? [])].sort((a, b) => (b.budget_pct ?? 0) - (a.budget_pct ?? 0));
      if (!data.channels) return null;
      const [first, second] = list;
      return {
        takeaway: first ? `Lead with ${shorten(t(first.name), 50)}` : "Channel mix ready",
        facts: facts(
          first && `${t(first.name)} · ${first.budget_pct ?? 0}%`,
          second ? `${t(second.name)} · ${second.budget_pct ?? 0}%` : t(data.channels.total_budget) && `Budget ${t(data.channels.total_budget)}`,
        ),
      };
    }
    case "content": {
      const d = data.content;
      if (!d) return null;
      const hooks = d.hooks?.filter((h) => t(h)) ?? [];
      return {
        takeaway: t(d.tone) ? shorten(t(d.tone), 80) : "Content direction ready",
        facts: facts(d.pillars?.length ? `${d.pillars.length} content themes` : undefined, hooks.length ? `${hooks.length} ready-to-use hooks` : undefined),
      };
    }
    case "phases": {
      const p = data.phases?.phases ?? [];
      if (!data.phases) return null;
      return {
        takeaway: p.length ? shorten(p.map((x) => t(x.name)).filter(Boolean).slice(0, 3).join(" → "), 80) : "Rollout plan ready",
        facts: facts(p.length ? `${p.length} phases` : undefined, t(p[0]?.duration) && `Start: ${t(p[0]?.duration)}`),
      };
    }
    case "kpi": {
      const m = data.kpi?.primary_metrics ?? [];
      if (!data.kpi) return null;
      const [a, b] = m;
      return {
        takeaway: a ? shorten(`Aim for ${t(a.name)} ${t(a.target)}`.trim(), 70) : "Targets set",
        facts: facts(b && `${t(b.name)} ${t(b.target)}`.trim(), t(a?.benchmark) && `Market benchmark ${t(a?.benchmark)}`),
      };
    }
    case "action": {
      const w = data.action?.weeks?.[0];
      if (!data.action) return null;
      const high = w?.tasks?.filter((x) => x.priority === "high").length ?? 0;
      return {
        takeaway: shorten(t(w?.focus), 80) || "Next steps ready",
        facts: facts(w?.tasks?.length ? `${w.tasks.length} tasks this week` : undefined, high ? `${high} high priority` : undefined),
      };
    }
  }
}

// ── Card ───────────────────────────────────────────────────────────────────
function HeadlineCard({
  id, icon: Icon, label, state, generating, head, open, onToggle, children,
}: {
  id: string; icon: ElementType; label: string; state: SectionState; generating: boolean;
  head: Headline | null; open: boolean; onToggle: () => void; children: ReactNode;
}) {
  const ready = state === "done" && head;
  const detailsId = `${id}-details`;
  return (
    <section
      id={id}
      aria-label={label}
      aria-busy={!ready && generating ? true : undefined}
      className="glass plan-card plan-headline"
      style={{ gridColumn: open ? "1 / -1" : undefined, scrollMarginTop: 16 }}
    >
      <div className="plan-card-head">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="glass-inner icon-chip" style={{ width: 36, height: 36, borderRadius: 12 }} aria-hidden>
            <Icon size={17} strokeWidth={1.8} />
          </span>
          <span className="label-caps">{label}</span>
        </div>
        {state === "writing" && <span className="status-live">Writing…</span>}
      </div>

      {ready ? (
        <>
          <p className="plan-takeaway" dir="auto">{head.takeaway}</p>
          {head.facts.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {head.facts.map((f) => <span key={f} className="stat-chip" dir="auto">{f}</span>)}
            </div>
          )}
          <button
            type="button"
            className="plan-more"
            aria-expanded={open}
            aria-controls={detailsId}
            onClick={onToggle}
          >
            {open ? "Hide details" : "See details"}
            <ChevronDown size={15} strokeWidth={2.2} style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform .2s" }} aria-hidden />
          </button>
          {open && <div id={detailsId} className="plan-details">{children}</div>}
        </>
      ) : generating ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }} aria-hidden>
          <div className="shimmer" style={{ height: 22, width: "70%" }} />
          <div className="shimmer" style={{ height: 14, width: "45%" }} />
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>Not in this plan. Regenerate the plan to add it.</p>
      )}
    </section>
  );
}

interface PlanStepProps {
  /** Finished sections: the live draft while generating, the saved plan otherwise. */
  data: PlanVisualData;
  generating: boolean;
  angles: AngleItem[];
  selectedAngle?: number;
  busyAngle: number | null;
  angleError?: string | null;
  onRegeneratePlan: () => void;
  onStarAngle: (i: number) => void;
  onRegenerateAngle: (i: number) => void;
  onUseAngle: (i: number) => void;
  onAddAngle: (angle: { name: string; size: string; traits: string[] }) => void;
}

export function PlanStep({
  data, generating, angles, selectedAngle, busyAngle, angleError,
  onRegeneratePlan, onStarAngle, onRegenerateAngle, onUseAngle, onAddAngle,
}: PlanStepProps) {
  const states = sectionStates(data, generating);
  const [openKey, setOpenKey] = useState<PlanKey | null>(null);
  // The plan is a reference, not the first thing a customer needs: hidden until asked for.
  const [showPlan, setShowPlan] = useState(false);
  const done = countDraftSections(data);

  const visual = (key: PlanKey): ReactNode => {
    switch (key) {
      case "market":   return <MarketAnalysisVisual data={data.market} onRegenerate={onRegeneratePlan} hideSegments />;
      case "channels": return <ChannelsVisual data={data.channels} onRegenerate={onRegeneratePlan} />;
      case "content":  return <ContentVisual data={data.content} onRegenerate={onRegeneratePlan} />;
      case "phases":   return <PhasesVisual data={data.phases} onRegenerate={onRegeneratePlan} />;
      case "kpi":      return <KpiVisual data={data.kpi} onRegenerate={onRegeneratePlan} />;
      case "action":   return <ActionVisual data={data.action} onRegenerate={onRegeneratePlan} />;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <AnglesSection
        angles={angles}
        loading={generating && !data.market}
        paused={generating}
        selected={selectedAngle}
        busyIndex={busyAngle}
        error={angleError}
        onStar={onStarAngle}
        onRegenerate={onRegenerateAngle}
        onUse={onUseAngle}
        onAdd={onAddAngle}
      />

      <section aria-labelledby="plan-title" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <h2 id="plan-title" className="section-title">Marketing plan</h2>
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {generating
                ? `Writing · ${done} of ${PLAN_SECTIONS.length} ready`
                : done > 0
                  ? showPlan ? "The essentials. Open any card for the full detail." : "Ready. Show it whenever you want a look."
                  : "No plan yet."}
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {showPlan && !generating && done > 0 && (
              <button type="button" className="btn-secondary glass-inner plan-action" onClick={onRegeneratePlan}>
                <RotateCw size={14} strokeWidth={2} aria-hidden /> Regenerate plan
              </button>
            )}
            {done > 0 && (
              <button
                type="button"
                className="btn-secondary glass-inner plan-action"
                aria-expanded={showPlan}
                aria-controls="plan-cards"
                onClick={() => setShowPlan((v) => !v)}
              >
                {showPlan ? <EyeOff size={15} strokeWidth={2} aria-hidden /> : <Eye size={15} strokeWidth={2} aria-hidden />}
                {showPlan ? "Hide plan" : "Show plan"}
              </button>
            )}
          </div>
        </div>

        {generating && (
          <div className="glass-inner" role="status" style={{ borderRadius: 18, padding: "12px 16px", display: "flex", gap: 10, alignItems: "flex-start" }}>
            <Info size={16} style={{ flex: "none", marginTop: 2, color: "var(--accent-primary)" }} aria-hidden />
            <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--text-secondary)" }}>
              You can leave this page. Your plan keeps writing and will be here when you come back.
            </span>
          </div>
        )}

        {showPlan && (
        <div id="plan-cards" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
          {PLAN_SECTIONS.map((s) => (
            <HeadlineCard
              key={s.key}
              id={`plan-${s.key}`}
              icon={s.icon}
              label={s.label}
              state={states[s.key]}
              generating={generating}
              head={headline(s.key, data)}
              open={openKey === s.key}
              onToggle={() => setOpenKey((k) => (k === s.key ? null : s.key))}
            >
              {visual(s.key)}
            </HeadlineCard>
          ))}
        </div>
        )}
      </section>
    </div>
  );
}
