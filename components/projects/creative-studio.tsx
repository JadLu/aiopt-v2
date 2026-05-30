"use client";

import { useState, useEffect, useRef } from "react";
import {
  Sparkles, Download, RotateCcw, AlertCircle, RefreshCw, MapPin,
} from "lucide-react";
import {
  createAiCreative, updateAiCreativeImageUrl, failAiCreative,
  subscribeToAiCreatives, type AiCreative,
} from "@/lib/firebase/ai-creatives";
import type { Project } from "@/lib/mock-data";

// ─── Marketing-plan extraction helpers ───────────────────────────────────────

function stripMd(text: string): string {
  return text
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
  const [gen, setGen] = useState<GenState>(() => ({
    ...INITIAL_GEN, prompt: buildAutoPrompt(project),
  }));

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
    setGen(prev => ({
      ...INITIAL_GEN,
      prompt:      buildAutoPrompt(project),
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

  // ── 5. Gen-completion detector: update the result card when Firestore confirms ─
  useEffect(() => {
    const docId = pendingDocRef.current;
    if (!docId) return;
    const creative = aiCreatives.find(c => c.id === docId);
    if (!creative) return;
    if (creative.imageUrl) {
      setGen(g => ({ ...g, status: "done", imageUrl: creative.imageUrl }));
      pendingDocRef.current = null;
    } else if (creative.status === "failed") {
      setGen(g => ({ ...g, status: "error", error: `Generation failed. Task ID: ${creative.taskId ?? "unknown"}` }));
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
        setGen(g => ({ ...g, status: "error", error: data.error ?? "Failed to start generation." }));
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
      setGen(g => ({ ...g, status: "error", error: "Network error. Please try again." }));
    }
  }

  const isGenerating = gen.status === "submitting" || gen.status === "polling";
  const brief        = extractBrief(project);

  return (
    <div style={{ display: "grid", gap: 20 }}>

      {/* Creative brief context bar */}
      <div className="card" style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={{
            width: 64, height: 64, borderRadius: 12, flexShrink: 0, overflow: "hidden",
            background: "var(--bg-subtle)", display: "flex", alignItems: "center", justifyContent: "center",
            border: "1px solid var(--border-default)",
          }}>
            {project.productImageUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={project.productImageUrl} alt={project.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontSize: 28 }}>{project.emoji}</span>
            }
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{project.name}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "var(--accent-primary)", background: "rgba(90,200,214,0.10)", padding: "2px 8px", borderRadius: 20 }}>
                <MapPin size={10} strokeWidth={2} /> {project.country}
              </span>
              {project.productImageUrl && (
                <span style={{ fontSize: 11, color: "var(--text-tertiary)", background: "var(--bg-subtle)", padding: "2px 8px", borderRadius: 20 }}>
                  Product image used as reference
                </span>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { label: "Audience",       text: brief.audience },
                { label: "Creative angle", text: brief.angle },
              ].map(({ label, text }) => (
                <div key={label}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 3 }}>
                    {label}
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, lineHeight: 1.55,
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                  }}>
                    {text || <span style={{ color: "var(--text-tertiary)", fontStyle: "italic" }}>Not found in plan</span>}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Generator card */}
      <div className="card" style={{ padding: "24px 28px" }}>

        {/* Prompt */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Ad Prompt
            </label>
            <span style={{ fontSize: 10, color: "var(--accent-primary)", background: "rgba(90,200,214,0.10)", padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>
              Auto-built from plan
            </span>
          </div>
          <button
            onClick={() => setGen(g => ({ ...g, prompt: buildAutoPrompt(project) }))}
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
      </div>

      {/* Result card — shown on completion or error */}
      {(gen.status === "done" || gen.status === "error") && (
        <div className="card" style={{ padding: "24px 28px" }}>

          {gen.status === "done" && gen.imageUrl && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={gen.imageUrl}
                alt="Generated creative"
                style={{ maxWidth: "100%", maxHeight: 600, borderRadius: 10, objectFit: "contain" }}
              />
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button
                  className="btn-secondary"
                  style={{ width: "auto", padding: "8px 16px", fontSize: 13 }}
                  onClick={() => setGen(g => ({ ...g, status: "idle", imageUrl: null, taskId: null }))}
                >
                  <RotateCcw size={13} /> Try Again
                </button>
                <a
                  href={gen.imageUrl} download target="_blank" rel="noopener noreferrer"
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                    border: "1px solid var(--border-default)", background: "var(--bg-elevated)",
                    color: "var(--text-primary)", textDecoration: "none", fontFamily: "inherit",
                  }}
                >
                  <Download size={13} /> Download
                </a>
                <span style={{ fontSize: 12, color: "var(--success)", display: "flex", alignItems: "center", gap: 5 }}>
                  ✓ Saved to gallery
                </span>
              </div>
            </div>
          )}

          {gen.status === "error" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "24px 0" }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(229,118,118,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <AlertCircle size={20} color="var(--danger)" />
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Generation Failed</p>
              <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>{gen.error}</p>
              <button
                className="btn-secondary"
                style={{ width: "auto", padding: "8px 16px", fontSize: 13, marginTop: 4 }}
                onClick={() => setGen(g => ({ ...g, status: "idle", error: null }))}
              >
                <RotateCcw size={13} /> Try Again
              </button>
            </div>
          )}
        </div>
      )}

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
            {aiCreatives.map(c => <AiCreativeCard key={c.id} creative={c} />)}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Gallery card — display only, no polling ──────────────────────────────────

function AiCreativeCard({ creative }: { creative: AiCreative }) {
  const [imgError, setImgError] = useState(false);
  // If a taskId exists and there's no image yet, the central poller is working on it — show spinner
  const isPending = !!creative.taskId && !creative.imageUrl;
  // Only show "failed" when there's no taskId left to retry with
  const isFailed  = !creative.taskId && creative.status === "failed" && !creative.imageUrl;

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ height: 200, background: "var(--bg-subtle)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>

        {isPending ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid var(--border-default)", borderTopColor: "var(--accent-primary)", animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
              {creative.status === "failed" ? "Retrying…" : "Fetching image…"}
            </span>
          </div>
        ) : isFailed ? (
          <span style={{ fontSize: 12, color: "var(--danger)" }}>Generation failed</span>
        ) : creative.imageUrl && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={creative.imageUrl} alt={creative.prompt}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={() => setImgError(true)}
          />
        ) : (
          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Image unavailable</span>
        )}

        <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.55)", borderRadius: 6, padding: "2px 8px", fontSize: 10, color: "#fff" }}>
          {creative.aspectRatio} · {creative.resolution}
        </div>

        {creative.imageUrl && !imgError && (
          <a
            href={creative.imageUrl} download target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.55)", borderRadius: 6, padding: "4px 8px", display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#fff", textDecoration: "none" }}
          >
            <Download size={10} /> Save
          </a>
        )}
      </div>

      <div style={{ padding: "10px 12px" }}>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 4px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.5 }}>
          {creative.prompt}
        </p>
        <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0 }}>{creative.createdAt}</p>
      </div>
    </div>
  );
}
