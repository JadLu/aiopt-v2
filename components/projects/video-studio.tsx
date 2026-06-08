"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles, AlertCircle, MoreVertical, Download, X, Trash2, Play } from "lucide-react";
import { useAuth } from "@/lib/contexts/auth-context";
import { authFetch } from "@/lib/auth-fetch";
import { deductCredits, refundCredits, videoCreditCost } from "@/lib/firebase/credits";
import { InsufficientCreditsModal } from "@/components/credits/InsufficientCreditsModal";
import { CreditTooltip } from "@/components/credits/CreditTooltip";
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
    segmentIdx: vd?.market?.segments?.length  ? 0 : null,
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

    const cost = videoCreditCost(gen.duration);
    const result = await deductCredits(uid, cost);
    if (!result.success) {
      setCreditModalOpen(true);
      return;
    }

    setGen(g => ({ ...g, status: "submitting", error: null, videoUrl: null, taskId: null }));
    try {
      const imageUrls: string[] = project.productImageUrl ? [project.productImageUrl] : [];
      const res  = await authFetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt:      gen.prompt,
          aspectRatio: gen.aspectRatio,
          duration:    gen.duration,
          resolution:  gen.resolution,
          imageUrls,
        }),
      });
      const data = await res.json() as { taskId?: string; error?: string };
      if (!res.ok || !data.taskId) {
        await refundCredits(uid, cost);
        setGen(g => ({ ...INITIAL_GEN, prompt: g.prompt, aspectRatio: g.aspectRatio, duration: g.duration, resolution: g.resolution, error: data.error ?? "Failed to start generation." }));
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
      await refundCredits(uid, cost);
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

  return (
    <div style={{ display: "grid", gap: 20 }}>

      {/* Generator card */}
      <div className="glass-card" style={{ overflow: "hidden", padding: 0 }}>
        {showPrompt && (
          <>
            <textarea
              value={gen.prompt}
              onChange={e => setGen(g => ({ ...g, prompt: e.target.value }))}
              disabled={isGenerating}
              placeholder="Describe the video ad you want to generate…"
              style={{
                width: "100%", padding: "16px 18px",
                background: "transparent", border: "none", outline: "none",
                fontSize: 14, color: "var(--text-primary)",
                fontFamily: "inherit", lineHeight: 1.65, resize: "none",
                boxSizing: "border-box", minHeight: 100,
                opacity: isGenerating ? 0.55 : 1,
              }}
            />
            <div style={{ height: 1, background: "var(--hairline)" }} />
          </>
        )}

        {/* Criteria from marketing plan */}
        {project.planVisualData && (() => {
          const vd   = project.planVisualData!;
          const segs = vd.market?.segments   ?? [];
          const chs  = vd.channels?.channels ?? [];
          const plrs = vd.content?.pillars   ?? [];
          const hks  = vd.content?.hooks     ?? [];
          if (!segs.length && !chs.length && !plrs.length && !hks.length) return null;
          const pill = (active: boolean, wide?: boolean) => ({
            padding: "5px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600,
            border: `1px solid ${active ? "var(--accent-primary)" : "var(--border-default)"}`,
            background: active ? "color-mix(in srgb, var(--accent-primary) 12%, transparent)" : "transparent",
            color: active ? "var(--accent-primary)" : "var(--text-secondary)",
            cursor: "pointer" as const, fontFamily: "inherit" as const, transition: "all 0.13s",
            opacity: isGenerating ? 0.5 : 1,
            maxWidth: wide ? 220 : 180, overflow: "hidden" as const,
            textOverflow: "ellipsis" as const, whiteSpace: "nowrap" as const,
          });
          return (
            <div style={{ padding: "10px 18px 12px", borderBottom: "1px solid var(--hairline)", display: "flex", flexDirection: "column", gap: 8 }}>
              {segs.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: ".06em", textTransform: "uppercase", width: 90, flexShrink: 0 }}>MKT. ANGLE</span>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {segs.map((s, i) => <button key={i} disabled={isGenerating} onClick={() => updateCriteria({ segmentIdx: criteria.segmentIdx === i ? null : i })} style={pill(criteria.segmentIdx === i)}>{s.name}</button>)}
                  </div>
                </div>
              )}
              {chs.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: ".06em", textTransform: "uppercase", width: 90, flexShrink: 0 }}>CHANNEL</span>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {chs.map((c, i) => <button key={i} disabled={isGenerating} onClick={() => updateCriteria({ channelIdx: criteria.channelIdx === i ? null : i })} style={pill(criteria.channelIdx === i)}>{c.name}</button>)}
                  </div>
                </div>
              )}
              {plrs.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: ".06em", textTransform: "uppercase", width: 90, flexShrink: 0 }}>PILLAR</span>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {plrs.map((p, i) => <button key={i} disabled={isGenerating} onClick={() => updateCriteria({ pillarIdx: criteria.pillarIdx === i ? null : i })} style={pill(criteria.pillarIdx === i)}>{p.name}</button>)}
                  </div>
                </div>
              )}
              {hks.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: ".06em", textTransform: "uppercase", width: 90, flexShrink: 0 }}>HOOK</span>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {hks.map((h, i) => <button key={i} disabled={isGenerating} onClick={() => updateCriteria({ hookIdx: criteria.hookIdx === i ? null : i })} style={pill(criteria.hookIdx === i, true)}>{h.length > 32 ? h.slice(0, 30) + "…" : h}</button>)}
                  </div>
                </div>
              )}
              {/* Marketing Angle — free-text, saved to Firestore on blur */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: ".06em", textTransform: "uppercase", width: 90, flexShrink: 0, paddingTop: 8 }}>CUSTOM</span>
                <textarea
                  value={criteria.angleText}
                  onChange={e => {
                    const val = e.target.value;
                    setCriteria(prev => {
                      const next = { ...prev, angleText: val };
                      setGen(g => ({ ...g, prompt: buildVideoPrompt(project, next) }));
                      return next;
                    });
                  }}
                  onBlur={() => {
                    const saved = project.marketingAngle ?? "";
                    if (criteria.angleText !== saved) {
                      updateProject(uid, project.id, { marketingAngle: criteria.angleText });
                    }
                  }}
                  disabled={isGenerating}
                  placeholder="Add your own marketing angle… (e.g. 'Focus on post-workout recovery pain relief')"
                  rows={2}
                  style={{
                    flex: 1, padding: "7px 10px",
                    background: "var(--bg-subtle)", border: "1px solid var(--border-default)",
                    borderRadius: 8, fontSize: 12.5, color: "var(--text-primary)",
                    fontFamily: "inherit", resize: "none", outline: "none", lineHeight: 1.5,
                    opacity: isGenerating ? 0.5 : 1, transition: "border-color 0.13s",
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = "var(--accent-primary)"; }}
                  onBlurCapture={e => { e.currentTarget.style.borderColor = "var(--border-default)"; }}
                />
              </div>
            </div>
          );
        })()}

        {/* Controls row */}
        <div style={{
          display: "flex", alignItems: "center", gap: 16,
          padding: "10px 18px 14px",
          flexWrap: "wrap",
        }}>
          {/* Prompt toggle */}
          <button
            onClick={() => setShowPrompt(s => !s)}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid var(--border-default)", background: showPrompt ? "color-mix(in srgb, var(--accent-primary) 10%, transparent)" : "transparent", color: showPrompt ? "var(--accent-primary)" : "var(--text-tertiary)", cursor: "pointer", fontFamily: "inherit", transition: "all 0.13s", flexShrink: 0 }}
          >
            <span style={{ fontSize: 11 }}>{showPrompt ? "▲" : "▼"}</span> Prompt
          </button>

          {/* ASPECT */}
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: ".06em", textTransform: "uppercase" }}>ASPECT</span>
            <div style={{ display: "flex", gap: 4 }}>
              {VIDEO_ASPECT_RATIOS.map(ratio => (
                <button key={ratio}
                  onClick={() => setGen(g => ({ ...g, aspectRatio: ratio }))}
                  disabled={isGenerating}
                  style={{ padding: "5px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${gen.aspectRatio === ratio ? "var(--accent-primary)" : "var(--border-default)"}`, background: gen.aspectRatio === ratio ? "color-mix(in srgb, var(--accent-primary) 12%, transparent)" : "transparent", color: gen.aspectRatio === ratio ? "var(--accent-primary)" : "var(--text-secondary)", cursor: "pointer", fontFamily: "inherit", transition: "all 0.13s", opacity: isGenerating ? 0.5 : 1 }}
                >{ratio}</button>
              ))}
            </div>
          </div>

          {/* DURATION */}
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: ".06em", textTransform: "uppercase" }}>DURATION</span>
            <div style={{ display: "flex", gap: 4 }}>
              {VIDEO_DURATIONS.map(d => (
                <button key={d}
                  onClick={() => setGen(g => ({ ...g, duration: d }))}
                  disabled={isGenerating}
                  style={{ padding: "5px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${gen.duration === d ? "var(--accent-primary)" : "var(--border-default)"}`, background: gen.duration === d ? "color-mix(in srgb, var(--accent-primary) 12%, transparent)" : "transparent", color: gen.duration === d ? "var(--accent-primary)" : "var(--text-secondary)", cursor: "pointer", fontFamily: "inherit", transition: "all 0.13s", opacity: isGenerating ? 0.5 : 1 }}
                >{d}s</button>
              ))}
            </div>
          </div>

          {/* RESOLUTION */}
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: ".06em", textTransform: "uppercase" }}>RESOLUTION</span>
            <div style={{ display: "flex", gap: 4 }}>
              {VIDEO_RESOLUTIONS.map(r => (
                <button key={r}
                  onClick={() => setGen(g => ({ ...g, resolution: r }))}
                  disabled={isGenerating}
                  style={{ padding: "5px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${gen.resolution === r ? "var(--accent-primary)" : "var(--border-default)"}`, background: gen.resolution === r ? "color-mix(in srgb, var(--accent-primary) 12%, transparent)" : "transparent", color: gen.resolution === r ? "var(--accent-primary)" : "var(--text-secondary)", cursor: "pointer", fontFamily: "inherit", transition: "all 0.13s", opacity: isGenerating ? 0.5 : 1 }}
                >{r}</button>
              ))}
            </div>
          </div>

          {/* Model + Generate */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--success)", display: "inline-block", flexShrink: 0 }} />
              gemini-omni-video
            </span>
            <CreditTooltip cost={videoCreditCost(gen.duration)}>
              <button
                className="btn-primary"
                style={{ width: "auto", padding: "8px 18px", fontSize: 13, opacity: (!gen.prompt.trim() || isGenerating) ? 0.6 : 1 }}
                onClick={handleVideoGenerate}
                disabled={!gen.prompt.trim() || isGenerating}
              >
                <Sparkles size={13} />
                {isGenerating ? "Generating…" : "+ Generate"}
              </button>
            </CreditTooltip>
          </div>

          {/* More videos — pushed to far right */}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: ".08em", textTransform: "uppercase", flexShrink: 0 }}>
              More videos
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              {(() => {
                const q = encodeURIComponent(project.name);
                return ([
                  { label: "TikTok",   href: `https://www.tiktok.com/search?q=${q}`,                                          color: "#5AC8D6" },
                  { label: "Reels",    href: `https://www.instagram.com/explore/search/keyword/?q=${q}`,                      color: "#E1306C" },
                  { label: "Shorts",   href: `https://www.youtube.com/results?search_query=${q}+shorts`,                      color: "#FF4545" },
                  { label: "Facebook", href: `https://www.facebook.com/search/videos/?q=${q}`,                                color: "#6FB1E8" },
                ] as const);
              })().map(({ label, href, color }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "5px 12px", borderRadius: 8,
                    fontSize: 12, fontWeight: 600,
                    color: "var(--text-secondary)",
                    background: "transparent",
                    border: "1px solid var(--border-default)",
                    textDecoration: "none",
                    transition: "border-color 0.13s, color 0.13s",
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLAnchorElement;
                    el.style.borderColor = color;
                    el.style.color = color;
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLAnchorElement;
                    el.style.borderColor = "var(--border-default)";
                    el.style.color = "var(--text-secondary)";
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0, display: "inline-block" }} />
                  {label}
                </a>
              ))}
            </div>
          </div>
        </div>

        {gen.error && (
          <div style={{ margin: "0 18px 14px", display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "rgba(229,118,118,0.08)", borderRadius: 8, border: "1px solid rgba(229,118,118,0.20)" }}>
            <AlertCircle size={13} color="var(--danger)" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "var(--danger)" }}>{gen.error}</span>
          </div>
        )}
      </div>

      {/* Gallery */}
      {gallery.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {gallery.map(item =>
            item.kind === "ai"
              ? <AiVideoCard key={item.data.id} video={item.data} uid={uid} projectId={project.id} />
              : <RenderedVideoCard key={item.data.id} video={item.data} uid={uid} projectId={project.id} />
          )}
        </div>
      )}

      {/* Video editor (below gallery) */}
      <VideoEditor uid={uid} projectId={project.id} />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

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
    const a    = document.createElement("a");
    const fname = `video-${video.id}.mp4`;
    a.href     = `/api/download?url=${encodeURIComponent(video.videoUrl)}&filename=${encodeURIComponent(fname)}`;
    a.download = fname;
    a.click();
  }

  async function handleDelete() {
    setMenuOpen(false);
    setDeleting(true);
    try { await deleteAiVideo(uid, projectId, video.id); }
    catch { setDeleting(false); }
  }

  return (
    <>
      <div
        style={{
          position: "relative", overflow: "hidden", borderRadius: 14,
          aspectRatio: aspectCss,
          background: "var(--bg-elevated)", border: "1px solid var(--border-default)",
          cursor: hasVideo ? "pointer" : "default",
          opacity: deleting ? 0.45 : 1,
          transition: "opacity 0.2s, transform 0.22s var(--ease)",
        }}
        onClick={() => hasVideo && setLightbox(true)}
        onMouseEnter={e => { if (hasVideo) e.currentTarget.style.transform = "translateY(-3px)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
      >
        {hasVideo && (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            src={video.videoUrl}
            muted loop playsInline
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            onMouseEnter={e => e.currentTarget.play()}
            onMouseLeave={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
            onError={() => setVideoError(true)}
          />
        )}

        {isPending && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid var(--border-default)", borderTopColor: "var(--accent-primary)", animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: 12, color: "var(--text-tertiary)", textAlign: "center", lineHeight: 1.5 }}>Video<br />generating…</span>
          </div>
        )}

        {isFailed && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 12, color: "var(--danger)", textAlign: "center" }}>Generation<br />failed</span>
          </div>
        )}

        {/* Play button */}
        {hasVideo && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(255,255,255,0.92)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 16px rgba(0,0,0,0.28)" }}>
              <Play size={20} fill="#0a0a0e" color="#0a0a0e" style={{ marginLeft: 3 }} />
            </div>
          </div>
        )}

        {/* Aspect badge */}
        <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 700, color: "#fff" }}>
          {video.aspectRatio}
        </div>

        {/* 3-dots menu */}
        <div style={{ position: "absolute", top: 6, right: 6 }} onClick={e => e.stopPropagation()}>
          <button onClick={() => setMenuOpen(o => !o)}
            style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(0,0,0,0.55)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
            <MoreVertical size={14} />
          </button>
          {menuOpen && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setMenuOpen(false)} />
              <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 50, background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: 10, overflow: "hidden", minWidth: 130, boxShadow: "0 6px 20px rgba(0,0,0,0.18)" }}>
                {hasVideo && (
                  <button onClick={handleDownload} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 14px", fontSize: 13, color: "var(--text-primary)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                    <Download size={13} color="var(--text-secondary)" /> Save
                  </button>
                )}
                <button onClick={handleDelete} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 14px", fontSize: 13, color: "var(--danger)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </>
          )}
        </div>

        {/* Bottom overlay */}
        {hasVideo && (
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.82))", padding: "40px 12px 12px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {title}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 4, fontWeight: 500 }}>
              {video.aspectRatio} · gemini-omni-video · {video.createdAt}
            </div>
          </div>
        )}
      </div>

      {lightbox && hasVideo && (
        <div className="dialog-overlay" style={{ zIndex: 100 }} onClick={() => setLightbox(false)}>
          <div style={{ position: "relative", maxWidth: "min(90vw, 900px)", maxHeight: "90vh", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }} onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video src={video.videoUrl} controls autoPlay style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: 12, boxShadow: "0 8px 40px rgba(0,0,0,0.4)" }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleDownload} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, background: "var(--accent-primary)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                <Download size={13} /> Download
              </button>
              <button onClick={() => setLightbox(false)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-primary)", cursor: "pointer", fontFamily: "inherit" }}>
                <X size={13} /> Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
