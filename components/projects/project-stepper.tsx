"use client";

import { Check, AlertCircle } from "lucide-react";

export type StepId = "brief" | "plan" | "creatives" | "library";

export interface StepInfo {
  id: StepId;
  label: string;
  /** Short status line under the label, e.g. "Done", "Writing · 3 of 6". */
  status: string;
  state: "done" | "progress" | "error" | "idle";
  /** Only for state "progress": ring fill. */
  progress?: { done: number; total: number };
}

interface ProjectStepperProps {
  steps: StepInfo[];
  current: StepId;
  onSelect: (id: StepId) => void;
}

const RING_R = 12;
const RING_C = 2 * Math.PI * RING_R;

function StepDot({ step, index }: { step: StepInfo; index: number }) {
  if (step.state === "done") {
    return <span className="step-dot done" aria-hidden><Check size={14} strokeWidth={3} /></span>;
  }
  if (step.state === "error") {
    return <span className="step-dot error" aria-hidden><AlertCircle size={15} /></span>;
  }
  if (step.state === "progress" && step.progress) {
    const frac = Math.min(1, step.progress.done / Math.max(1, step.progress.total));
    return (
      <span className="step-dot ring" aria-hidden>
        <svg width="30" height="30" viewBox="0 0 30 30">
          <circle cx="15" cy="15" r={RING_R} fill="none" stroke="var(--hairline)" strokeWidth="3" />
          <circle
            cx="15" cy="15" r={RING_R} fill="none" stroke="var(--accent-primary)" strokeWidth="3" strokeLinecap="round"
            strokeDasharray={`${RING_C * frac} ${RING_C}`} transform="rotate(-90 15 15)"
            style={{ transition: "stroke-dasharray .4s var(--ease)" }}
          />
        </svg>
        <span style={{ position: "relative" }}>{index + 1}</span>
      </span>
    );
  }
  return <span className="step-dot" aria-hidden>{index + 1}</span>;
}

export function ProjectStepper({ steps, current, onSelect }: ProjectStepperProps) {
  return (
    <ol className="glass stepper" aria-label="Project steps">
      {steps.map((step, i) => (
        <li key={step.id}>
          <button
            type="button"
            className="step"
            aria-current={step.id === current ? "step" : undefined}
            onClick={() => onSelect(step.id)}
          >
            <StepDot step={step} index={i} />
            <span className="step-text">
              <span className="step-title">{step.label}</span>
              <span className="step-sub">{step.status}</span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}
