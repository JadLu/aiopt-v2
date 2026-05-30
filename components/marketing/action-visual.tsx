"use client";

import { useState } from "react";
import { Sparkles, CalendarDays } from "lucide-react";
import type { ActionData } from "@/lib/mock-data";

interface ActionVisualProps {
  data: ActionData | null | undefined;
  onRegenerate: () => void;
}

const PRIORITY_COLOR: Record<string, string> = {
  high:   "var(--danger)",
  medium: "var(--warning)",
  low:    "var(--success)",
};

export function ActionVisual({ data, onRegenerate }: ActionVisualProps) {
  const [activeWeek, setActiveWeek] = useState(0);

  if (!data) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "48px 24px", textAlign: "center" }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "color-mix(in srgb, var(--danger) 12%, transparent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CalendarDays size={20} color="var(--danger)" strokeWidth={1.6} />
        </div>
        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", margin: 0 }}>No visual data yet</p>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>Regenerate the plan to get the graphical 30-day action plan.</p>
        <button className="btn-primary" style={{ width: "auto", marginTop: 4, padding: "8px 20px", fontSize: 13 }} onClick={onRegenerate}>
          <Sparkles size={13} /> Regenerate Plan
        </button>
      </div>
    );
  }

  const week = data.weeks[activeWeek];
  const allTasks = data.weeks.flatMap(w => w.tasks);
  const highCount = allTasks.filter(t => t.priority === "high").length;
  const medCount  = allTasks.filter(t => t.priority === "medium").length;
  const lowCount  = allTasks.filter(t => t.priority === "low").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Summary row */}
      <div style={{ display: "flex", gap: 10 }}>
        {([ ["high", highCount, "High Priority"], ["medium", medCount, "Medium"], ["low", lowCount, "Low"] ] as const).map(([p, count, label]) => (
          <div key={p} style={{ flex: 1, background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: PRIORITY_COLOR[p] }}>{count}</div>
          </div>
        ))}
      </div>

      {/* Week tabs */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
        {data.weeks.map(({ label, focus }, i) => (
          <button
            key={label}
            onClick={() => setActiveWeek(i)}
            style={{
              display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, flexShrink: 0,
              padding: "10px 16px", borderRadius: 10, textAlign: "left",
              border: `1px solid ${activeWeek === i ? "var(--danger)" : "var(--border-default)"}`,
              background: activeWeek === i ? "color-mix(in srgb, var(--danger) 8%, transparent)" : "var(--bg-elevated)",
              cursor: "pointer", fontFamily: "inherit", transition: "all 0.13s",
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: activeWeek === i ? "var(--danger)" : "var(--text-secondary)" }}>{label}</span>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)", whiteSpace: "nowrap", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>{focus}</span>
          </button>
        ))}
      </div>

      {/* Active week tasks */}
      {week && (
        <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "color-mix(in srgb, var(--danger) 12%, transparent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CalendarDays size={13} color="var(--danger)" strokeWidth={1.8} />
            </div>
            <div>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{week.label}</span>
              <span style={{ fontSize: 12, color: "var(--text-tertiary)", marginLeft: 8 }}>{week.focus}</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {week.tasks.map(({ task, priority, owner }, i) => {
              const color = PRIORITY_COLOR[priority] ?? "var(--text-tertiary)";
              return (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 14px", background: "var(--bg-subtle)", borderRadius: 9 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0, marginTop: 5 }} />
                  <span style={{ fontSize: 13, color: "var(--text-primary)", flex: 1, lineHeight: 1.5 }}>{task}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color, background: `color-mix(in srgb, ${color} 12%, transparent)`, padding: "2px 7px", borderRadius: 99, textTransform: "capitalize" }}>{priority}</span>
                    <span style={{ fontSize: 10, color: "var(--text-tertiary)", background: "var(--bg-elevated)", border: "1px solid var(--border-default)", padding: "2px 7px", borderRadius: 99 }}>{owner}</span>
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
