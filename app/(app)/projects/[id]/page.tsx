"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronRight, ChevronDown, Lock, Trash2, RotateCw, Sparkles, ImageIcon, FolderX } from "lucide-react";
import { useAuth } from "@/lib/contexts/auth-context";
import { subscribeToProject, deleteProject, updateProject } from "@/lib/firebase/projects";
import { subscribeToAiCreatives } from "@/lib/firebase/ai-creatives";
import { subscribeToAiVideos } from "@/lib/firebase/ai-videos";
import { startMarketingPlan, regenerateAngle } from "@/lib/marketing-plan-client";
import { projectCountryCodes, countryName, voiceLabel } from "@/lib/countries";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import { CreativeStudio } from "@/components/projects/creative-studio";
import { ProjectStepper, type StepId, type StepInfo } from "@/components/projects/project-stepper";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ProjectSwitcher } from "@/components/projects/project-switcher";
import { PlanStep, countDraftSections, PLAN_SECTIONS } from "@/components/projects/plan-step";
import { BriefStep } from "@/components/projects/brief-step";
import { LibraryStep } from "@/components/projects/library-step";
import { InsufficientCreditsModal } from "@/components/credits/InsufficientCreditsModal";
import { LiquidButton } from "@/components/ui/liquid-button";
import { EmptyState } from "@/components/ui/empty-state";
import { MenuButton } from "@/components/ui/menu-button";
import { STATUS_LABELS } from "@/components/ui/status-badge";
import type { Project, ProjectStatus, PlanVisualData, MarketAnalysisData } from "@/lib/mock-data";

type StatusTransition = { status: ProjectStatus; label: string; locked?: boolean; hint?: string };

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

function StatusDropdown({ project, uid, hasCreative }: { project: Project; uid: string; hasCreative: boolean }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const transitions = getTransitions(project, hasCreative);
  const open = pos !== null;

  useEffect(() => {
    if (!open) return;
    const close = () => setPos(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setPos(null); btnRef.current?.focus(); } };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  if (transitions.length === 0) {
    return <span className={`status-badge ${project.status}`}>{STATUS_LABELS[project.status] ?? project.status}</span>;
  }

  async function moveTo(status: ProjectStatus) {
    setSaving(true);
    try { await updateProject(uid, project.id, { status }); }
    finally { setSaving(false); setPos(null); }
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Status: ${STATUS_LABELS[project.status] ?? project.status}. Change status`}
        disabled={saving}
        className={`status-badge ${project.status}`}
        style={{ cursor: "pointer", border: "none", fontFamily: "inherit", minHeight: 28 }}
        onClick={() => {
          if (open) { setPos(null); return; }
          const rect = btnRef.current?.getBoundingClientRect();
          if (rect) setPos({ top: rect.bottom + 6, left: rect.left });
        }}
      >
        {STATUS_LABELS[project.status] ?? project.status}
        <ChevronDown size={11} strokeWidth={2.2} style={{ opacity: 0.7 }} aria-hidden />
      </button>

      {pos && createPortal(
        <div
          role="menu"
          className="glass"
          onMouseDown={(e) => e.stopPropagation()}
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 40, minWidth: 225, padding: "6px 0", borderRadius: "var(--r-tile)", overflow: "hidden", background: "var(--glass-strong)" }}
        >
          <div className="label-caps" style={{ padding: "6px 14px 4px", fontSize: 10 }}>Move project to</div>
          {transitions.map(({ status, label, locked, hint }) => (
            <button
              key={status}
              type="button"
              role="menuitem"
              title={hint}
              disabled={locked || saving}
              className="menu-item"
              onClick={() => { if (!locked) moveTo(status); }}
            >
              <span className={`status-badge ${status}`} style={{ fontSize: 10, padding: "2px 7px", pointerEvents: "none", flexShrink: 0 }}>
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

const MAX_MARKET_CHIPS = 3;

/** Remounts the workspace per project, so step, errors and dialogs never leak between projects. */
export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <ProjectWorkspace key={id} />;
}

function ProjectWorkspace() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, credits } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [loadingProject, setLoadingProject] = useState(true);
  const [aiCreativeDone, setAiCreativeDone] = useState(false);
  const [aiVideoDone, setAiVideoDone] = useState(false);
  const hasCreative = aiCreativeDone || aiVideoDone;

  const [step, setStep] = useState<StepId>("plan");
  const [confirmRegenOpen, setConfirmRegenOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [busyAngle, setBusyAngle] = useState<number | null>(null);
  const [angleError, setAngleError] = useState<string | null>(null);
  const [creditModal, setCreditModal] = useState<{ required: number; balance: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsubProject = subscribeToProject(user.uid, id, (p) => {
      setProject(p);
      setLoadingProject(false);
    });
    const unsubAiCreatives = subscribeToAiCreatives(user.uid, id, (creatives) => {
      setAiCreativeDone(creatives.some((c) => c.status === "done"));
    });
    const unsubAiVideos = subscribeToAiVideos(user.uid, id, (videos) => {
      setAiVideoDone(videos.some((v) => v.status === "done"));
    });
    return () => { unsubProject(); unsubAiCreatives(); unsubAiVideos(); };
  }, [user, id]);

  if (loadingProject) {
    return (
      <div style={{ padding: "28px 16px 48px", display: "flex", flexDirection: "column", gap: 22 }}>
        <div className="shimmer" style={{ height: 64, width: "50%", borderRadius: 20 }} />
        <div className="shimmer" style={{ height: 74, borderRadius: 24 }} />
        <div className="shimmer" style={{ height: 280, borderRadius: 28 }} />
      </div>
    );
  }

  if (!project || !user) {
    return (
      <div style={{ padding: "28px 16px 48px" }}>
        <EmptyState
          icon={<FolderX size={24} />}
          title="Project not found"
          description="It may have been deleted, or the link is wrong."
          action={<LiquidButton onClick={() => router.push("/projects")}>Back to projects</LiquidButton>}
        />
      </div>
    );
  }

  const uid = user.uid;
  const pid = project.id;
  const generating = project.marketingPlanStatus === "generating";
  const hasPlan = !!project.marketingPlan;
  const planFailed = project.marketingPlanStatus === "failed";

  // While writing, show the live draft; otherwise the saved plan (older projects keep their legacy market data).
  const savedPlan: PlanVisualData = {
    ...(project.planVisualData ?? {}),
    market: project.planVisualData?.market ?? project.marketAnalysisData,
  };
  const planData: PlanVisualData = generating ? (project.planDraft ?? {}) : savedPlan;
  const angles = planData.market?.segments ?? [];
  const draftCount = countDraftSections(project.planDraft);
  const planTotal = PLAN_SECTIONS.length;

  const codes = projectCountryCodes(project);
  const voice = voiceLabel(project);

  const steps: StepInfo[] = [
    { id: "brief", label: "Brief", status: "Done", state: "done" },
    generating
      ? { id: "plan", label: "Plan", status: `Writing · ${draftCount} of ${planTotal}`, state: "progress", progress: { done: draftCount, total: planTotal } }
      : planFailed
      ? { id: "plan", label: "Plan", status: "Failed · try again", state: "error" }
      : hasPlan
      ? { id: "plan", label: "Plan", status: "Done", state: "done" }
      : { id: "plan", label: "Plan", status: "Not started", state: "idle" },
    !hasPlan || generating
      ? { id: "creatives", label: "Creatives", status: "Needs a plan first", state: "idle" }
      : hasCreative
      ? { id: "creatives", label: "Creatives", status: "Done", state: "done" }
      : project.selectedAngle === undefined && angles.length > 0
      ? { id: "creatives", label: "Creatives", status: "Pick an angle first", state: "idle" }
      : { id: "creatives", label: "Creatives", status: "Ready to generate", state: "idle" },
    { id: "library", label: "Library", status: hasCreative ? "Download & export" : "Nothing to export yet", state: "idle" },
  ];

  async function handleStartPlan() {
    if (!project || starting || generating) return;
    setPlanError(null);
    if (credits !== null && credits < CREDIT_COSTS.MARKETING_PLAN) {
      setCreditModal({ required: CREDIT_COSTS.MARKETING_PLAN, balance: credits });
      return;
    }
    setStarting(true);
    const result = await startMarketingPlan(project);
    setStarting(false);
    if (result.ok) { setStep("plan"); return; }
    if (result.kind === "credits") setCreditModal({ required: result.required, balance: result.balance });
    else setPlanError(result.message);
  }

  async function writeSegments(segments: MarketAnalysisData["segments"]) {
    const market = savedPlan.market;
    if (!market) return;
    await updateProject(uid, pid, { planVisualData: { ...savedPlan, market: { ...market, segments } } });
  }

  async function handleAddAngle(angle: { name: string; size: string; traits: string[] }) {
    const segments = savedPlan.market?.segments ?? [];
    await writeSegments([...segments, angle]);
  }

  async function handleStarAngle(index: number) {
    const segments = savedPlan.market?.segments ?? [];
    await writeSegments(segments.map((s, i) => (i === index ? { ...s, starred: !s.starred } : s)));
  }

  async function handleRegenerateAngle(index: number) {
    const target = savedPlan.market?.segments?.[index];
    if (!target || busyAngle !== null) return;
    setAngleError(null);
    if (credits !== null && credits < CREDIT_COSTS.ANGLE) {
      setCreditModal({ required: CREDIT_COSTS.ANGLE, balance: credits });
      return;
    }
    setBusyAngle(index);
    const result = await regenerateAngle(pid, index, target.name);
    setBusyAngle(null);
    if (result.ok) return; // the project subscription delivers the new angle
    if (result.kind === "credits") setCreditModal({ required: result.required, balance: result.balance });
    else setAngleError(result.message);
  }

  async function handleUseAngle(index: number) {
    await updateProject(uid, pid, { selectedAngle: index });
    setStep("creatives");
    window.scrollTo({ top: 0 });
  }

  const marketChips = codes.slice(0, MAX_MARKET_CHIPS);

  return (
    <div style={{ padding: "28px 16px 48px", display: "flex", flexDirection: "column", gap: 22 }}>
      <nav aria-label="Breadcrumb" className="crumbs">
        <Link href="/projects">Projects</Link>
        <ChevronRight size={12} aria-hidden />
        <span dir="auto" style={{ color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{project.name}</span>
      </nav>

      {/* Header */}
      <header className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
          <span className="row-thumb" style={{ width: 64, height: 64 }}>
            {project.productImageUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={project.productImageUrl} alt="" />
              : <ImageIcon size={28} strokeWidth={1.5} aria-hidden />}
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
            <h1 dir="auto" style={{ margin: 0, fontSize: 30, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.2 }}>{project.name}</h1>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <StatusDropdown project={project} uid={uid} hasCreative={hasCreative} />
              {generating && <span className="status-live">Writing plan</span>}
              {codes.length > 0
                ? <>
                    {marketChips.map((c) => (
                      <span key={c} className="stat-chip">
                        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent-primary)" }}>{c}</span>{countryName(c)}
                      </span>
                    ))}
                    {codes.length > MAX_MARKET_CHIPS && <span className="stat-chip tabular">+{codes.length - MAX_MARKET_CHIPS}</span>}
                  </>
                : <span className="stat-chip">{project.country}</span>}
              {voice && <span className="stat-chip">{voice}</span>}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ProjectSwitcher uid={uid} currentId={pid} />
          <NotificationBell />
          <MenuButton
            label="Project options"
            items={[
              { label: "Regenerate plan", icon: <RotateCw size={14} />, disabled: generating || !hasPlan, onSelect: () => setConfirmRegenOpen(true) },
              { label: "Delete project", icon: <Trash2 size={14} />, danger: true, onSelect: () => setDeleteConfirmOpen(true) },
            ]}
          />
          {generating ? (
            <LiquidButton loading disabled>Writing plan…</LiquidButton>
          ) : hasPlan && !planFailed ? (
            <LiquidButton icon={<Sparkles size={16} fill="currentColor" />} onClick={() => { setStep("creatives"); }}>
              Create creatives
            </LiquidButton>
          ) : (
            <LiquidButton icon={<Sparkles size={16} fill="currentColor" />} loading={starting} onClick={handleStartPlan}>
              Generate marketing plan
            </LiquidButton>
          )}
        </div>
      </header>

      <ProjectStepper steps={steps} current={step} onSelect={setStep} />

      {planError && <p role="alert" className="field-error" style={{ margin: 0 }}>{planError}</p>}

      {/* Steps */}
      {step === "brief" && <BriefStep project={project} />}

      {step === "plan" && (
        hasPlan || generating ? (
          <>
            {planFailed && !generating && (
              <p role="alert" className="field-error" style={{ margin: 0 }}>
                The last attempt failed{project.marketingPlanError ? `: ${project.marketingPlanError}` : "."} Your previous plan is shown below.
              </p>
            )}
            <PlanStep
              data={planData}
              generating={generating}
              angles={angles}
              selectedAngle={project.selectedAngle}
              busyAngle={busyAngle}
              angleError={angleError}
              onRegeneratePlan={() => setConfirmRegenOpen(true)}
              onStarAngle={handleStarAngle}
              onRegenerateAngle={handleRegenerateAngle}
              onUseAngle={handleUseAngle}
              onAddAngle={handleAddAngle}
            />
          </>
        ) : (
          <EmptyState
            icon={<Sparkles size={24} />}
            title="No marketing plan yet"
            description={`${planFailed ? `The last attempt failed${project.marketingPlanError ? `: ${project.marketingPlanError}` : ""}. ` : ""}Generate an AI-written plan tailored to ${project.country}. It costs ${CREDIT_COSTS.MARKETING_PLAN} credits.`}
            action={<LiquidButton icon={<Sparkles size={16} fill="currentColor" />} loading={starting} onClick={handleStartPlan}>Generate marketing plan</LiquidButton>}
          />
        )
      )}

      {step === "creatives" && (
        <>
          {!hasPlan && !generating && (
            <div className="glass-inner" style={{ borderRadius: 18, padding: "14px 16px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
              <span style={{ fontSize: 13.5, color: "var(--text-secondary)" }}>Creatives are sharper once the plan and an angle exist.</span>
              <button type="button" className="btn-secondary glass-inner" style={{ width: "auto" }} onClick={() => setStep("plan")}>Go to Plan</button>
            </div>
          )}
          <CreativeStudio project={project} uid={uid} />
        </>
      )}

      {step === "library" && (
        <LibraryStep uid={uid} projectId={pid} projectName={project.name} onGoToCreatives={() => setStep("creatives")} />
      )}

      {/* Regenerate plan confirmation */}
      {confirmRegenOpen && (
        <div className="dialog-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmRegenOpen(false); }}>
          <div className="glass" role="dialog" aria-modal="true" aria-labelledby="regen-title" style={{ width: "100%", maxWidth: 440, padding: 28, borderRadius: "var(--r-dialog)", display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 id="regen-title" style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Regenerate the plan?</h2>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)" }}>
              This writes a new plan and replaces the current sections and angles. It costs <strong className="tabular">{CREDIT_COSTS.MARKETING_PLAN}</strong> credits.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="btn-secondary glass-inner" style={{ width: "auto", minHeight: 44 }} onClick={() => setConfirmRegenOpen(false)}>Cancel</button>
              <LiquidButton autoFocus onClick={() => { setConfirmRegenOpen(false); handleStartPlan(); }}>Regenerate</LiquidButton>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirmOpen && (
        <div className="dialog-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !deleting) setDeleteConfirmOpen(false); }}>
          <div className="glass" role="alertdialog" aria-modal="true" aria-labelledby="del-title" style={{ width: "100%", maxWidth: 440, padding: 28, borderRadius: "var(--r-dialog)", display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 id="del-title" style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Delete this project?</h2>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)" }}>
              <strong dir="auto" style={{ color: "var(--text-primary)" }}>{project.name}</strong> and all its data will be permanently removed. This can&apos;t be undone.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="btn-secondary glass-inner" style={{ width: "auto", minHeight: 44 }} disabled={deleting} onClick={() => setDeleteConfirmOpen(false)}>Cancel</button>
              <button
                type="button"
                className="btn-danger"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  try { await deleteProject(uid, pid); router.push("/projects"); }
                  catch { setDeleting(false); }
                }}
              >
                <Trash2 size={14} /> {deleting ? "Deleting…" : "Delete project"}
              </button>
            </div>
          </div>
        </div>
      )}

      {creditModal && (
        <InsufficientCreditsModal open onClose={() => setCreditModal(null)} required={creditModal.required} balance={credits ?? creditModal.balance} />
      )}
    </div>
  );
}
