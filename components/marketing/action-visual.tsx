"use client";

import { useState } from "react";
import { Sparkles, CheckCircle2, Square } from "lucide-react";
import type { ActionData } from "@/lib/mock-data";

interface ActionVisualProps {
  data: ActionData | null | undefined;
  onRegenerate: () => void;
}

const PRIORITY_STYLE: Record<string, { bg: string; color: string }> = {
  high:   { bg: "color-mix(in srgb, var(--danger) 16%, transparent)",           color: "var(--danger)" },
  medium: { bg: "color-mix(in srgb, var(--warning) 16%, transparent)",          color: "var(--warning)" },
  low:    { bg: "color-mix(in srgb, var(--text-tertiary) 14%, transparent)",    color: "var(--text-tertiary)" },
};

function getOwnerStyle(owner: string): { bg: string; color: string } {
  const key = owner.toLowerCase();
  if (key.includes("creative") || key.includes("design")) return { bg: "color-mix(in srgb, var(--accent-primary) 14%, transparent)", color: "var(--accent-primary)" };
  if (key.includes("ads") || key.includes("media") || key.includes("paid"))    return { bg: "color-mix(in srgb, var(--accent-secondary) 14%, transparent)", color: "var(--accent-secondary)" };
  if (key.includes("landing") || key.includes("web") || key.includes("dev"))   return { bg: "color-mix(in srgb, #C084FC 14%, transparent)", color: "#C084FC" };
  if (key.includes("cro") || key.includes("conversion"))                       return { bg: "color-mix(in srgb, var(--warning) 14%, transparent)", color: "var(--warning)" };
  if (key.includes("ops") || key.includes("operation") || key.includes("logistic")) return { bg: "color-mix(in srgb, var(--success) 14%, transparent)", color: "var(--success)" };
  return { bg: "var(--chip)", color: "var(--text-secondary)" };
}

export function ActionVisual({ data, onRegenerate }: ActionVisualProps) {
  const allTasks = data?.weeks.flatMap((w) => w.tasks) ?? [];
  const [checked, setChecked] = useState<Set<number>>(new Set());

  if (!data) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "28px 16px", textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>Regenerate the plan to get the action plan.</p>
        <button className="btn-primary" style={{ width: "auto", padding: "7px 18px", fontSize: 12 }} onClick={onRegenerate}>
          <Sparkles size={12} /> Regenerate Plan
        </button>
      </div>
    );
  }

  const toggle = (i: number) =>
    setChecked((prev) => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next; });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      {allTasks.map(({ task, priority, owner }, i) => {
        const done = checked.has(i);
        const ps = PRIORITY_STYLE[priority] ?? PRIORITY_STYLE.low;
        const os = getOwnerStyle(owner);
        return (
          <div
            key={i}
            style={{
              display: "flex", flexDirection: "column", gap: 10,
              padding: "12px 14px",
              background: "var(--chip)", border: "1px solid var(--hairline)",
              borderRadius: 12,
              opacity: done ? 0.5 : 1,
              transition: "opacity 0.25s var(--ease)",
            }}
          >
            {/* Checkbox + task text */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <button
                onClick={() => toggle(i)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0, marginTop: 1, color: done ? "var(--success)" : "var(--text-tertiary)", transition: "color 0.2s var(--ease)" }}
              >
                {done
                  ? <CheckCircle2 size={17} strokeWidth={2} />
                  : <Square size={17} strokeWidth={1.7} />}
              </button>
              <span style={{
                fontSize: 13, fontWeight: 500, color: "var(--text-primary)",
                lineHeight: 1.5, flex: 1,
                textDecoration: done ? "line-through" : "none",
              }}>
                {task}
              </span>
            </div>

            {/* Priority + owner badges */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingLeft: 27 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase",
                padding: "3px 8px", borderRadius: 999,
                background: ps.bg, color: ps.color,
              }}>
                {priority}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase",
                padding: "3px 8px", borderRadius: 999,
                background: os.bg, color: os.color,
              }}>
                {owner}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
