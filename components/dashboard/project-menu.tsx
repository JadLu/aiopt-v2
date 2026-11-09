"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, Lock } from "lucide-react";
import type { Project, ProjectStatus } from "@/lib/mock-data";
import { updateProject } from "@/lib/firebase/projects";
import { STATUS_LABELS } from "@/components/ui/status-badge";

type Transition = { status: ProjectStatus; label: string; locked?: boolean; hint?: string };

function getTransitions(project: Project): Transition[] {
  const hasPlan = !!project.marketingPlan;
  const lockHint = "Generate a marketing plan first";
  switch (project.status) {
    case "in-draft":    return [
      { status: "testing",   label: "Move to Testing",   locked: !hasPlan, hint: lockHint },
      { status: "completed", label: "Mark as Completed", locked: !hasPlan, hint: lockHint },
      { status: "archived",  label: "Archive" },
    ];
    case "testing":     return [
      { status: "active",    label: "Mark as Active" },
      { status: "completed", label: "Mark as Completed" },
      { status: "archived",  label: "Archive" },
    ];
    case "active":      return [
      { status: "completed", label: "Mark as Completed" },
      { status: "archived",  label: "Archive" },
    ];
    case "completed":   return [{ status: "archived",  label: "Archive" }];
    case "archived":    return [{ status: "in-draft",  label: "Restore to Draft" }];
    default:            return [];
  }
}

/** Options (kebab) button + "Move to" popover, shared by the dashboard card and the projects row. */
export function ProjectMenu({ project, uid, size = 36 }: { project: Project; uid: string; size?: number }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  function close() { setOpen(false); setPos(null); }

  // Close on scroll, outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); setPos(null); btnRef.current?.focus(); }
    };
    const onAway = () => { setOpen(false); setPos(null); };
    document.addEventListener("mousedown", onAway);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onAway, true);
    return () => {
      document.removeEventListener("mousedown", onAway);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onAway, true);
    };
  }, [open]);

  async function change(status: ProjectStatus) {
    setSaving(true);
    try { await updateProject(uid, project.id, { status }); }
    finally { setSaving(false); close(); }
  }

  const transitions = getTransitions(project);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label="Project options"
        aria-haspopup="menu"
        aria-expanded={open}
        className="glass-inner icon-chip"
        style={{ width: size, height: size, color: "var(--text-primary)", borderRadius: size > 40 ? 16 : 12 }}
        disabled={saving}
        onClick={(e) => {
          e.stopPropagation();
          if (open) { close(); return; }
          const rect = e.currentTarget.getBoundingClientRect();
          setPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
          setOpen(true);
        }}
      >
        <MoreHorizontal size={16} strokeWidth={1.9} />
      </button>

      {open && pos && transitions.length > 0 && createPortal(
        <div
          role="menu"
          className="glass"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed", top: pos.top, right: pos.right, zIndex: 40,
            borderRadius: "var(--r-tile)", minWidth: 215, overflow: "hidden", padding: "6px 0",
            background: "var(--glass-strong)",
          }}
        >
          <div className="label-caps" style={{ padding: "6px 14px 4px", fontSize: 10 }}>Move to</div>
          {transitions.map(({ status, label, locked, hint }) => (
            <button
              key={status}
              type="button"
              role="menuitem"
              title={hint}
              disabled={locked || saving}
              onClick={() => { if (!locked) change(status); }}
              className="menu-item"
            >
              <span className={`status-badge ${status}`} style={{ fontSize: 10, padding: "2px 6px", pointerEvents: "none", flexShrink: 0 }}>
                {STATUS_LABELS[status]}
              </span>
              <span style={{ flex: 1, textAlign: "left" }}>{label}</span>
              {locked && <Lock size={11} strokeWidth={2} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
