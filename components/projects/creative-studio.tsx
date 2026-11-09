"use client";

import { useState, useEffect, useRef } from "react";
import {
  Sparkles, Download, AlertCircle, MoreVertical, Trash2, X,
  ImageIcon, Video, Globe, Loader2,
} from "lucide-react";
import { useAuth } from "@/lib/contexts/auth-context";
import { authFetch, readApiError, downloadViaProxy } from "@/lib/auth-fetch";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import { InsufficientCreditsModal } from "@/components/credits/InsufficientCreditsModal";
import { CreditTooltip } from "@/components/credits/CreditTooltip";
import { LiquidButton } from "@/components/ui/liquid-button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { CriteriaPicker, PromptEditor } from "./studio-parts";
import { VideoStudio } from "./video-studio";
import { LandingPageStudio } from "./landing-page-studio";
import {
  createAiCreative, updateAiCreativeImageUrl, failAiCreative,
  subscribeToAiCreatives, deleteAiCreative, type AiCreative,
} from "@/lib/firebase/ai-creatives";
import { updateProject } from "@/lib/firebase/projects";
import type { Project } from "@/lib/mock-data";

// ─── Marketing-plan extraction helpers ───────────────────────────────────────

function stripMd(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#{1,6}\s+.+$/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/^[-*+•]\s*/gm, "")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/\n+/g, " ")
    .trim();
}

const ALL_SECTION_KW = [
  "market & audience", "market and audience", "audience analysis", "market analysis",
  "marketing channel", "budget allocation", "channel allocation",
  "content & creative", "content and creative", "creative strategy",
  "campaign phase",
  "key performance indicator", "kpis", "kpi &", "benchmark",
  "30-day action", "30 day action", "action plan",
];

function extractSection(plan: string, keywords: string[]): string {
  const norm = (s: string) => s.toLowerCase().replace(/^\d+[\.\)]\s*/, "").trim();
  const lines = plan.split("\n");
  let capturing = false;
  const captured: string[] = [];
  for (const line of lines) {
    const m = line.match(/^#{1,4} (.+)/);
    if (m) {
      const heading = norm(m[1]);
      if (keywords.some(k => heading.includes(k))) { capturing = true; continue; }
      if (capturing && ALL_SECTION_KW.some(k => heading.includes(k))) break;
    }
    if (capturing) captured.push(line);
  }
  return stripMd(captured.join("\n")).replace(/\s+/g, " ").trim();
}

const AUDIENCE_KW = ["market & audience", "market and audience", "audience analysis", "market analysis"];
const CONTENT_KW  = ["content & creative", "content and creative", "creative strategy"];

function extractBrief(project: Project): { audience: string; angle: string } {
  if (!project.marketingPlan) return { audience: "", angle: "" };
  return {
    audience: extractSection(project.marketingPlan, AUDIENCE_KW).slice(0, 220),
    angle:    extractSection(project.marketingPlan, CONTENT_KW).slice(0, 220),
  };
}

export function buildAutoPrompt(project: Project): string {
  const { audience, angle } = extractBrief(project);
  const lines: string[] = [
    `High-converting e-commerce ad creative for "${project.name}" — ${project.country} market.`,
  ];
  if (project.description) lines.push(`Product: ${project.description}`);
  if (audience)            lines.push(`Marketing Angle: ${audience}`);
  if (angle)               lines.push(`Creative & visual direction: ${angle}`);
  lines.push(
    `Produce a premium-quality, culturally relevant ad image optimised for digital performance marketing in ${project.country}. Professional lighting, clean composition, brand-safe.`
  );
  return lines.join("\n\n");
}

// ─── Criteria-driven prompt builder ──────────────────────────────────────────

interface CriteriaState {
  segmentIdx: number | null;
  channelIdx: number | null;
  pillarIdx:  number | null;
  hookIdx:    number | null;
  angleText:  string;
}

function defaultCriteria(project: Project): CriteriaState {
  const vd = project.planVisualData;
  const chs = vd?.channels?.channels ?? [];
  const primaryIdx = chs.findIndex(c => c.primary);
  return {
    segmentIdx: vd?.market?.segments?.length  ? Math.min(project.selectedAngle ?? 0, vd.market.segments.length - 1) : null,
    channelIdx: chs.length ? (primaryIdx >= 0 ? primaryIdx : 0) : null,
    pillarIdx:  vd?.content?.pillars?.length  ? 0 : null,
    hookIdx:    vd?.content?.hooks?.length    ? 0 : null,
    angleText:  project.marketingAngle ?? "",
  };
}

function buildPromptFromCriteria(project: Project, criteria: CriteriaState): string {
  const vd = project.planVisualData;
  const lines: string[] = [
    `High-converting e-commerce ad creative for "${project.name}" — ${project.country} market.`,
  ];
  if (project.description) lines.push(`Product: ${project.description}`);

  const seg = criteria.segmentIdx !== null ? vd?.market?.segments?.[criteria.segmentIdx] : null;
  if (seg) lines.push(`Marketing Angle: ${seg.name} (${seg.size}) — ${seg.traits.join(", ")}`);

  const ch = criteria.channelIdx !== null ? vd?.channels?.channels?.[criteria.channelIdx] : null;
  if (ch) {
    const fmts = ch.formats.slice(0, 2).join(", ");
    lines.push(`Platform: ${ch.name}${fmts ? ` — ${fmts} format` : ""}`);
  }

  const pillar = criteria.pillarIdx !== null ? vd?.content?.pillars?.[criteria.pillarIdx] : null;
  const tone   = vd?.content?.tone ?? "";
  if (pillar) {
    lines.push(`Creative Direction: ${pillar.name} — ${pillar.description}${tone ? `. Tone: ${tone}` : ""}`);
  } else if (tone) {
    lines.push(`Creative tone: ${tone}`);
  }

  const hook = criteria.hookIdx !== null ? vd?.content?.hooks?.[criteria.hookIdx] : null;
  if (hook) lines.push(`Hook: "${hook}"`);

  if (criteria.angleText.trim()) lines.push(`Marketing Angle: ${criteria.angleText.trim()}`);

  lines.push(
    `Produce a premium-quality, culturally relevant ad image optimised for digital performance marketing in ${project.country}. Professional lighting, clean composition, brand-safe.`
  );
  return lines.join("\n\n");
}

// ─── Constants ────────────────────────────────────────────────────────────────

const IMAGE_ASPECT_RATIOS = ["1:1", "4:5", "9:16"] as const;

const IMAGE_STYLES = ["Lifestyle", "Product shot", "UGC", "Studio"] as const;
type ImageStyle = typeof IMAGE_STYLES[number];

const IMAGE_STYLE_PROMPTS: Record<ImageStyle, string> = {
  "Lifestyle":     "lifestyle photography, natural authentic setting, soft natural light",
  "Product shot":  "clean product shot, studio lighting, neutral minimalist background",
  "UGC":           "UGC style, phone-filmed, authentic raw user-generated content, relatable",
  "Studio":        "professional studio photography, dramatic lighting, high-end commercial aesthetic",
};

type Resolution = "1K" | "2K" | "4K";
type GenStatus  = "idle" | "submitting" | "polling" | "done" | "error";

interface GenState {
  status:      GenStatus;
  taskId:      string | null;
  imageUrl:    string | null;
  error:       string | null;
  prompt:      string;
  aspectRatio: string;
  resolution:  Resolution;
}

const INITIAL_GEN: GenState = {
  status: "idle", taskId: null, imageUrl: null, error: null,
  prompt: "", aspectRatio: "4:5", resolution: "2K",
};


function parseKieResponse(raw: Record<string, unknown>): {
  isDone: boolean; isFailed: boolean; url: string | null;
} {
  const status = String(raw.status ?? "").toLowerCase();
  const isDone = status === "success" || status === "done";
  const url    = raw.imageUrl ? String(raw.imageUrl) : null;
  return { isDone: isDone || !!url, isFailed: status === "failed" || status === "error", url };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface CreativeStudioProps {
  project: Project;
  uid:     string;
}

export function CreativeStudio({ project, uid }: CreativeStudioProps) {
  const { credits } = useAuth();
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [creativeTab, setCreativeTab] = useState<"images" | "videos" | "landing-page">("images");
  const [aiCreatives, setAiCreatives] = useState<AiCreative[]>([]);
  const [imageStyle,  setImageStyle]  = useState<ImageStyle | null>("Lifestyle");
  const [showPrompt,  setShowPrompt]  = useState(false);
  const [criteria,    setCriteria]    = useState<CriteriaState>(() => defaultCriteria(project));
  const [gen, setGen] = useState<GenState>(() => {
    const crit = defaultCriteria(project);
    return {
      ...INITIAL_GEN,
      prompt: project.planVisualData
        ? buildPromptFromCriteria(project, crit)
        : buildAutoPrompt(project),
    };
  });

  const pendingDocRef  = useRef<string | null>(null);
  const activePollsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  useEffect(() => {
    const unsub = subscribeToAiCreatives(uid, project.id, setAiCreatives);
    return unsub;
  }, [uid, project.id]);

  useEffect(() => {
    const fresh = defaultCriteria(project);
    setCriteria(fresh);
    setGen(prev => ({
      ...INITIAL_GEN,
      prompt: project.planVisualData
        ? buildPromptFromCriteria(project, fresh)
        : buildAutoPrompt(project),
      aspectRatio: prev.aspectRatio,
      resolution:  prev.resolution,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, project.marketingPlan]);

  useEffect(() => {
    return () => {
      for (const iv of activePollsRef.current.values()) clearInterval(iv);
      activePollsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const active = activePollsRef.current;

    for (const creative of aiCreatives) {
      if (creative.imageUrl || !creative.taskId || active.has(creative.id)) continue;

      let attempts = 0;
      const taskId     = creative.taskId;
      const creativeId = creative.id;

      const iv = setInterval(async () => {
        attempts++;
        if (attempts > 80) {
          clearInterval(iv);
          active.delete(creativeId);
          await failAiCreative(uid, project.id, creativeId);
          return;
        }
        try {
          const res = await authFetch(`/api/generate-creative/status?taskId=${taskId}`);
          if (res.status === 404) {
            clearInterval(iv);
            active.delete(creativeId);
            await failAiCreative(uid, project.id, creativeId);
            return;
          }
          const raw = await res.json() as Record<string, unknown>;
          const { isDone, isFailed, url } = parseKieResponse(raw);

          if (isDone) {
            clearInterval(iv);
            active.delete(creativeId);
            if (url) await updateAiCreativeImageUrl(uid, project.id, creativeId, url);
            else     await failAiCreative(uid, project.id, creativeId);
          } else if (isFailed) {
            clearInterval(iv);
            active.delete(creativeId);
            await failAiCreative(uid, project.id, creativeId);
          }
        } catch (err) {
          console.error(`[creative-poller] fetch error — creativeId=${creativeId}`, err);
        }
      }, 3000);

      active.set(creativeId, iv);
    }

    for (const [id, iv] of active) {
      const c = aiCreatives.find(x => x.id === id);
      if (!c || c.imageUrl) { clearInterval(iv); active.delete(id); }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiCreatives]);

  useEffect(() => {
    const docId = pendingDocRef.current;
    if (!docId) return;
    const creative = aiCreatives.find(c => c.id === docId);
    if (!creative) return;
    if (creative.imageUrl) {
      setGen(g => ({ ...INITIAL_GEN, prompt: g.prompt, aspectRatio: g.aspectRatio, resolution: g.resolution }));
      pendingDocRef.current = null;
    } else if (creative.status === "failed") {
      setGen(g => ({ ...INITIAL_GEN, prompt: g.prompt, aspectRatio: g.aspectRatio, resolution: g.resolution, error: "Generation failed. Please try again." }));
      pendingDocRef.current = null;
    }
  }, [aiCreatives]);

  async function handleGenerate() {
    if (!gen.prompt.trim()) return;

    setGen(g => ({ ...g, status: "submitting", error: null, imageUrl: null, taskId: null }));
    try {
      const styleSuffix = imageStyle ? `\n\nStyle direction: ${IMAGE_STYLE_PROMPTS[imageStyle]}` : "";
      const body: Record<string, unknown> = {
        projectId:   project.id,
        prompt:      gen.prompt + styleSuffix,
        aspectRatio: gen.aspectRatio,
        resolution:  gen.resolution,
      };
      if (project.productImageUrl) body.imageInput = [project.productImageUrl];

      const res  = await authFetch("/api/generate-creative", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 402) {
        setGen(g => ({ ...INITIAL_GEN, prompt: g.prompt, aspectRatio: g.aspectRatio, resolution: g.resolution }));
        setCreditModalOpen(true);
        return;
      }
      if (!res.ok) {
        const message = await readApiError(res, "Failed to start generation.");
        setGen(g => ({ ...INITIAL_GEN, prompt: g.prompt, aspectRatio: g.aspectRatio, resolution: g.resolution, error: message }));
        return;
      }
      const data = await res.json() as { taskId?: string };
      if (!data.taskId) {
        setGen(g => ({ ...INITIAL_GEN, prompt: g.prompt, aspectRatio: g.aspectRatio, resolution: g.resolution, error: "Failed to start generation." }));
        return;
      }

      const docId = await createAiCreative(uid, project.id, {
        prompt:      gen.prompt,
        imageUrl:    "",
        aspectRatio: gen.aspectRatio,
        resolution:  gen.resolution,
        taskId:      data.taskId,
        status:      "pending",
      });

      pendingDocRef.current = docId;
      setGen(g => ({ ...g, status: "polling", taskId: data.taskId! }));
    } catch {
      setGen(g => ({ ...INITIAL_GEN, prompt: g.prompt, aspectRatio: g.aspectRatio, resolution: g.resolution, error: "Network error. Please try again." }));
    }
  }

  const isGenerating = gen.status === "submitting" || gen.status === "polling";

  function updateCriteria(patch: Partial<CriteriaState>) {
    setCriteria(prev => {
      const next = { ...prev, ...patch };
      setGen(g => ({ ...g, prompt: buildPromptFromCriteria(project, next) }));
      return next;
    });
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>

      {/* Studio tabs */}
      <SegmentedControl
        ariaLabel="Creative type"
        className="studio-tabs"
        value={creativeTab}
        onChange={setCreativeTab}
        options={[
          { value: "images",       label: "Images",        icon: <ImageIcon size={15} strokeWidth={1.8} aria-hidden /> },
          { value: "videos",       label: "Videos",        icon: <Video size={15} strokeWidth={1.8} aria-hidden /> },
          { value: "landing-page", label: "Landing Pages", icon: <Globe size={15} strokeWidth={1.8} aria-hidden /> },
        ]}
      />

      {creativeTab === "videos" && (
        <VideoStudio project={project} uid={uid} />
      )}

      {creativeTab === "landing-page" && (
        <LandingPageStudio project={project} uid={uid} />
      )}

      {creativeTab === "images" && (<>

      {/* Generator */}
      <section className="glass studio-card" aria-label="Image generator">
        <CriteriaPicker
          project={project}
          criteria={criteria}
          disabled={isGenerating}
          onChange={updateCriteria}
          onAngleText={val => {
            setCriteria(prev => {
              const next = { ...prev, angleText: val };
              setGen(g => ({ ...g, prompt: buildPromptFromCriteria(project, next) }));
              return next;
            });
          }}
          onAngleBlur={() => {
            const saved = project.marketingAngle ?? "";
            if (criteria.angleText !== saved) {
              updateProject(uid, project.id, { marketingAngle: criteria.angleText });
            }
          }}
        />

        <PromptEditor
          id="image-prompt"
          open={showPrompt}
          onToggle={() => setShowPrompt(s => !s)}
          value={gen.prompt}
          onChange={v => setGen(g => ({ ...g, prompt: v }))}
          disabled={isGenerating}
          placeholder="Describe the creative you want to generate…"
        />

        <hr className="studio-divider" />

        {/* Options + generate */}
        <div className="studio-controls">
          <div className="studio-control">
            <span className="field-label">Aspect</span>
            <SegmentedControl
              ariaLabel="Aspect ratio"
              disabled={isGenerating}
              value={gen.aspectRatio as typeof IMAGE_ASPECT_RATIOS[number]}
              onChange={ratio => setGen(g => ({ ...g, aspectRatio: ratio }))}
              options={IMAGE_ASPECT_RATIOS.map(r => ({ value: r, label: r }))}
            />
          </div>

          <div className="studio-control" role="group" aria-label="Style">
            <span className="field-label">Style</span>
            <div className="studio-chips">
              {IMAGE_STYLES.map(style => (
                <button
                  key={style}
                  type="button"
                  className="chip"
                  aria-pressed={imageStyle === style}
                  disabled={isGenerating}
                  onClick={() => setImageStyle(s => (s === style ? null : style))}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          <div className="studio-spacer">
            <span className="stat-chip">
              <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--success)", flex: "none" }} />
              nano-banana-2
            </span>
            <CreditTooltip cost={CREDIT_COSTS.PHOTO}>
              <LiquidButton
                icon={<Sparkles size={16} fill="currentColor" aria-hidden />}
                loading={isGenerating}
                disabled={!gen.prompt.trim()}
                onClick={handleGenerate}
              >
                {isGenerating ? "Generating…" : `Generate · ${CREDIT_COSTS.PHOTO} credits`}
              </LiquidButton>
            </CreditTooltip>
          </div>
        </div>

        {gen.error && (
          <p role="alert" className="studio-error"><AlertCircle size={15} style={{ flex: "none" }} aria-hidden /> {gen.error}</p>
        )}
      </section>

      {/* Gallery */}
      {aiCreatives.length > 0 && (
        <div className="studio-gallery">
          {aiCreatives.map(c => <AiCreativeCard key={c.id} creative={c} uid={uid} projectId={project.id} />)}
        </div>
      )}

      <InsufficientCreditsModal
        open={creditModalOpen}
        onClose={() => setCreditModalOpen(false)}
        required={CREDIT_COSTS.PHOTO}
        balance={credits ?? 0}
      />

      </>)}
    </div>
  );
}

// ─── Gallery card ─────────────────────────────────────────────────────────────

interface AiCreativeCardProps {
  creative:  AiCreative;
  uid:       string;
  projectId: string;
}

function AiCreativeCard({ creative, uid, projectId }: AiCreativeCardProps) {
  const [imgError, setImgError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isPending = !!creative.taskId && !creative.imageUrl;
  const isFailed  = !creative.taskId && creative.status === "failed" && !creative.imageUrl;
  const hasImage  = !!creative.imageUrl && !imgError;

  const aspectCss = (creative.aspectRatio ?? "1:1").replace(":", " / ");
  const title = creative.prompt.split(/[\n.!?]/)[0].trim().slice(0, 64);

  function handleDownload() {
    if (!creative.imageUrl) return;
    setMenuOpen(false);
    downloadViaProxy(creative.imageUrl, `creative-${creative.id}.jpg`).catch(() => { /* surfaced by browser no-op */ });
  }

  async function handleDelete() {
    setMenuOpen(false);
    setDeleting(true);
    try { await deleteAiCreative(uid, projectId, creative.id); }
    catch { setDeleting(false); }
  }

  // Escape closes the lightbox.
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLightbox(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox]);

  // A generation whose image no longer loads is left out of the gallery.
  if (imgError) return null;

  return (
    <>
      <div className={`gen-tile lift${deleting ? " deleting" : ""}`} style={{ aspectRatio: aspectCss }}>
        {hasImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={creative.imageUrl} alt="" draggable={false}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            onError={() => setImgError(true)}
          />
        )}

        {hasImage && (
          <button type="button" className="gen-open" aria-label={`Open image: ${title}`} onClick={() => setLightbox(true)} />
        )}

        {isPending && (
          <div className="gen-state shimmer" role="status">
            <Loader2 size={24} className="spinner" style={{ color: "var(--accent-primary)" }} aria-hidden />
            <span>Creative<br />generating…</span>
          </div>
        )}

        {isFailed && (
          <div className="gen-state">
            <AlertCircle size={22} style={{ color: "var(--danger)" }} aria-hidden />
            <span style={{ color: "var(--danger)" }}>Generation<br />failed. Credits refunded.</span>
          </div>
        )}

        <span className="gen-badge">{creative.aspectRatio}</span>

        {/* Menu */}
        <button type="button" className="gen-menu-btn" aria-label="Image options" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(o => !o)}>
          <MoreVertical size={16} aria-hidden />
        </button>
        {menuOpen && (
          <>
            <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setMenuOpen(false)} />
            <div className="glass gen-menu" role="menu">
              {hasImage && (
                <button type="button" role="menuitem" className="menu-item" onClick={handleDownload}>
                  <Download size={14} aria-hidden /> <span style={{ flex: 1, textAlign: "left" }}>Save</span>
                </button>
              )}
              <button type="button" role="menuitem" className="menu-item danger" onClick={handleDelete}>
                <Trash2 size={14} aria-hidden /> <span style={{ flex: 1, textAlign: "left" }}>Delete</span>
              </button>
            </div>
          </>
        )}

        {hasImage && (
          <div className="gen-caption">
            <div className="gen-caption-title" dir="auto">{title}</div>
            <div className="gen-caption-meta">{creative.aspectRatio} · nano-banana-2 · {creative.createdAt}</div>
          </div>
        )}
      </div>

      {lightbox && hasImage && (
        <div className="dialog-overlay" style={{ zIndex: 100 }} role="dialog" aria-modal="true" aria-label={title} onClick={() => setLightbox(false)}>
          <div style={{ position: "relative", maxWidth: "min(90vw, 900px)", maxHeight: "90vh", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }} onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={creative.imageUrl} alt={creative.prompt} style={{ maxWidth: "100%", maxHeight: "78vh", borderRadius: 24, objectFit: "contain", boxShadow: "var(--card-shadow)" }} />
            <div style={{ display: "flex", gap: 10 }}>
              <LiquidButton icon={<Download size={15} aria-hidden />} onClick={handleDownload}>Download</LiquidButton>
              <button type="button" className="btn-secondary glass-inner" style={{ width: "auto", minHeight: 48, padding: "0 22px", display: "inline-flex", alignItems: "center", gap: 8 }} onClick={() => setLightbox(false)}>
                <X size={15} aria-hidden /> Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
