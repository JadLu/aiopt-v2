"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, MapPin, Calendar, Layers,
  Target, TrendingUp, DollarSign, Activity, Sparkles, BookOpen, Trash2,
  Globe, BarChart3, Palette, Flag, CalendarDays,
} from "lucide-react";
import { useAuth } from "@/lib/contexts/auth-context";
import { subscribeToProject, deleteProject } from "@/lib/firebase/projects";
import { GeneratePlanDialog } from "@/components/dashboard/generate-plan-dialog";
import { MarkdownRenderer } from "@/components/marketing/markdown-renderer";
import { MarketAnalysisVisual } from "@/components/marketing/market-analysis-visual";
import { ChannelsVisual } from "@/components/marketing/channels-visual";
import { ContentVisual } from "@/components/marketing/content-visual";
import { PhasesVisual } from "@/components/marketing/phases-visual";
import { KpiVisual } from "@/components/marketing/kpi-visual";
import { ActionVisual } from "@/components/marketing/action-visual";
import { CreativeStudio } from "@/components/projects/creative-studio";
import type { Project } from "@/lib/mock-data";

const STATUS_LABELS: Record<string, string> = {
  "active": "Active", "in-draft": "In Draft", "testing": "Testing",
  "scaling": "Scaling", "completed": "Completed", "archived": "Archived",
};

const PLAN_SECTION_DEFS = [
  { id: "market",   label: "Market & Audience Analysis",              icon: Globe,        color: "var(--accent-primary)",   keywords: ["market & audience", "market and audience", "audience analysis", "market analysis"] },
  { id: "channels", label: "Marketing Channels & Budget Allocation",  icon: BarChart3,    color: "var(--accent-secondary)", keywords: ["marketing channel", "channel & budget", "budget allocation", "channel allocation", "channels & budget"] },
  { id: "content",  label: "Content & Creative Strategy",             icon: Palette,      color: "#C084FC",                 keywords: ["content & creative", "content and creative", "creative strategy"] },
  { id: "phases",   label: "Campaign Phases",                         icon: Flag,         color: "var(--warning)",          keywords: ["campaign phase"] },
  { id: "kpi",      label: "Key Performance Indicators & Benchmarks", icon: Target,       color: "var(--success)",          keywords: ["key performance indicator", "performance indicator", "kpis", "kpi &", "benchmarks"] },
  { id: "action",   label: "30-Day Action Plan",                      icon: CalendarDays, color: "var(--danger)",           keywords: ["30-day action", "30 day action", "30-day plan", "action plan"] },
];

function parsePlanSections(markdown: string) {
  // Only treat a heading as a section boundary if it matches one of our 6 expected keywords.
  // This keeps AI-generated sub-headings (## Phase 1, ## Week 1, etc.) inside their parent section.
  const allKeywords = PLAN_SECTION_DEFS.flatMap(d => d.keywords);
  const normalise = (s: string) => s.toLowerCase().replace(/^\d+[\.\)]\s*/, "").trim();

  const lines = markdown.split("\n");
  const sections: { heading: string; content: string }[] = [];
  let current: { heading: string; lines: string[] } | null = null;

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,4} (.+)/);
    if (headingMatch) {
      const text = normalise(headingMatch[1]);
      const isTopSection = allKeywords.some(k => text.includes(k));
      if (isTopSection) {
        if (current) sections.push({ heading: current.heading, content: current.lines.join("\n").trim() });
        current = { heading: headingMatch[1].trim(), lines: [] };
        continue;
      }
    }
    if (current) current.lines.push(line);
  }
  if (current) sections.push({ heading: current.heading, content: current.lines.join("\n").trim() });
  return sections;
}

function healthColor(score: number) {
  if (score <= 40) return "var(--danger)";
  if (score <= 70) return "var(--warning)";
  return "var(--success)";
}

type ActiveTab = "plan" | "creative";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [loadingProject, setLoadingProject] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("plan");
  const [activePlanSection, setActivePlanSection] = useState("market");
  const [generatePlanOpen, setGeneratePlanOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToProject(user.uid, id, (p) => {
      setProject(p);
      setLoadingProject(false);
    });
    return unsub;
  }, [user, id]);

  if (loadingProject) {
    return (
      <>
        <header className="app-topbar">
          <button onClick={() => router.back()} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: 13, fontFamily: "inherit" }}>
            <ArrowLeft size={15} /> Back
          </button>
        </header>
        <div className="app-content fade-up">
          <div className="card" style={{ height: 200, opacity: 0.4, background: "var(--bg-elevated)" }} />
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
          <div className="card">
            <div className="empty-state">
              <p style={{ color: "var(--text-secondary)", fontSize: 14, fontWeight: 600, margin: 0 }}>Project not found</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  const hasData = project.status !== "in-draft";

  return (
    <>
      <header className="app-topbar">
        <button
          onClick={() => router.push("/projects")}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: 13, fontFamily: "inherit", padding: 0 }}
        >
          <ArrowLeft size={15} /> Projects
        </button>
        <button
          onClick={() => setDeleteConfirmOpen(true)}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px solid var(--border-default)", borderRadius: 10, cursor: "pointer", color: "var(--danger)", fontSize: 13, fontFamily: "inherit", padding: "8px 14px", fontWeight: 500 }}
        >
          <Trash2 size={14} /> Delete
        </button>
      </header>

      <div className="app-content fade-up">

        {/* Project header card */}
        <div className="card" style={{ marginBottom: 20, padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
            <div className="project-img" style={{ width: 52, height: 52, borderRadius: 14, fontSize: 26, flexShrink: 0 }}>
              <span>{project.emoji}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{project.name}</h1>
                <span className={`status-badge ${project.status}`}>{STATUS_LABELS[project.status]}</span>
              </div>
              {project.description && (
                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 8px" }}>{project.description}</p>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 16, color: "var(--text-tertiary)", fontSize: 12 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <MapPin size={11} strokeWidth={1.8} />{project.country}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Calendar size={11} strokeWidth={1.8} />Created {project.createdAt}
                </span>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 0, borderTop: "1px solid var(--border-default)", marginTop: 18, paddingTop: 16 }}>
            {[
              { icon: Target, label: "Target CPA", value: `$${project.targetCpa.toFixed(0)}`, color: "var(--text-primary)" },
              { icon: TrendingUp, label: "Target ROAS", value: `${project.targetRoas.toFixed(1)}x`, color: "var(--text-primary)" },
              ...(hasData ? [
                { icon: DollarSign, label: "Actual CPA", value: `$${project.cpa.toFixed(2)}`, color: "var(--text-primary)" },
                { icon: TrendingUp, label: "Actual ROAS", value: `${project.roas.toFixed(1)}x`, color: "var(--text-primary)" },
                { icon: DollarSign, label: "Spend", value: `$${(project.spend / 1000).toFixed(1)}k`, color: "var(--text-primary)" },
                { icon: Activity, label: "Health", value: String(project.healthIndex), color: healthColor(project.healthIndex) },
              ] : []),
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} style={{ textAlign: "center", padding: "0 8px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4 }}>
                  <Icon size={10} />{label}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Main tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
          {([
            { key: "plan" as const, label: "Marketing Plan", icon: BookOpen },
            { key: "creative" as const, label: "Creative", icon: Layers },
          ]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "9px 18px", borderRadius: 10, fontSize: 13,
                border: `1px solid ${activeTab === key ? "var(--accent-primary)" : "var(--border-default)"}`,
                background: activeTab === key ? "rgba(90,200,214,0.10)" : "var(--bg-elevated)",
                color: activeTab === key ? "var(--accent-primary)" : "var(--text-secondary)",
                fontWeight: activeTab === key ? 600 : 400,
                cursor: "pointer", fontFamily: "inherit", transition: "all 0.13s",
              }}
            >
              <Icon size={14} strokeWidth={1.8} /> {label}
            </button>
          ))}
        </div>

        {/* Marketing Plan tab */}
        {activeTab === "plan" && (
          <div>
            {project.marketingPlan ? (
              <>
                {/* Plan section sub-tabs */}
                <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 20, paddingBottom: 4 }}>
                  {PLAN_SECTION_DEFS.map(({ id: sId, label, icon: Icon, color }) => (
                    <button
                      key={sId}
                      onClick={() => setActivePlanSection(sId)}
                      style={{
                        display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
                        padding: "8px 14px", borderRadius: 10, fontSize: 12,
                        border: `1px solid ${activePlanSection === sId ? color : "var(--border-default)"}`,
                        background: activePlanSection === sId ? `color-mix(in srgb, ${color} 10%, transparent)` : "var(--bg-elevated)",
                        color: activePlanSection === sId ? color : "var(--text-secondary)",
                        fontWeight: activePlanSection === sId ? 600 : 400,
                        cursor: "pointer", fontFamily: "inherit", transition: "all 0.13s",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <Icon size={13} strokeWidth={1.8} /> {label}
                    </button>
                  ))}
                </div>

                {/* Active section content */}
                {(() => {
                  const parsed = parsePlanSections(project.marketingPlan!);
                  const def = PLAN_SECTION_DEFS.find(d => d.id === activePlanSection)!;
                  const SectionIcon = def.icon;
                  const section = parsed.find(s =>
                    def.keywords.some(k => s.heading.toLowerCase().replace(/^\d+[\.\)]\s*/, "").includes(k))
                  );
                  return (
                    <div className="card" style={{ padding: "20px 24px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid var(--border-default)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: 9,
                            background: `color-mix(in srgb, ${def.color} 14%, transparent)`,
                            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                          }}>
                            <SectionIcon size={16} color={def.color} strokeWidth={1.8} />
                          </div>
                          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{def.label}</h3>
                        </div>
                        <button
                          className="btn-secondary"
                          style={{ width: "auto", padding: "6px 14px", fontSize: 12 }}
                          onClick={() => setGeneratePlanOpen(true)}
                        >
                          <Sparkles size={13} /> Regenerate
                        </button>
                      </div>
                      {activePlanSection === "market" ? (
                        <MarketAnalysisVisual
                          data={project.planVisualData?.market ?? project.marketAnalysisData}
                          onRegenerate={() => setGeneratePlanOpen(true)}
                        />
                      ) : activePlanSection === "channels" ? (
                        <ChannelsVisual
                          data={project.planVisualData?.channels}
                          onRegenerate={() => setGeneratePlanOpen(true)}
                        />
                      ) : activePlanSection === "content" ? (
                        <ContentVisual
                          data={project.planVisualData?.content}
                          onRegenerate={() => setGeneratePlanOpen(true)}
                        />
                      ) : activePlanSection === "phases" ? (
                        <PhasesVisual
                          data={project.planVisualData?.phases}
                          onRegenerate={() => setGeneratePlanOpen(true)}
                        />
                      ) : activePlanSection === "kpi" ? (
                        <KpiVisual
                          data={project.planVisualData?.kpi}
                          onRegenerate={() => setGeneratePlanOpen(true)}
                        />
                      ) : activePlanSection === "action" ? (
                        <ActionVisual
                          data={project.planVisualData?.action}
                          onRegenerate={() => setGeneratePlanOpen(true)}
                        />
                      ) : section ? (
                        <MarkdownRenderer content={section.content} />
                      ) : (
                        <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0, fontStyle: "italic" }}>
                          Section not available in this plan.
                        </p>
                      )}
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="card">
                <div className="empty-state">
                  <div className="empty-icon">
                    <Sparkles size={22} strokeWidth={1.5} color="var(--text-tertiary)" />
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", margin: 0 }}>
                    No marketing plan yet
                  </p>
                  <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>
                    Generate an AI-powered plan tailored to {project.country}.
                  </p>
                  <button
                    className="btn-primary"
                    style={{ width: "auto", marginTop: 8, padding: "9px 20px", fontSize: 13 }}
                    onClick={() => setGeneratePlanOpen(true)}
                  >
                    <Sparkles size={14} /> Generate Marketing Plan
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Creative tab */}
        {activeTab === "creative" && user && (
          <CreativeStudio project={project} uid={user.uid} />
        )}
      </div>

      {user && project && (
        <GeneratePlanDialog
          open={generatePlanOpen}
          onClose={() => setGeneratePlanOpen(false)}
          uid={user.uid}
          project={project}
        />
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
              Are you sure you want to delete <strong style={{ color: "var(--text-primary)" }}>{project.emoji} {project.name}</strong>? The project and all its data will be permanently removed.
            </p>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="btn-secondary"
                disabled={deleting}
                onClick={() => setDeleteConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                disabled={deleting}
                onClick={async () => {
                  if (!user) return;
                  setDeleting(true);
                  try {
                    await deleteProject(user.uid, project.id);
                    router.push("/projects");
                  } catch {
                    setDeleting(false);
                  }
                }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  flex: 1, padding: "10px 20px", borderRadius: 10, border: "none",
                  background: "var(--danger)", color: "#fff",
                  fontSize: 14, fontWeight: 600, fontFamily: "inherit",
                  cursor: deleting ? "not-allowed" : "pointer", opacity: deleting ? 0.6 : 1,
                }}
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

