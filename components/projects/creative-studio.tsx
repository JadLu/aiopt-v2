"use client";

import { useState, useEffect, useRef } from "react";
import {
  Sparkles, Download, RefreshCw, MapPin, AlertCircle, MoreVertical, Trash2, X, Eye, EyeOff,
} from "lucide-react";
import {
  createAiCreative, updateAiCreativeImageUrl, failAiCreative,
  subscribeToAiCreatives, deleteAiCreative, type AiCreative,
} from "@/lib/firebase/ai-creatives";
import type { Project } from "@/lib/mock-data";

// ─── Marketing-plan extraction helpers ───────────────────────────────────────

function stripMd(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")       // remove fenced code blocks (incl. json:* blocks)
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
  if (audience)            lines.push(`Target audience: ${audience}`);
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
  };
}

function buildPromptFromCriteria(project: Project, criteria: CriteriaState): string {
  const vd = project.planVisualData;
  const lines: string[] = [
    `High-converting e-commerce ad creative for "${project.name}" — ${project.country} market.`,
  ];
  if (project.description) lines.push(`Product: ${project.description}`);

  const seg = criteria.segmentIdx !== null ? vd?.market?.segments?.[criteria.segmentIdx] : null;
  if (seg) lines.push(`Target Audience: ${seg.name} (${seg.size}) — ${seg.traits.join(", ")}`);

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

  lines.push(
    `Produce a premium-quality, culturally relevant ad image optimised for digital performance marketing in ${project.country}. Professional lighting, clean composition, brand-safe.`
  );
  return lines.join("\n\n");
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ASPECT_RATIOS = [
  { value: "1:1",  label: "1:1",  hint: "Square",    w: 28, h: 28 },
  { value: "4:5",  label: "4:5",  hint: "Portrait",  w: 22, h: 28 },
  { value: "9:16", label: "9:16", hint: "Story",     w: 16, h: 28 },
  { value: "16:9", label: "16:9", hint: "Landscape", w: 28, h: 16 },
  { value: "3:4",  label: "3:4",  hint: "Facebook",  w: 21, h: 28 },
];

const RESOLUTIONS = ["1K", "2K", "4K"] as const;
type Resolution = typeof RESOLUTIONS[number];
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
  prompt: "", aspectRatio: "1:1", resolution: "1K",
};

// ─── Recursive URL extractor — handles any kie.ai response shape ──────────────

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

// ─── Parse our own /api/generate-creative/status response ────────────────────
// The status endpoint now checks the webhook store and returns:
//   { status: "success", imageUrl: "https://..." }   — webhook delivered result
//   { status: "pending" }                             — still waiting

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
  const [aiCreatives, setAiCreatives] = useState<AiCreative[]>([]);
  const [criteria, setCriteria] = useState<CriteriaState>(() => defaultCriteria(project));
  const [showPrompt, setShowPrompt] = useState(false);
  const [gen, setGen] = useState<GenState>(() => {
    const crit = defaultCriteria(project);
    return {
      ...INITIAL_GEN,
      prompt: project.planVisualData
        ? buildPromptFromCriteria(project, crit)
        : buildAutoPrompt(project),
    };
  });

  function handleCriteriaChange(next: CriteriaState) {
    setCriteria(next);
    setGen(prev => ({
      ...prev,
      prompt: buildPromptFromCriteria(project, next),
    }));
  }

  // docId of the creative being generated right now — used to detect completion
  const pendingDocRef  = useRef<string | null>(null);
  // Map of creativeId → interval handle — single source of truth for all polls
  const activePollsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  // ── 1. Subscribe to Firestore ai-creatives for this project ─────────────────
  useEffect(() => {
    const unsub = subscribeToAiCreatives(uid, project.id, setAiCreatives);
    return unsub;
  }, [uid, project.id]);

  // ── 2. Rebuild prompt when project or plan changes ───────────────────────────
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

  // ── 3. Clean up all intervals when the component unmounts ───────────────────
  useEffect(() => {
    return () => {
      for (const iv of activePollsRef.current.values()) clearInterval(iv);
      activePollsRef.current.clear();
    };
  }, []);

  // ── 4. Central poller: triggered every time Firestore delivers new data ──────
  //    Starts a poll for every creative that has a taskId but no imageUrl yet.
  //    Stops polls for creatives that have since received their image.
  useEffect(() => {
    const active = activePollsRef.current;

    for (const creative of aiCreatives) {
      // Skip: already has image, no taskId, or already being polled
      if (creative.imageUrl || !creative.taskId || active.has(creative.id)) continue;

      let attempts = 0;
      const taskId     = creative.taskId;
      const creativeId = creative.id;

      console.log(`[creative-poller] starting poll — creativeId=${creativeId} taskId=${taskId}`);

      const iv = setInterval(async () => {
        attempts++;
        if (attempts > 80) {
          clearInterval(iv);
          active.delete(creativeId);
          console.warn(`[creative-poller] timed out — creativeId=${creativeId}`);
          await failAiCreative(uid, project.id, creativeId);
          return;
        }
        try {
          const res = await fetch(`/api/generate-creative/status?taskId=${taskId}`);
          const raw = await res.json() as Record<string, unknown>;
          const { isDone, isFailed, url } = parseKieResponse(raw);
          console.log(`[creative-poller] attempt=${attempts} creativeId=${creativeId}`, { isDone, isFailed, url, raw });

          if (isDone) {
            clearInterval(iv);
            active.delete(creativeId);
            if (url) {
              console.log(`[creative-poller] saving image — creativeId=${creativeId} url=${url}`);
              await updateAiCreativeImageUrl(uid, project.id, creativeId, url);
            } else {
              console.warn(`[creative-poller] done but no URL — creativeId=${creativeId}`, raw);
              await failAiCreative(uid, project.id, creativeId);
            }
          } else if (isFailed) {
            clearInterval(iv);
            active.delete(creativeId);
            console.warn(`[creative-poller] task failed — creativeId=${creativeId}`, raw);
            await failAiCreative(uid, project.id, creativeId);
          }
        } catch (err) {
          console.error(`[creative-poller] fetch error — creativeId=${creativeId}`, err);
        }
      }, 3000);

      active.set(creativeId, iv);
    }

    // Stop polls for creatives that now have an image (Firestore updated)
    for (const [id, iv] of active) {
      const c = aiCreatives.find(x => x.id === id);
      if (!c || c.imageUrl) {
        clearInterval(iv);
        active.delete(id);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiCreatives]);

  // ── 5. Reset to idle when Firestore confirms completion ─────────────────────
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

  // ── Generate handler ─────────────────────────────────────────────────────────
  async function handleGenerate() {
    if (!gen.prompt.trim()) return;
    setGen(g => ({ ...g, status: "submitting", error: null, imageUrl: null, taskId: null }));
    try {
      const body: Record<string, unknown> = {
        prompt:      gen.prompt,
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
        setGen(g => ({ ...INITIAL_GEN, prompt: g.prompt, aspectRatio: g.aspectRatio, resolution: g.resolution, error: data.error ?? "Failed to start generation." }));
        return;
      }

      // Save to Firestore immediately — the central poller picks it up automatically
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

  const vd        = project.planVisualData;
  const segments  = vd?.market?.segments    ?? [];
  const channels  = vd?.channels?.channels  ?? [];
  const pillars   = vd?.content?.pillars    ?? [];
  const hooks     = vd?.content?.hooks      ?? [];
  const hasCriteria = segments.length > 0 || channels.length > 0 || pillars.length > 0 || hooks.length > 0;

  return (
    <div style={{ display: "grid", gap: 20 }}>

      {/* Creative Brief — criteria picker or fallback */}
      <div className="card" style={{ padding: "18px 22px" }}>

        {/* Product header row */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: hasCriteria ? 20 : 0 }}>
          <div style={{ width: 44, height: 44, borderRadius: 11, flexShrink: 0, overflow: "hidden", background: "var(--bg-subtle)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border-default)" }}>
            {project.productImageUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={project.productImageUrl} alt={project.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontSize: 22 }}>{project.emoji}</span>
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{project.name}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "var(--accent-primary)", background: "rgba(90,200,214,0.10)", padding: "2px 8px", borderRadius: 20 }}>
                <MapPin size={10} strokeWidth={2} /> {project.country}
              </span>
              {project.productImageUrl && (
                <span style={{ fontSize: 11, color: "var(--text-tertiary)", background: "var(--bg-subtle)", padding: "2px 8px", borderRadius: 20 }}>
                  Reference image active
                </span>
              )}
            </div>
            {hasCriteria && (
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: "4px 0 0" }}>
                Select criteria below to craft the perfect prompt for your creative
              </p>
            )}
          </div>
        </div>

        {hasCriteria ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Audience Segment */}
            {segments.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>
                  Audience Segment
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {segments.map((seg, i) => {
                    const active = criteria.segmentIdx === i;
                    return (
                      <button
                        key={i}
                        onClick={() => handleCriteriaChange({ ...criteria, segmentIdx: active ? null : i })}
                        disabled={isGenerating}
                        style={{
                          padding: "6px 12px", borderRadius: 8, fontSize: 12, fontFamily: "inherit", cursor: "pointer", transition: "all 0.13s",
                          border: `1px solid ${active ? "var(--accent-primary)" : "var(--border-default)"}`,
                          background: active ? "color-mix(in srgb, var(--accent-primary) 10%, transparent)" : "var(--bg-subtle)",
                          color: active ? "var(--accent-primary)" : "var(--text-secondary)",
                          fontWeight: active ? 600 : 400,
                          opacity: isGenerating ? 0.5 : 1,
                        }}
                      >
                        {seg.name}
                        <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 4 }}>{seg.size}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Platform */}
            {channels.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>
                  Platform
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {channels.map((ch, i) => {
                    const active = criteria.channelIdx === i;
                    return (
                      <button
                        key={i}
                        onClick={() => handleCriteriaChange({ ...criteria, channelIdx: active ? null : i })}
                        disabled={isGenerating}
                        style={{
                          padding: "6px 12px", borderRadius: 8, fontSize: 12, fontFamily: "inherit", cursor: "pointer", transition: "all 0.13s",
                          border: `1px solid ${active ? "var(--accent-secondary)" : "var(--border-default)"}`,
                          background: active ? "color-mix(in srgb, var(--accent-secondary) 10%, transparent)" : "var(--bg-subtle)",
                          color: active ? "var(--accent-secondary)" : "var(--text-secondary)",
                          fontWeight: active ? 600 : 400,
                          opacity: isGenerating ? 0.5 : 1,
                        }}
                      >
                        {ch.name}
                        {ch.primary && <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.7 }}>★</span>}
                        <span style={{ fontSize: 11, opacity: 0.6, marginLeft: 4 }}>{ch.budget_pct}%</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Content Pillar */}
            {pillars.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>
                  Content Pillar
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {pillars.map((p, i) => {
                    const active = criteria.pillarIdx === i;
                    return (
                      <button
                        key={i}
                        onClick={() => handleCriteriaChange({ ...criteria, pillarIdx: active ? null : i })}
                        disabled={isGenerating}
                        style={{
                          padding: "6px 12px", borderRadius: 8, fontSize: 12, fontFamily: "inherit", cursor: "pointer", transition: "all 0.13s",
                          border: `1px solid ${active ? "#C084FC" : "var(--border-default)"}`,
                          background: active ? "color-mix(in srgb, #C084FC 10%, transparent)" : "var(--bg-subtle)",
                          color: active ? "#C084FC" : "var(--text-secondary)",
                          fontWeight: active ? 600 : 400,
                          opacity: isGenerating ? 0.5 : 1,
                        }}
                      >
                        {p.name}
                        <span style={{ fontSize: 11, opacity: 0.6, marginLeft: 4 }}>{p.pct}%</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Hook Template */}
            {hooks.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>
                  Hook Template
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {hooks.map((h, i) => {
                    const active = criteria.hookIdx === i;
                    const label = h.length > 52 ? h.slice(0, 49) + "…" : h;
                    return (
                      <button
                        key={i}
                        onClick={() => handleCriteriaChange({ ...criteria, hookIdx: active ? null : i })}
                        disabled={isGenerating}
                        style={{
                          padding: "6px 12px", borderRadius: 8, fontSize: 12, fontFamily: "inherit", cursor: "pointer", transition: "all 0.13s",
                          border: `1px solid ${active ? "var(--warning)" : "var(--border-default)"}`,
                          background: active ? "color-mix(in srgb, var(--warning) 10%, transparent)" : "var(--bg-subtle)",
                          color: active ? "var(--warning)" : "var(--text-secondary)",
                          fontWeight: active ? 600 : 400,
                          opacity: isGenerating ? 0.5 : 1,
                          maxWidth: 280, textAlign: "left",
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Fallback: show extracted text when no structured data */
          (() => {
            const brief = extractBrief(project);
            if (!brief.audience && !brief.angle) return null;
            return (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
                {[
                  { label: "Audience",       text: brief.audience },
                  { label: "Creative angle", text: brief.angle },
                ].map(({ label, text }) => (
                  <div key={label}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {text || <span style={{ color: "var(--text-tertiary)", fontStyle: "italic" }}>Not found in plan</span>}
                    </p>
                  </div>
                ))}
              </div>
            );
          })()
        )}
      </div>

      {/* Generator card */}
      <div className="card" style={{ padding: "24px 28px" }}>

        {/* Prompt */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: showPrompt ? 8 : 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Ad Prompt
            </label>
            <span style={{ fontSize: 10, color: "var(--accent-primary)", background: "rgba(90,200,214,0.10)", padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>
              {hasCriteria ? "Built from selections" : "Auto-built from plan"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => setShowPrompt(v => !v)}
              disabled={isGenerating}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                background: showPrompt ? "color-mix(in srgb, var(--accent-primary) 10%, transparent)" : "none",
                border: `1px solid ${showPrompt ? "var(--accent-primary)" : "var(--border-default)"}`,
                borderRadius: 8, padding: "4px 10px", cursor: "pointer",
                fontSize: 11, color: showPrompt ? "var(--accent-primary)" : "var(--text-tertiary)",
                fontFamily: "inherit", opacity: isGenerating ? 0.4 : 1, transition: "all 0.13s",
              }}
            >
              {showPrompt ? <EyeOff size={11} /> : <Eye size={11} />}
              {showPrompt ? "Hide" : "Edit Prompt"}
            </button>
            <button
              onClick={() => {
                const fresh = defaultCriteria(project);
                setCriteria(fresh);
                setGen(g => ({
                  ...g,
                  prompt: project.planVisualData
                    ? buildPromptFromCriteria(project, fresh)
                    : buildAutoPrompt(project),
                }));
              }}
              disabled={isGenerating}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                background: "none", border: "1px solid var(--border-default)",
                borderRadius: 8, padding: "4px 10px", cursor: "pointer",
                fontSize: 11, color: "var(--text-tertiary)", fontFamily: "inherit",
                opacity: isGenerating ? 0.4 : 1,
              }}
            >
              <RefreshCw size={11} /> Refresh
            </button>
          </div>
        </div>

        {showPrompt && (
          <textarea
            value={gen.prompt}
            onChange={e => setGen(g => ({ ...g, prompt: e.target.value }))}
            disabled={isGenerating}
            style={{
              width: "100%", minHeight: 130, padding: "12px 14px",
              background: "var(--bg-subtle)", border: "1px solid var(--border-default)",
              borderRadius: 10, fontSize: 12, color: "var(--text-primary)",
              fontFamily: "inherit", lineHeight: 1.75, resize: "vertical",
              outline: "none", boxSizing: "border-box",
              opacity: isGenerating ? 0.55 : 1,
            }}
            onFocus={e => { e.currentTarget.style.borderColor = "var(--accent-primary)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "var(--border-default)"; }}
          />
        )}

        {/* Aspect ratio */}
        <div style={{ marginTop: 20, marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 10, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Aspect Ratio
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {ASPECT_RATIOS.map(({ value, label, hint, w, h }) => {
              const active = gen.aspectRatio === value;
              return (
                <button
                  key={value}
                  onClick={() => setGen(g => ({ ...g, aspectRatio: value }))}
                  disabled={isGenerating}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 7,
                    padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                    border: `1px solid ${active ? "var(--accent-primary)" : "var(--border-default)"}`,
                    background: active ? "rgba(90,200,214,0.08)" : "var(--bg-subtle)",
                    fontFamily: "inherit", transition: "all 0.13s",
                    opacity: isGenerating ? 0.5 : 1, minWidth: 68,
                  }}
                >
                  <div style={{
                    width: w, height: h, borderRadius: 3,
                    border: `2px solid ${active ? "var(--accent-primary)" : "var(--text-tertiary)"}`,
                    background: active ? "rgba(90,200,214,0.12)" : "transparent",
                    transition: "all 0.13s",
                  }} />
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: active ? "var(--accent-primary)" : "var(--text-primary)" }}>{label}</div>
                    <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 1 }}>{hint}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Resolution + Generate */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Resolution</span>
            <div style={{ display: "flex", gap: 4 }}>
              {RESOLUTIONS.map(r => {
                const active = gen.resolution === r;
                return (
                  <button
                    key={r}
                    onClick={() => setGen(g => ({ ...g, resolution: r }))}
                    disabled={isGenerating}
                    style={{
                      padding: "5px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                      border: `1px solid ${active ? "var(--accent-primary)" : "var(--border-default)"}`,
                      background: active ? "rgba(90,200,214,0.08)" : "var(--bg-subtle)",
                      color: active ? "var(--accent-primary)" : "var(--text-tertiary)",
                      cursor: "pointer", fontFamily: "inherit", transition: "all 0.13s",
                      opacity: isGenerating ? 0.5 : 1,
                    }}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            className="btn-primary"
            style={{ width: "auto", padding: "10px 22px", fontSize: 13, opacity: (!gen.prompt.trim() || isGenerating) ? 0.6 : 1 }}
            onClick={handleGenerate}
            disabled={!gen.prompt.trim() || isGenerating}
          >
            <Sparkles size={14} />
            {gen.status === "submitting" ? "Starting…" : gen.status === "polling" ? "Generating…" : "Generate Creative"}
          </button>
        </div>

        {gen.error && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, padding: "8px 12px", background: "rgba(229,118,118,0.08)", borderRadius: 8, border: "1px solid rgba(229,118,118,0.20)" }}>
            <AlertCircle size={13} color="var(--danger)" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "var(--danger)" }}>{gen.error}</span>
          </div>
        )}
      </div>

      {/* Gallery — all creatives from Firestore for this project */}
      {aiCreatives.length > 0 && (
        <div>
          <div className="section-header" style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="section-title">Generated Creatives</span>
              <span style={{ fontSize: 12, color: "var(--text-tertiary)", background: "var(--bg-subtle)", padding: "2px 8px", borderRadius: 20 }}>
                {aiCreatives.length}
              </span>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
            {aiCreatives.map(c => <AiCreativeCard key={c.id} creative={c} uid={uid} projectId={project.id} />)}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
  const [imgError,    setImgError]    = useState(false);
  const [menuOpen,    setMenuOpen]    = useState(false);
  const [lightbox,    setLightbox]    = useState(false);
  const [deleting,    setDeleting]    = useState(false);

  const isPending = !!creative.taskId && !creative.imageUrl;
  const isFailed  = !creative.taskId && creative.status === "failed" && !creative.imageUrl;
  const hasImage  = !!creative.imageUrl && !imgError;

  function handleDownload() {
    if (!creative.imageUrl) return;
    setMenuOpen(false);
    const a    = document.createElement("a");
    a.href     = `/api/download?url=${encodeURIComponent(creative.imageUrl)}`;
    a.download = `creative-${creative.id}.jpg`;
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
      <div className="card" style={{ padding: 0, overflow: "hidden", opacity: deleting ? 0.45 : 1, transition: "opacity 0.2s" }}>

        {/* Image area */}
        <div
          style={{ height: 200, background: "var(--bg-subtle)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", cursor: hasImage ? "pointer" : "default" }}
          onClick={() => { if (hasImage) setLightbox(true); }}
        >
          {isPending ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid var(--border-default)", borderTopColor: "var(--accent-primary)", animation: "spin 1s linear infinite" }} />
              <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Generating…</span>
            </div>
          ) : isFailed ? (
            <span style={{ fontSize: 12, color: "var(--danger)" }}>Generation failed</span>
          ) : hasImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={creative.imageUrl} alt={creative.prompt} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={() => setImgError(true)} />
          ) : (
            <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Image unavailable</span>
          )}

          {/* Aspect ratio badge — bottom left */}
          <div style={{ position: "absolute", bottom: 8, left: 8, background: "rgba(0,0,0,0.55)", borderRadius: 6, padding: "2px 8px", fontSize: 10, color: "#fff" }}>
            {creative.aspectRatio} · {creative.resolution}
          </div>

          {/* 3-dots menu — top right */}
          <div style={{ position: "absolute", top: 6, right: 6 }} onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(0,0,0,0.55)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}
            >
              <MoreVertical size={14} />
            </button>

            {menuOpen && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setMenuOpen(false)} />
                <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 50, background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: 10, overflow: "hidden", minWidth: 130, boxShadow: "0 6px 20px rgba(0,0,0,0.18)" }}>
                  {hasImage && (
                    <button
                      onClick={handleDownload}
                      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 14px", fontSize: 13, color: "var(--text-primary)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                    >
                      <Download size={13} color="var(--text-secondary)" /> Save
                    </button>
                  )}
                  <button
                    onClick={handleDelete}
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 14px", fontSize: 13, color: "var(--danger)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Card footer */}
        <div style={{ padding: "10px 12px" }}>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 4px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.5 }}>
            {creative.prompt}
          </p>
          <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0 }}>{creative.createdAt}</p>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && hasImage && (
        <div className="dialog-overlay" style={{ zIndex: 100 }} onClick={() => setLightbox(false)}>
          <div style={{ position: "relative", maxWidth: "min(90vw, 900px)", maxHeight: "90vh", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }} onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={creative.imageUrl} alt={creative.prompt} style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: 12, objectFit: "contain", boxShadow: "0 8px 40px rgba(0,0,0,0.4)" }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={handleDownload}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, background: "var(--accent-primary)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit" }}
              >
                <Download size={13} /> Download
              </button>
              <button
                onClick={() => setLightbox(false)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-primary)", cursor: "pointer", fontFamily: "inherit" }}
              >
                <X size={13} /> Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
