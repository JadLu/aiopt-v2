"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { MapPin, MoreHorizontal, ImageIcon, ClipboardList, Sparkles, Megaphone, TrendingUp, TrendingDown, Lock } from "lucide-react";
import type { Project, ProjectStatus } from "@/lib/mock-data";
import { updateProject } from "@/lib/firebase/projects";
import { GeneratePlanDialog } from "./generate-plan-dialog";

const STATUS_LABELS: Record<string, string> = {
  "active": "Active", "in-draft": "In Draft", "testing": "Testing",
  "completed": "Completed", "archived": "Archived",
};

type CardTransition = { status: ProjectStatus; label: string; locked?: boolean; hint?: string };

function getCardTransitions(project: Project): CardTransition[] {
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

function healthStatus(score: number, status: string): { label: string; color: string } {
  if (status === "in-draft") return { label: "In Draft", color: "var(--accent-primary)" };
  if (score <= 40) return { label: "Critical", color: "var(--danger)" };
  if (score <= 70) return { label: "Watch", color: "var(--warning)" };
  return { label: "Healthy", color: "var(--success)" };
}

function formatSpend(n: number): string {
  if (n >= 10000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toLocaleString()}`;
}

export function ProjectCard({ project, uid, delay = 0 }: { project: Project; uid: string; delay?: number }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [kebabOpen, setKebabOpen] = useState(false);
  const [kebabPos, setKebabPos] = useState<{ top: number; right: number } | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const kebabRef = useRef<HTMLButtonElement>(null);

  // Close on scroll or outside click
  useEffect(() => {
    if (!kebabOpen) return;
    const close = () => { setKebabOpen(false); setKebabPos(null); };
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [kebabOpen]);

  async function handleStatusChange(status: ProjectStatus) {
    setSavingStatus(true);
    try { await updateProject(uid, project.id, { status }); }
    finally { setSavingStatus(false); setKebabOpen(false); }
  }

  const hasMetrics = project.spend > 0;
  const { label, color } = healthStatus(project.healthIndex, project.status);
  const roasUp = hasMetrics && project.roas >= project.targetRoas;
  const transitions = getCardTransitions(project);

  const actions = [
    { label: "Plan",     Icon: ClipboardList, href: `/projects/${project.id}` },
    { label: "Creative", Icon: Sparkles,      href: `/projects/${project.id}` },
    { label: "Ads",      Icon: Megaphone,     href: "/advertising" },
  ];

  return (
    <>
      <div
        className="glass-card project-card rise"
        style={{ animationDelay: `${delay}ms`, padding: 0, overflow: "hidden", cursor: "pointer" }}
        onClick={() => router.push(`/projects/${project.id}`)}
      >
        {/* ── Image area ── */}
        <div style={{ position: "relative", height: 148, background: "var(--chip)", overflow: "hidden" }}>
          {project.productImageUrl ? (
            <img
              src={project.productImageUrl}
              alt={project.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", height: "100%", gap: 8,
              color: "var(--text-tertiary)",
            }}>
              <ImageIcon size={26} strokeWidth={1.4} />
              <div style={{ textAlign: "center", lineHeight: 1.4 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500 }}>Product photo</div>
                <div style={{ fontSize: 11.5, color: "var(--accent-primary)" }}>or browse files</div>
              </div>
            </div>
          )}

          {/* Overlay: health badge + kebab */}
          <div style={{
            position: "absolute", top: 10, left: 10, right: 10,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "4px 10px", borderRadius: 999,
              background: "rgba(0,0,0,.42)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              fontSize: 12, fontWeight: 600, color,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
              {label}
            </span>

            <button
              ref={kebabRef}
              onClick={(e) => {
                e.stopPropagation();
                if (kebabOpen) { setKebabOpen(false); setKebabPos(null); return; }
                const rect = e.currentTarget.getBoundingClientRect();
                setKebabPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
                setKebabOpen(true);
              }}
              disabled={savingStatus}
              style={{
                width: 28, height: 28, borderRadius: 8, border: "none",
                background: kebabOpen ? "rgba(0,0,0,.6)" : "rgba(0,0,0,.42)",
                backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "rgba(255,255,255,.75)", cursor: "pointer",
                transition: "background 0.13s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,.6)"; }}
              onMouseLeave={(e) => { if (!kebabOpen) e.currentTarget.style.background = "rgba(0,0,0,.42)"; }}
            >
              <MoreHorizontal size={14} strokeWidth={1.9} />
            </button>

            {kebabOpen && kebabPos && transitions.length > 0 && createPortal(
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 39 }} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setKebabOpen(false); setKebabPos(null); }} />
                <div
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: "fixed", top: kebabPos.top, right: kebabPos.right, zIndex: 40,
                    background: "var(--bg-elevated)", border: "1px solid var(--border-default)",
                    borderRadius: "var(--r-card)", boxShadow: "var(--card-shadow)",
                    minWidth: 195, overflow: "hidden", padding: "4px 0",
                  }}
                >
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", color: "var(--text-tertiary)", padding: "6px 12px 2px", margin: 0, textTransform: "uppercase" }}>
                    Move to
                  </p>
                  {transitions.map(({ status, label: tLabel, locked, hint }) => (
                    <button
                      key={status}
                      title={hint}
                      disabled={locked || savingStatus}
                      onClick={() => { if (!locked) handleStatusChange(status); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 8, width: "100%",
                        padding: "8px 12px", border: "none", background: "none",
                        color: locked ? "var(--text-tertiary)" : "var(--text-primary)",
                        cursor: locked ? "not-allowed" : "pointer",
                        fontFamily: "inherit", fontSize: 12.5, fontWeight: 500,
                        opacity: locked ? 0.5 : 1, transition: "background 0.1s",
                      }}
                      onMouseEnter={(e) => { if (!locked) e.currentTarget.style.background = "var(--chip)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                    >
                      <span className={`status-badge ${status}`} style={{ fontSize: 10, padding: "2px 6px", pointerEvents: "none", flexShrink: 0 }}>
                        {STATUS_LABELS[status]}
                      </span>
                      <span style={{ flex: 1 }}>{tLabel}</span>
                      {locked && <Lock size={10} strokeWidth={2} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />}
                    </button>
                  ))}
                </div>
              </>,
              document.body
            )}
          </div>
        </div>

        {/* ── Card body ── */}
        <div style={{ padding: "14px 14px 14px" }}>

          {/* Name + location */}
          <h3 style={{
            fontSize: 15.5, fontWeight: 700, color: "var(--text-primary)",
            margin: "0 0 4px", letterSpacing: "-0.3px",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {project.name}
          </h3>
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            color: "var(--text-tertiary)", fontSize: 12.5, marginBottom: 14,
          }}>
            <MapPin size={11} strokeWidth={1.8} />
            <span>{project.country}</span>
          </div>

          {/* Metric boxes */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            {/* ROAS */}
            <div style={{ background: "var(--chip)", borderRadius: 10, padding: "8px 10px" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 5 }}>ROAS</div>
              {hasMetrics ? (
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 16, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>
                  {project.roas.toFixed(1)}x
                  {roasUp
                    ? <TrendingUp size={13} strokeWidth={2.2} color="var(--success)" />
                    : <TrendingDown size={13} strokeWidth={2.2} color="var(--danger)" />}
                </div>
              ) : (
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-tertiary)" }}>—</div>
              )}
            </div>

            {/* Spend */}
            <div style={{ background: "var(--chip)", borderRadius: 10, padding: "8px 10px" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 5 }}>Spend · 30d</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>
                {hasMetrics ? formatSpend(project.spend) : "—"}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            {actions.map(({ label: actionLabel, Icon, href }) => (
              <button
                key={actionLabel}
                onClick={(e) => {
                  e.stopPropagation();
                  if (actionLabel === "Plan" && project.status === "in-draft") {
                    setDialogOpen(true);
                  } else {
                    router.push(href);
                  }
                }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  padding: "7px 4px",
                  background: "var(--chip)", border: "none", borderRadius: 9,
                  color: "var(--text-secondary)", cursor: "pointer",
                  fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                  transition: "background 0.13s var(--ease), color 0.13s",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--chip-hover)";
                  e.currentTarget.style.color = "var(--text-primary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--chip)";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }}
              >
                <Icon size={13} strokeWidth={1.9} />
                {actionLabel}
              </button>
            ))}
          </div>
        </div>
      </div>

      <GeneratePlanDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        uid={uid}
        project={project}
      />
    </>
  );
}
