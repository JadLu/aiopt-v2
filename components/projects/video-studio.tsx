"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles, AlertCircle, MoreVertical, Download, X, Trash2, Play, Loader2, ExternalLink } from "lucide-react";
import { useAuth } from "@/lib/contexts/auth-context";
import { authFetch, readApiError, downloadViaProxy } from "@/lib/auth-fetch";
import { videoCreditCost } from "@/lib/credit-costs";
import { InsufficientCreditsModal } from "@/components/credits/InsufficientCreditsModal";
import { CreditTooltip } from "@/components/credits/CreditTooltip";
import { LiquidButton } from "@/components/ui/liquid-button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { CriteriaPicker, PromptEditor } from "./studio-parts";
import {
  createAiVideo, updateAiVideoUrl, failAiVideo,
  subscribeToAiVideos, deleteAiVideo, type AiVideo,
} from "@/lib/firebase/ai-videos";
import {
  subscribeToRenderedVideos, type RenderedVideo,
} from "@/lib/firebase/rendered-videos";
import { VideoEditor, RenderedVideoCard } from "./video-editor";
import { updateProject } from "@/lib/firebase/projects";
import type { Project } from "@/lib/mock-data";

// ─── Prompt builder ───────────────────────────────────────────────────────────

interface CriteriaState {
  segmentIdx: number | null;
  channelIdx: number | null;
  pillarIdx:  number | null;
  hookIdx:    number | null;
  angleText:  string;
}

function defaultCriteria(project: Project): CriteriaState {
  const vd  = project.planVisualData;
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

function buildVideoPrompt(project: Project, criteria: CriteriaState): string {
  const vd    = project.planVisualData;
  const lines: string[] = [
    `High-converting e-commerce video ad for "${project.name}" — ${project.country} market.`,
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
    `Produce a high-converting short-form video ad for ${project.country}. ` +
    `Vertical format, thumb-stopping opening, clear product showcase, strong call-to-action.`
  );
  return lines.join("\n\n");
}

// ─── KIE parser ───────────────────────────────────────────────────────────────

function parseVideoKieResponse(raw: Record<string, unknown>): {
  isDone: boolean; isFailed: boolean; url: string | null;
} {
  const status  = String(raw.status ?? "").toLowerCase();
  const isDone  = status === "success" || status === "done";
  const url     = raw.videoUrl ? String(raw.videoUrl) : null;
  return { isDone: isDone || !!url, isFailed: status === "failed" || status === "error", url };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VIDEO_ASPECT_RATIOS = ["9:16", "16:9", "1:1"] as const;
const VIDEO_DURATIONS     = ["5", "8", "10"] as const;
const VIDEO_RESOLUTIONS   = ["480p", "720p", "1080p"] as const;

type VideoDuration   = typeof VIDEO_DURATIONS[number];
type VideoResolution = typeof VIDEO_RESOLUTIONS[number];
type VideoGenStatus  = "idle" | "submitting" | "polling" | "done" | "error";

interface VideoGenState {
  status:      VideoGenStatus;
  taskId:      string | null;
  videoUrl:    string | null;
  error:       string | null;
  prompt:      string;
  aspectRatio: string;
  duration:    VideoDuration;
  resolution:  VideoResolution;
}

const INITIAL_GEN: VideoGenState = {
  status: "idle", taskId: null, videoUrl: null, error: null,
  prompt: "", aspectRatio: "9:16", duration: "8", resolution: "720p",
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface VideoStudioProps {
  project: Project;
  uid:     string;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function VideoStudio({ project, uid }: VideoStudioProps) {
  const { credits } = useAuth();
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [aiVideos,       setAiVideos]       = useState<AiVideo[]>([]);
  const [renderedVideos, setRenderedVideos] = useState<RenderedVideo[]>([]);
  const [showPrompt,     setShowPrompt]     = useState(false);
  const [criteria,       setCriteria]       = useState<CriteriaState>(() => defaultCriteria(project));
  const [gen, setGen] = useState<VideoGenState>(() => {
    const crit = defaultCriteria(project);
    return {
      ...INITIAL_GEN,
      prompt: buildVideoPrompt(project, crit),
    };
  });

  const pendingDocRef  = useRef<string | null>(null);
  const activePollsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  useEffect(() => subscribeToAiVideos(uid, project.id, setAiVideos),             [uid, project.id]);
  useEffect(() => subscribeToRenderedVideos(uid, project.id, setRenderedVideos),  [uid, project.id]);

  useEffect(() => {
    const fresh = defaultCriteria(project);
    setCriteria(fresh);
    setGen(prev => ({
      ...INITIAL_GEN,
      prompt:      buildVideoPrompt(project, fresh),
      aspectRatio: prev.aspectRatio,
      duration:    prev.duration,
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

    for (const video of aiVideos) {
      if (video.videoUrl || !video.taskId || active.has(video.id)) continue;

      let attempts = 0;
      const taskId  = video.taskId;
      const videoId = video.id;

      const iv = setInterval(async () => {
        attempts++;
        if (attempts > 80) {
          clearInterval(iv); active.delete(videoId);
          await failAiVideo(uid, project.id, videoId);
          return;
        }
        try {
          const res = await authFetch(`/api/generate-video/status?taskId=${taskId}`);
          if (res.status === 404) {
            clearInterval(iv); active.delete(videoId);
            await failAiVideo(uid, project.id, videoId);
            return;
          }
          const raw = await res.json() as Record<string, unknown>;
          const { isDone, isFailed, url } = parseVideoKieResponse(raw);

          if (isDone) {
            clearInterval(iv); active.delete(videoId);
            if (url) await updateAiVideoUrl(uid, project.id, videoId, url);
            else     await failAiVideo(uid, project.id, videoId);
          } else if (isFailed) {
            clearInterval(iv); active.delete(videoId);
            await failAiVideo(uid, project.id, videoId);
          }
        } catch (err) {
          console.error(`[video-poller] fetch error — videoId=${videoId}`, err);
        }
      }, 3000);

      active.set(videoId, iv);
    }

    for (const [id, iv] of active) {
      const v = aiVideos.find(x => x.id === id);
      if (!v || v.videoUrl) { clearInterval(iv); active.delete(id); }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiVideos]);

  useEffect(() => {
    const docId = pendingDocRef.current;
    if (!docId) return;
    const video = aiVideos.find(v => v.id === docId);
    if (!video) return;
    if (video.videoUrl) {
      setGen(g => ({ ...INITIAL_GEN, prompt: g.prompt, aspectRatio: g.aspectRatio, duration: g.duration, resolution: g.resolution }));
      pendingDocRef.current = null;
    } else if (video.status === "failed") {
      setGen(g => ({ ...INITIAL_GEN, prompt: g.prompt, aspectRatio: g.aspectRatio, duration: g.duration, resolution: g.resolution, error: "Generation failed. Please try again." }));
      pendingDocRef.current = null;
    }
  }, [aiVideos]);

  async function handleVideoGenerate() {
    if (!gen.prompt.trim()) return;

    setGen(g => ({ ...g, status: "submitting", error: null, videoUrl: null, taskId: null }));
    try {
      const imageUrls: string[] = project.productImageUrl ? [project.productImageUrl] : [];
      const res  = await authFetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId:   project.id,
          prompt:      gen.prompt,
          aspectRatio: gen.aspectRatio,
          duration:    gen.duration,
          resolution:  gen.resolution,
          imageUrls,
        }),
      });
      if (res.status === 402) {
        setGen(g => ({ ...INITIAL_GEN, prompt: g.prompt, aspectRatio: g.aspectRatio, duration: g.duration, resolution: g.resolution }));
        setCreditModalOpen(true);
        return;
      }
      if (!res.ok) {
        const message = await readApiError(res, "Failed to start generation.");
        setGen(g => ({ ...INITIAL_GEN, prompt: g.prompt, aspectRatio: g.aspectRatio, duration: g.duration, resolution: g.resolution, error: message }));
        return;
      }
      const data = await res.json() as { taskId?: string };
      if (!data.taskId) {
        setGen(g => ({ ...INITIAL_GEN, prompt: g.prompt, aspectRatio: g.aspectRatio, duration: g.duration, resolution: g.resolution, error: "Failed to start generation." }));
        return;
      }

      const docId = await createAiVideo(uid, project.id, {
        prompt:      gen.prompt,
        videoUrl:    "",
        aspectRatio: gen.aspectRatio,
        duration:    gen.duration,
        resolution:  gen.resolution,
        taskId:      data.taskId,
        status:      "pending",
      });

      pendingDocRef.current = docId;
      setGen(g => ({ ...g, status: "polling", taskId: data.taskId! }));
    } catch {
      setGen(g => ({ ...INITIAL_GEN, prompt: g.prompt, aspectRatio: g.aspectRatio, duration: g.duration, resolution: g.resolution, error: "Network error. Please try again." }));
    }
  }

  const isGenerating = gen.status === "submitting" || gen.status === "polling";

  function updateCriteria(patch: Partial<CriteriaState>) {
    setCriteria(prev => {
      const next = { ...prev, ...patch };
      setGen(g => ({ ...g, prompt: buildVideoPrompt(project, next) }));
      return next;
    });
  }

  type GalleryItem = { kind: "ai"; data: AiVideo } | { kind: "rendered"; data: RenderedVideo };
  const gallery: GalleryItem[] = [
    ...aiVideos.map(v      => ({ kind: "ai"       as const, data: v })),
    ...renderedVideos.map(v => ({ kind: "rendered" as const, data: v })),
  ].sort((a, b) => new Date(b.data.createdAt).getTime() - new Date(a.data.createdAt).getTime());

  const hasCriteria = !!project.planVisualData && (
    (project.planVisualData.market?.segments?.length ?? 0) +
    (project.planVisualData.channels?.channels?.length ?? 0) +
    (project.planVisualData.content?.pillars?.length ?? 0) +
    (project.planVisualData.content?.hooks?.length ?? 0) > 0
  );
  const searchQ = encodeURIComponent(project.name);
  const MORE_VIDEOS = [
    { label: "TikTok",   href: `https://www.tiktok.com/search?q=${searchQ}` },
    { label: "Reels",    href: `https://www.instagram.com/explore/search/keyword/?q=${searchQ}` },
    { label: "Shorts",   href: `https://www.youtube.com/results?search_query=${searchQ}+shorts` },
    { label: "Facebook", href: `https://www.facebook.com/search/videos/?q=${searchQ}` },
  ] as const;

  return (
    <div style={{ display: "grid", gap: 20 }}>

      {/* Generator */}
      <section className="glass studio-card" aria-label="Video generator">
        <CriteriaPicker
          project={project}
          criteria={criteria}
          disabled={isGenerating}
          onChange={updateCriteria}
          onAngleText={val => {
            setCriteria(prev => {
              const next = { ...prev, angleText: val };
              setGen(g => ({ ...g, prompt: buildVideoPrompt(project, next) }));
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
          id="video-prompt"
          open={showPrompt}
          onToggle={() => setShowPrompt(s => !s)}
          value={gen.prompt}
          onChange={v => setGen(g => ({ ...g, prompt: v }))}
          disabled={isGenerating}
          placeholder="Describe the video ad you want to generate…"
        />

        {(hasCriteria || showPrompt) && <hr className="studio-divider" />}

        {/* Options + generate */}
        <div className="studio-controls">
          <div className="studio-control">
            <span className="field-label">Aspect</span>
            <SegmentedControl
              ariaLabel="Aspect ratio"
              disabled={isGenerating}
              value={gen.aspectRatio as typeof VIDEO_ASPECT_RATIOS[number]}
              onChange={ratio => setGen(g => ({ ...g, aspectRatio: ratio }))}
              options={VIDEO_ASPECT_RATIOS.map(r => ({ value: r, label: r }))}
            />
          </div>

          <div className="studio-control">
            <span className="field-label">Duration</span>
            <SegmentedControl
              ariaLabel="Duration"
              disabled={isGenerating}
              value={gen.duration}
              onChange={d => setGen(g => ({ ...g, duration: d }))}
              options={VIDEO_DURATIONS.map(d => ({ value: d, label: `${d}s` }))}
            />
          </div>

          <div className="studio-control">
            <span className="field-label">Resolution</span>
            <SegmentedControl
              ariaLabel="Resolution"
              disabled={isGenerating}
              value={gen.resolution}
              onChange={r => setGen(g => ({ ...g, resolution: r }))}
              options={VIDEO_RESOLUTIONS.map(r => ({ value: r, label: r }))}
            />
          </div>

          <div className="studio-spacer">
            <span className="stat-chip">
              <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--success)", flex: "none" }} />
              gemini-omni-video
            </span>
            <CreditTooltip cost={videoCreditCost(gen.duration)}>
              <LiquidButton
                icon={<Sparkles size={16} fill="currentColor" aria-hidden />}
                loading={isGenerating}
                disabled={!gen.prompt.trim()}
                onClick={handleVideoGenerate}
              >
                {isGenerating ? "Generating…" : `Generate · ${videoCreditCost(gen.duration)} credits`}
              </LiquidButton>
            </CreditTooltip>
          </div>
        </div>

        {gen.error && (
          <p role="alert" className="studio-error"><AlertCircle size={15} style={{ flex: "none" }} aria-hidden /> {gen.error}</p>
        )}

        {/* Inspiration */}
        <div className="studio-field">
          <span className="field-label">More videos like this</span>
          <div className="studio-chips">
            {MORE_VIDEOS.map(({ label, href }) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="chip studio-link">
                {label} <ExternalLink size={12} aria-hidden />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery */}
      {gallery.length > 0 && (
        <div className="studio-gallery">
          {gallery.map(item =>
            item.kind === "ai"
              ? <AiVideoCard key={item.data.id} video={item.data} uid={uid} projectId={project.id} />
              : <RenderedVideoCard key={item.data.id} video={item.data} uid={uid} projectId={project.id} />
          )}
        </div>
      )}

      {/* Video editor (below gallery) */}
      <VideoEditor uid={uid} projectId={project.id} />

      <InsufficientCreditsModal
        open={creditModalOpen}
        onClose={() => setCreditModalOpen(false)}
        required={videoCreditCost(gen.duration)}
        balance={credits ?? 0}
      />
    </div>
  );
}

// ─── AI video card ────────────────────────────────────────────────────────────

interface AiVideoCardProps {
  video:     AiVideo;
  uid:       string;
  projectId: string;
}

function AiVideoCard({ video, uid, projectId }: AiVideoCardProps) {
  const [videoError, setVideoError] = useState(false);
  const [menuOpen,   setMenuOpen]   = useState(false);
  const [lightbox,   setLightbox]   = useState(false);
  const [deleting,   setDeleting]   = useState(false);

  const isPending = !!video.taskId && !video.videoUrl;
  const isFailed  = !video.taskId && video.status === "failed" && !video.videoUrl;
  const hasVideo  = !!video.videoUrl && !videoError;

  const aspectCss = (video.aspectRatio ?? "9:16").replace(":", " / ");
  const title = video.prompt.split(/[\n.!?]/)[0].trim().slice(0, 64);

  function handleDownload() {
    if (!video.videoUrl) return;
    setMenuOpen(false);
    downloadViaProxy(video.videoUrl, `video-${video.id}.mp4`).catch(() => { /* no-op */ });
  }

  async function handleDelete() {
    setMenuOpen(false);
    setDeleting(true);
    try { await deleteAiVideo(uid, projectId, video.id); }
    catch { setDeleting(false); }
  }

  // Escape closes the lightbox.
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLightbox(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox]);

  // A generation whose video no longer loads is left out of the gallery.
  if (videoError) return null;

  return (
    <>
      <div className={`gen-tile lift${deleting ? " deleting" : ""}`} style={{ aspectRatio: aspectCss }}>
        {hasVideo && (
           
          <video
            src={video.videoUrl}
            muted loop playsInline
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            onMouseEnter={e => e.currentTarget.play()}
            onMouseLeave={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
            onError={() => setVideoError(true)}
          />
        )}

        {hasVideo && (
          <button type="button" className="gen-open" aria-label={`Play video: ${title}`} onClick={() => setLightbox(true)} />
        )}

        {isPending && (
          <div className="gen-state shimmer" role="status">
            <Loader2 size={24} className="spinner" style={{ color: "var(--accent-primary)" }} aria-hidden />
            <span>Video<br />generating…</span>
          </div>
        )}

        {isFailed && (
          <div className="gen-state">
            <AlertCircle size={22} style={{ color: "var(--danger)" }} aria-hidden />
            <span style={{ color: "var(--danger)" }}>Generation<br />failed</span>
          </div>
        )}

        {hasVideo && (
          <span className="gen-play" aria-hidden><Play size={20} fill="currentColor" style={{ marginLeft: 3 }} /></span>
        )}

        <span className="gen-badge">{video.aspectRatio}</span>

        {/* Menu */}
        <button type="button" className="gen-menu-btn" aria-label="Video options" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(o => !o)}>
          <MoreVertical size={16} aria-hidden />
        </button>
        {menuOpen && (
          <>
            <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setMenuOpen(false)} />
            <div className="glass gen-menu" role="menu">
              {hasVideo && (
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

        {hasVideo && (
          <div className="gen-caption">
            <div className="gen-caption-title" dir="auto">{title}</div>
            <div className="gen-caption-meta">{video.aspectRatio} · gemini-omni-video · {video.createdAt}</div>
          </div>
        )}
      </div>

      {lightbox && hasVideo && (
        <div className="dialog-overlay" style={{ zIndex: 100 }} role="dialog" aria-modal="true" aria-label={title} onClick={() => setLightbox(false)}>
          <div style={{ position: "relative", maxWidth: "min(90vw, 900px)", maxHeight: "90vh", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }} onClick={e => e.stopPropagation()}>
            { }
            <video src={video.videoUrl} controls autoPlay style={{ maxWidth: "100%", maxHeight: "78vh", borderRadius: 24, boxShadow: "var(--card-shadow)" }} />
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
