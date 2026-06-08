"use client";

import { useState, useEffect, useRef } from "react";
import {
  Sparkles, Download, AlertCircle, MoreVertical, Trash2, X,
  ImageIcon, Video, Globe,
} from "lucide-react";
import { useAuth } from "@/lib/contexts/auth-context";
import { deductCredits, refundCredits, CREDIT_COSTS } from "@/lib/firebase/credits";
import { InsufficientCreditsModal } from "@/components/credits/InsufficientCreditsModal";
import { CreditTooltip } from "@/components/credits/CreditTooltip";
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
    segmentIdx: vd?.market?.segments?.length  ? 0 : null,
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

// ─── Recursive URL extractor ──────────────────────────────────────────────────

function findUrl(node: unknown): string | null {
  if (typeof node === "string" && node.startsWith("http")) return node;
  if (Array.isArray(node)) {
    for (const item of node) { const u = findUrl(item); if (u) return u; }
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    for (const key of ["imageUrl", "image_url", "url", "imageUrls", "images", "urls", "result", "output"]) {
      const u = findUrl(obj[key]); if (u) return u;
    }
    for (const v of Object.values(obj)) { const u = findUrl(v); if (u) return u; }
  }
  return null;
}

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
          const res = await fetch(`/api/generate-creative/status?taskId=${taskId}`);
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

    const result = await deductCredits(uid, CREDIT_COSTS.PHOTO);
    if (!result.success) {
      setCreditModalOpen(true);
      return;
    }

    setGen(g => ({ ...g, status: "submitting", error: null, imageUrl: null, taskId: null }));
    try {
      const styleSuffix = imageStyle ? `\n\nStyle direction: ${IMAGE_STYLE_PROMPTS[imageStyle]}` : "";
      const body: Record<string, unknown> = {
        prompt:      gen.prompt + styleSuffix,
        aspectRatio: gen.aspectRatio,
        resolution:  gen.resolution,
      };
      if (project.productImageUrl) body.imageInput = [project.productImageUrl];

      const res  = await fetch("/api/generate-creative", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { taskId?: string; error?: string };
      if (!res.ok || !data.taskId) {
        await refundCredits(uid, CREDIT_COSTS.PHOTO);
        setGen(g => ({ ...INITIAL_GEN, prompt: g.prompt, aspectRatio: g.aspectRatio, resolution: g.resolution, error: data.error ?? "Failed to start generation." }));
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
      await refundCredits(uid, CREDIT_COSTS.PHOTO);
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

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 4 }}>
        {([
          { key: "images"       as const, label: "Images",        icon: ImageIcon },
          { key: "videos"       as const, label: "Videos",        icon: Video },
          { key: "landing-page" as const, label: "Landing Pages", icon: Globe },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setCreativeTab(key)}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "8px 16px", borderRadius: 10, fontSize: 13,
              border: `1px solid ${creativeTab === key ? "var(--accent-primary)" : "var(--border-default)"}`,
              background: creativeTab === key ? "color-mix(in srgb, var(--accent-primary) 10%, transparent)" : "var(--bg-elevated)",
              color: creativeTab === key ? "var(--accent-primary)" : "var(--text-secondary)",
              fontWeight: creativeTab === key ? 600 : 400,
              cursor: "pointer", fontFamily: "inherit", transition: "all 0.13s",
            }}
          >
            <Icon size={13} strokeWidth={1.8} /> {label}
          </button>
        ))}
      </div>

      {creativeTab === "videos" && (
        <VideoStudio project={project} uid={uid} />
      )}

      {creativeTab === "landing-page" && (
        <LandingPageStudio project={project} uid={uid} />
      )}

      {creativeTab === "images" && (<>

      {/* Generator card */}
      <div className="glass-card" style={{ overflow: "hidden", padding: 0 }}>
        {showPrompt && (
          <>
            <textarea
              value={gen.prompt}
              onChange={e => setGen(g => ({ ...g, prompt: e.target.value }))}
              disabled={isGenerating}
              placeholder="Describe the creative you want to generate…"
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
                      setGen(g => ({ ...g, prompt: buildPromptFromCriteria(project, next) }));
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
              {IMAGE_ASPECT_RATIOS.map(ratio => (
                <button key={ratio}
                  onClick={() => setGen(g => ({ ...g, aspectRatio: ratio }))}
                  disabled={isGenerating}
                  style={{ padding: "5px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${gen.aspectRatio === ratio ? "var(--accent-primary)" : "var(--border-default)"}`, background: gen.aspectRatio === ratio ? "color-mix(in srgb, var(--accent-primary) 12%, transparent)" : "transparent", color: gen.aspectRatio === ratio ? "var(--accent-primary)" : "var(--text-secondary)", cursor: "pointer", fontFamily: "inherit", transition: "all 0.13s", opacity: isGenerating ? 0.5 : 1 }}
                >{ratio}</button>
              ))}
            </div>
          </div>

          {/* STYLE */}
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: ".06em", textTransform: "uppercase" }}>STYLE</span>
            <div style={{ display: "flex", gap: 4 }}>
              {IMAGE_STYLES.map(style => (
                <button key={style}
                  onClick={() => setImageStyle(s => s === style ? null : style)}
                  disabled={isGenerating}
                  style={{ padding: "5px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${imageStyle === style ? "var(--accent-primary)" : "var(--border-default)"}`, background: imageStyle === style ? "color-mix(in srgb, var(--accent-primary) 12%, transparent)" : "transparent", color: imageStyle === style ? "var(--accent-primary)" : "var(--text-secondary)", cursor: "pointer", fontFamily: "inherit", transition: "all 0.13s", opacity: isGenerating ? 0.5 : 1 }}
                >{style}</button>
              ))}
            </div>
          </div>

          {/* Model + Generate */}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--success)", display: "inline-block", flexShrink: 0 }} />
              nano-banana-2
            </span>
            <CreditTooltip cost={CREDIT_COSTS.PHOTO}>
              <button
                className="btn-primary"
                style={{ width: "auto", padding: "8px 18px", fontSize: 13, opacity: (!gen.prompt.trim() || isGenerating) ? 0.6 : 1 }}
                onClick={handleGenerate}
                disabled={!gen.prompt.trim() || isGenerating}
              >
                <Sparkles size={13} />
                {isGenerating ? "Generating…" : "+ Generate"}
              </button>
            </CreditTooltip>
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
      {aiCreatives.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {aiCreatives.map(c => <AiCreativeCard key={c.id} creative={c} uid={uid} projectId={project.id} />)}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

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
    const a    = document.createElement("a");
    const fname = `creative-${creative.id}.jpg`;
    a.href     = `/api/download?url=${encodeURIComponent(creative.imageUrl)}&filename=${encodeURIComponent(fname)}`;
    a.download = fname;
    a.click();
  }

  async function handleDelete() {
    setMenuOpen(false);
    setDeleting(true);
    try { await deleteAiCreative(uid, projectId, creative.id); }
    catch { setDeleting(false); }
  }

  return (
    <>
      <div
        style={{
          position: "relative", overflow: "hidden", borderRadius: 14,
          aspectRatio: aspectCss,
          background: "var(--bg-elevated)", border: "1px solid var(--border-default)",
          cursor: hasImage ? "pointer" : "default",
          opacity: deleting ? 0.45 : 1,
          transition: "opacity 0.2s, transform 0.22s var(--ease)",
        }}
        onClick={() => hasImage && setLightbox(true)}
        onMouseEnter={e => { if (hasImage) e.currentTarget.style.transform = "translateY(-3px)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
      >
        {hasImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={creative.imageUrl} alt={creative.prompt}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            onError={() => setImgError(true)}
          />
        )}

        {isPending && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid var(--border-default)", borderTopColor: "var(--accent-primary)", animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: 12, color: "var(--text-tertiary)", textAlign: "center", lineHeight: 1.5 }}>Creative<br />generating…</span>
          </div>
        )}

        {isFailed && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 12, color: "var(--danger)", textAlign: "center" }}>Generation<br />failed</span>
          </div>
        )}

        {/* Aspect badge */}
        <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 700, color: "#fff" }}>
          {creative.aspectRatio}
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
                {hasImage && (
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
        {hasImage && (
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.82))", padding: "40px 12px 12px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {title}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 4, fontWeight: 500 }}>
              {creative.aspectRatio} · nano-banana-2 · {creative.createdAt}
            </div>
          </div>
        )}
      </div>

      {lightbox && hasImage && (
        <div className="dialog-overlay" style={{ zIndex: 100 }} onClick={() => setLightbox(false)}>
          <div style={{ position: "relative", maxWidth: "min(90vw, 900px)", maxHeight: "90vh", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }} onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={creative.imageUrl} alt={creative.prompt} style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: 12, objectFit: "contain", boxShadow: "0 8px 40px rgba(0,0,0,0.4)" }} />
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
