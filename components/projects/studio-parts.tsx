"use client";

import { ChevronDown } from "lucide-react";
import type { Project } from "@/lib/mock-data";

/** Pieces shared by the Images, Videos and Landing page studios (Liquid Glass styling in globals.css, `.studio-*`). */

export interface StudioCriteria {
  segmentIdx: number | null;
  channelIdx: number | null;
  pillarIdx:  number | null;
  hookIdx:    number | null;
  angleText:  string;
}

/** A labelled group of toggle chips. Long (Arabic or English) text wraps to two lines instead of being cut off. */
export function ChipGroup({ label, items, selected, disabled, onPick }: {
  label: string; items: string[]; selected: number | null; disabled?: boolean; onPick: (i: number) => void;
}) {
  return (
    <div className="studio-field" role="group" aria-label={label}>
      <span className="field-label">{label}</span>
      <div className="studio-chips">
        {items.map((text, i) => (
          <button
            key={i}
            type="button"
            className="chip studio-chip"
            aria-pressed={selected === i}
            disabled={disabled}
            dir="auto"
            title={text}
            onClick={() => onPick(i)}
          >
            <span>{text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Marketing angle, channel, pillar and hook chips from the plan, plus the user's own angle. */
export function CriteriaPicker({ project, criteria, disabled, onChange, onAngleText, onAngleBlur }: {
  project: Project;
  criteria: StudioCriteria;
  disabled?: boolean;
  onChange: (patch: Partial<StudioCriteria>) => void;
  onAngleText: (value: string) => void;
  onAngleBlur: () => void;
}) {
  const vd   = project.planVisualData;
  const segs = vd?.market?.segments   ?? [];
  const chs  = vd?.channels?.channels ?? [];
  const plrs = vd?.content?.pillars   ?? [];
  const hks  = vd?.content?.hooks     ?? [];

  return (
    <>
      {segs.length > 0 && (
        <ChipGroup label="Marketing angle" items={segs.map((s) => s.name)} selected={criteria.segmentIdx} disabled={disabled}
          onPick={(i) => onChange({ segmentIdx: criteria.segmentIdx === i ? null : i })} />
      )}
      {chs.length > 0 && (
        <ChipGroup label="Channel" items={chs.map((c) => c.name)} selected={criteria.channelIdx} disabled={disabled}
          onPick={(i) => onChange({ channelIdx: criteria.channelIdx === i ? null : i })} />
      )}
      {plrs.length > 0 && (
        <ChipGroup label="Content pillar" items={plrs.map((p) => p.name)} selected={criteria.pillarIdx} disabled={disabled}
          onPick={(i) => onChange({ pillarIdx: criteria.pillarIdx === i ? null : i })} />
      )}
      {hks.length > 0 && (
        <ChipGroup label="Hook" items={hks} selected={criteria.hookIdx} disabled={disabled}
          onPick={(i) => onChange({ hookIdx: criteria.hookIdx === i ? null : i })} />
      )}

      <label className="studio-field">
        <span className="field-label">
          Your own angle <span style={{ letterSpacing: 0, fontWeight: 400, textTransform: "none", opacity: 0.8 }}>· optional</span>
        </span>
        <textarea
          className="input-well"
          dir="auto"
          rows={2}
          value={criteria.angleText}
          disabled={disabled}
          placeholder="Add your own marketing angle… (e.g. 'Focus on post-workout recovery pain relief')"
          style={{ borderRadius: 18, padding: "12px 16px", resize: "vertical" }}
          onChange={(e) => onAngleText(e.target.value)}
          onBlur={onAngleBlur}
        />
      </label>
    </>
  );
}

/** "Edit full prompt" toggle with the prompt textarea underneath. */
export function PromptEditor({ id, open, onToggle, value, onChange, disabled, placeholder }: {
  id: string; open: boolean; onToggle: () => void; value: string; onChange: (v: string) => void; disabled?: boolean; placeholder: string;
}) {
  return (
    <div className="studio-field">
      <button type="button" className="chip" style={{ alignSelf: "flex-start" }} aria-expanded={open} aria-controls={id} onClick={onToggle}>
        <ChevronDown size={15} strokeWidth={2.2} style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform .2s" }} aria-hidden />
        {open ? "Hide full prompt" : "Edit full prompt"}
      </button>
      {open && (
        <textarea
          id={id}
          className="input-well"
          dir="auto"
          aria-label="Full prompt"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          rows={6}
          style={{ borderRadius: 18, padding: "14px 16px", lineHeight: 1.6, resize: "vertical" }}
        />
      )}
    </div>
  );
}
