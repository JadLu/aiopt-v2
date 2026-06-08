"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, MapPin, Calendar,
  Target, TrendingUp, DollarSign, Activity, Sparkles, BookOpen, Layers, Trash2,
  Globe, Share2, PenSquare, Clock, BarChart3, Flag, RotateCw,
  ChevronDown, Lock,
} from "lucide-react";
import { useAuth } from "@/lib/contexts/auth-context";
import { subscribeToProject, deleteProject, updateProject } from "@/lib/firebase/projects";
import { subscribeToAiCreatives } from "@/lib/firebase/ai-creatives";
import { subscribeToCreatives } from "@/lib/firebase/creatives";
import { subscribeToAiVideos } from "@/lib/firebase/ai-videos";
import { GeneratePlanDialog } from "@/components/dashboard/generate-plan-dialog";
import { MarketAnalysisVisual } from "@/components/marketing/market-analysis-visual";
import { ChannelsVisual } from "@/components/marketing/channels-visual";
import { ContentVisual } from "@/components/marketing/content-visual";
import { PhasesVisual } from "@/components/marketing/phases-visual";
import { KpiVisual } from "@/components/marketing/kpi-visual";
import { ActionVisual } from "@/components/marketing/action-visual";
import { CreativeStudio } from "@/components/projects/creative-studio";
import type { Project, ProjectStatus } from "@/lib/mock-data";

const STATUS_LABELS: Record<string, string> = {
  "active": "Active", "in-draft": "In Draft", "testing": "Testing",
  "completed": "Completed", "archived": "Archived",
};

type StatusTransition = {
  status: ProjectStatus;
  label: string;
  locked?: boolean;
  hint?: string;
};

function getTransitions(project: Project, hasCreative: boolean): StatusTransition[] {
  const eligible = !!project.marketingPlan && hasCreative;
  const lockHint = !project.marketingPlan
    ? "Generate a marketing plan first"
    : !hasCreative
    ? "Generate at least one creative first"
    : undefined;

  switch (project.status) {
    case "in-draft":
      return [
        { status: "testing",   label: "Move to Testing",   locked: !eligible, hint: lockHint },
        { status: "completed", label: "Mark as Completed", locked: !eligible, hint: lockHint },
        { status: "archived",  label: "Archive" },
      ];
    case "testing":
      return [
        { status: "active",    label: "Mark as Active" },
        { status: "completed", label: "Mark as Completed" },
        { status: "archived",  label: "Archive" },
      ];
    case "active":
      return [
        { status: "completed", label: "Mark as Completed" },
        { status: "archived",  label: "Archive" },
      ];
    case "completed":
      return [{ status: "archived", label: "Archive" }];
    case "archived":
      return [{ status: "in-draft", label: "Restore to Draft" }];
    default:
      return [];
  }
}

function StatusDropdown({
  project,
  uid,
  hasCreative,
}: {
  project: Project;
  uid: string;
  hasCreative: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const transitions = getTransitions(project, hasCreative);

  useEffect(() => {
    if (!open) return;
    const close = () => { setOpen(false); setPos(null); };
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  if (transitions.length === 0) {
    return <span className={`status-badge ${project.status}`}>{STATUS_LABELS[project.status] ?? project.status}</span>;
  }

  async function moveTo(status: ProjectStatus) {
    setSaving(true);
    try { await updateProject(uid, project.id, { status }); }
    finally { setSaving(false); setOpen(false); setPos(null); }
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => {
          if (open) { setOpen(false); setPos(null); return; }
          const rect = btnRef.current?.getBoundingClientRect();
          if (!rect) return;
          setPos({ top: rect.bottom + 6, left: rect.left });
          setOpen(true);
        }}
        disabled={saving}
        className={`status-badge ${project.status}`}
        style={{ cursor: "pointer", border: "none", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5 }}
      >
        {STATUS_LABELS[project.status] ?? project.status}
        <ChevronDown size={11} strokeWidth={2.2} style={{ opacity: 0.7 }} />
      </button>

      {open && pos && createPortal(
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 39 }}
            onMouseDown={(e) => { e.stopPropagation(); setOpen(false); setPos(null); }}
          />
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              position: "fixed", top: pos.top, left: pos.left, zIndex: 40,
              background: "var(--bg-elevated)", border: "1px solid var(--border-default)",
              borderRadius: "var(--r-card)", boxShadow: "var(--card-shadow)",
              minWidth: 210, overflow: "hidden", padding: "4px 0",
            }}
          >
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", color: "var(--text-tertiary)", padding: "6px 14px 2px", margin: 0, textTransform: "uppercase" }}>
              Move project to
            </p>
            {transitions.map(({ status, label, locked, hint }) => (
              <button
                key={status}
                title={hint}
                disabled={locked || saving}
                onClick={() => { if (!locked) moveTo(status); }}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%",
                  padding: "9px 14px", border: "none", background: "none",
                  color: locked ? "var(--text-tertiary)" : "var(--text-primary)",
                  cursor: locked ? "not-allowed" : "pointer",
                  fontFamily: "inherit", fontSize: 13, fontWeight: 500,
                  opacity: locked ? 0.55 : 1,
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { if (!locked) e.currentTarget.style.background = "var(--chip)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
              >
                <span className={`status-badge ${status}`} style={{ fontSize: 10, padding: "2px 7px", pointerEvents: "none", flexShrink: 0 }}>
                  {STATUS_LABELS[status]}
                </span>
                <span style={{ flex: 1 }}>{label}</span>
                {locked && <Lock size={10} strokeWidth={2} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </>
  );
}

function healthColor(score: number) {
  if (score <= 40) return "var(--danger)";
  if (score <= 70) return "var(--warning)";
  return "var(--success)";
}

type ActiveTab = "plan" | "creative";

/* ── Section card shell ── */
function PlanCard({
  icon: Icon,
  gradFrom,
  gradTo,
  label,
  subtitle,
  onRegenerate,
  children,
  fullWidth = false,
}: {
  icon: React.ElementType;
  gradFrom: string;
  gradTo: string;
  label: string;
  subtitle: string;
  onRegenerate: () => void;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className="glass-card" style={{ padding: "20px 22px", gridColumn: fullWidth ? "1 / -1" : undefined, display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, gap: 12 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: `linear-gradient(135deg, ${gradFrom} 0%, ${gradTo} 100%)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 4px 12px ${gradFrom}44`,
          }}>
            <Icon size={18} color="#fff" strokeWidth={1.9} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.2px", lineHeight: 1.2 }}>{label}</div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 3 }}>{subtitle}</div>
          </div>
        </div>
        <button
          onClick={onRegenerate}
          style={{
            display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
            padding: "6px 12px", borderRadius: 8, border: "none",
            background: "var(--chip)", cursor: "pointer",
            color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, fontFamily: "inherit",
            transition: "background 0.13s, color 0.13s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--chip-hover)"; e.currentTarget.style.color = "var(--text-primary)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "var(--chip)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
        >
          <RotateCw size={12} strokeWidth={2} /> Regenerate
        </button>
      </div>
      {children}
    </div>
  );
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [loadingProject, setLoadingProject] = useState(true);
  const [aiCreativeDone, setAiCreativeDone] = useState(false);
  const [manualCreativeExists, setManualCreativeExists] = useState(false);
  const [aiVideoDone, setAiVideoDone] = useState(false);
  const hasCreative = aiCreativeDone || manualCreativeExists || aiVideoDone;
  const [activeTab, setActiveTab] = useState<ActiveTab>("plan");
  const [generatePlanOpen, setGeneratePlanOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsubProject = subscribeToProject(user.uid, id, (p) => {
      setProject(p);
      setLoadingProject(false);
    });
    const unsubAiCreatives = subscribeToAiCreatives(user.uid, id, (creatives) => {
      setAiCreativeDone(creatives.some((c) => c.status === "done"));
    });
    const unsubCreatives = subscribeToCreatives(user.uid, id, (creatives) => {
      setManualCreativeExists(creatives.length > 0);
    });
    const unsubAiVideos = subscribeToAiVideos(user.uid, id, (videos) => {
      setAiVideoDone(videos.some((v) => v.status === "done"));
    });
    return () => { unsubProject(); unsubAiCreatives(); unsubCreatives(); unsubAiVideos(); };
  }, [user, id]);

  if (loadingProject) {
    return (
      <>
        <header className="app-topbar">
          <button onClick={() => router.back()} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: 13, fontFamily: "inherit" }}>
            <ArrowLeft size={15} /> Back
          </button>
        </header>
        <div className="app-content">
          <div className="glass-card" style={{ height: 200, opacity: 0.35 }} />
        </div>
      </>
    );
  }

  if (!project) {
    return (
      <>
        <header className="app-topbar">
          <button onClick={() => router.back()} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: 13, fontFamily: "inherit" }}>
            <ArrowLeft size={15} /> Back
          </button>
        </header>
        <div className="app-content">
          <div className="glass-card">
            <div className="empty-state">
              <p style={{ color: "var(--text-secondary)", fontSize: 14, fontWeight: 600, margin: 0 }}>Project not found</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  const hasData = project.status !== "in-draft";

  async function handleAddMarketingAngle(angle: { name: string; size: string; traits: string[] }) {
    if (!user || !project || !project.planVisualData?.market) return;
    const updatedMarket = {
      ...project.planVisualData.market,
      segments: [...project.planVisualData.market.segments, angle],
    };
    await updateProject(user.uid, project.id, {
      planVisualData: { ...project.planVisualData, market: updatedMarket },
    });
  }

  return (
    <>
      {/* Topbar */}
      <header className="app-topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => router.push("/projects")}
            style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 13, fontFamily: "inherit", padding: 0 }}
          >
            Projects
          </button>
          <span style={{ color: "var(--text-tertiary)", fontSize: 13 }}>/</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{project.name}</span>
        </div>
        <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
          <button
            className="btn-primary"
            style={{ width: "auto", padding: "8px 16px", fontSize: 13 }}
            onClick={() => setGeneratePlanOpen(true)}
          >
            <RotateCw size={14} strokeWidth={2} />
            {project.marketingPlan ? "Regenerate Plan" : "Generate Plan"}
          </button>
          <button
            onClick={() => setDeleteConfirmOpen(true)}
            className="icon-btn"
            aria-label="Delete project"
            style={{ color: "var(--danger)" }}
          >
            <Trash2 size={15} strokeWidth={1.8} />
          </button>
        </div>
      </header>

      <div className="app-content fade-up">

        {/* Project header */}
        <div className="glass-card" style={{ marginBottom: 20, padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
            {project.productImageUrl ? (
              <img src={project.productImageUrl} alt={project.name} style={{ width: 54, height: 54, borderRadius: 12, objectFit: "cover", flexShrink: 0 }} />
            ) : (
              <div style={{ width: 54, height: 54, borderRadius: 12, background: "var(--chip)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 26 }}>
                {project.emoji}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 5 }}>
                <h1 style={{ fontSize: 19, fontWeight: 700, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.4px" }}>{project.name}</h1>
                <StatusDropdown project={project} uid={user?.uid ?? ""} hasCreative={hasCreative} />
                {hasData && (
                  <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: healthColor(project.healthIndex) }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: healthColor(project.healthIndex), display: "inline-block" }} />
                    {project.healthIndex >= 71 ? "Healthy" : project.healthIndex >= 41 ? "Watch" : "Critical"}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 14, color: "var(--text-tertiary)", fontSize: 12 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <MapPin size={11} strokeWidth={1.8} />{project.country}
                </span>
                {hasData && (
                  <>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--accent-primary)", fontWeight: 600 }}>
                      ROAS {project.roas.toFixed(1)}x
                    </span>
                    <span>Spend · 30d ${project.spend.toLocaleString()}</span>
                  </>
                )}
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Calendar size={11} strokeWidth={1.8} />{project.createdAt}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Main tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
          {([
            { key: "plan" as const, label: "Plan", icon: BookOpen },
            { key: "creative" as const, label: "Creative", icon: Layers },
          ]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "9px 18px", borderRadius: 10, fontSize: 13,
                border: `1px solid ${activeTab === key ? "var(--accent-primary)" : "var(--hairline)"}`,
                background: activeTab === key ? "rgba(90,200,214,0.10)" : "var(--chip)",
                color: activeTab === key ? "var(--accent-primary)" : "var(--text-secondary)",
                fontWeight: activeTab === key ? 600 : 400,
                cursor: "pointer", fontFamily: "inherit", transition: "all 0.13s",
              }}
            >
              <Icon size={14} strokeWidth={1.8} /> {label}
            </button>
          ))}
        </div>

        {/* ── Plan tab ── */}
        {activeTab === "plan" && (
          <>
            {project.marketingPlan ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

                {/* Row 1 — full width */}
                <PlanCard fullWidth icon={Globe} gradFrom="#5AC8D6" gradTo="#6FB1E8" label="Market Analysis" subtitle="Market size · competitors · positioning" onRegenerate={() => setGeneratePlanOpen(true)}>
                  <MarketAnalysisVisual data={project.planVisualData?.market ?? project.marketAnalysisData} onRegenerate={() => setGeneratePlanOpen(true)} onAddAngle={handleAddMarketingAngle} />
                </PlanCard>

                {/* Row 2 — Channels | Content */}
                <PlanCard icon={Share2} gradFrom="#6FB1E8" gradTo="#9B8FE8" label="Channels" subtitle="Recommended platforms & budget split" onRegenerate={() => setGeneratePlanOpen(true)}>
                  <ChannelsVisual data={project.planVisualData?.channels} onRegenerate={() => setGeneratePlanOpen(true)} />
                </PlanCard>

                <PlanCard icon={PenSquare} gradFrom="#9B8FE8" gradTo="#C084FC" label="Content" subtitle="Themes & creative formats" onRegenerate={() => setGeneratePlanOpen(true)}>
                  <ContentVisual data={project.planVisualData?.content} onRegenerate={() => setGeneratePlanOpen(true)} />
                </PlanCard>

                {/* Row 3 — Phases | KPIs */}
                <PlanCard icon={Clock} gradFrom="#34C759" gradTo="#30D158" label="Phases" subtitle="Campaign rollout timeline" onRegenerate={() => setGeneratePlanOpen(true)}>
                  <PhasesVisual data={project.planVisualData?.phases} onRegenerate={() => setGeneratePlanOpen(true)} />
                </PlanCard>

                <PlanCard icon={BarChart3} gradFrom="#FF9F0A" gradTo="#FFB340" label="KPIs" subtitle="Targets vs. current performance" onRegenerate={() => setGeneratePlanOpen(true)}>
                  <KpiVisual data={project.planVisualData?.kpi} onRegenerate={() => setGeneratePlanOpen(true)} />
                </PlanCard>

                {/* Row 4 — full width */}
                <PlanCard fullWidth icon={Flag} gradFrom="#FF3B30" gradTo="#FF6B6B" label="Action Plan" subtitle="Prioritized next steps" onRegenerate={() => setGeneratePlanOpen(true)}>
                  <ActionVisual data={project.planVisualData?.action} onRegenerate={() => setGeneratePlanOpen(true)} />
                </PlanCard>

              </div>
            ) : (
              <div className="glass-card">
                <div className="empty-state">
                  <div className="empty-icon">
                    <Sparkles size={22} strokeWidth={1.5} color="var(--text-tertiary)" />
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", margin: 0 }}>No marketing plan yet</p>
                  <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>Generate an AI-powered plan tailored to {project.country}.</p>
                  <button className="btn-primary" style={{ width: "auto", marginTop: 8, padding: "9px 20px", fontSize: 13 }} onClick={() => setGeneratePlanOpen(true)}>
                    <Sparkles size={14} /> Generate Marketing Plan
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Creative tab ── */}
        {activeTab === "creative" && user && (
          <CreativeStudio project={project} uid={user.uid} />
        )}
      </div>

      {/* Dialogs */}
      {user && project && (
        <GeneratePlanDialog open={generatePlanOpen} onClose={() => setGeneratePlanOpen(false)} uid={user.uid} project={project} />
      )}

      {deleteConfirmOpen && project && (
        <div className="dialog-overlay" onClick={() => !deleting && setDeleteConfirmOpen(false)}>
          <div className="dialog-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(229,118,118,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Trash2 size={18} color="var(--danger)" />
              </div>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Delete Project</h2>
                <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>This action cannot be undone.</p>
              </div>
            </div>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, margin: "0 0 24px" }}>
              Are you sure you want to delete <strong style={{ color: "var(--text-primary)" }}>{project.emoji} {project.name}</strong>? All data will be permanently removed.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn-secondary" disabled={deleting} onClick={() => setDeleteConfirmOpen(false)}>Cancel</button>
              <button
                disabled={deleting}
                onClick={async () => {
                  if (!user) return;
                  setDeleting(true);
                  try { await deleteProject(user.uid, project.id); router.push("/projects"); }
                  catch { setDeleting(false); }
                }}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, flex: 1, padding: "10px 20px", borderRadius: 10, border: "none", background: "var(--danger)", color: "#fff", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: deleting ? "not-allowed" : "pointer", opacity: deleting ? 0.6 : 1 }}
              >
                <Trash2 size={14} /> {deleting ? "Deleting…" : "Delete Project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
