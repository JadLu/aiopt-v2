"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Sparkles, RefreshCw, Download, Trash2, MoreVertical, X,
  Globe, ExternalLink, FileCode2, Image as ImageIcon,
  ChevronDown, Plus, Copy, Check,
} from "lucide-react";
import { useAuth } from "@/lib/contexts/auth-context";
import { deductCredits, refundCredits, CREDIT_COSTS } from "@/lib/firebase/credits";
import { InsufficientCreditsModal } from "@/components/credits/InsufficientCreditsModal";
import { CreditTooltip } from "@/components/credits/CreditTooltip";
import {
  createAiLandingPage, updateAiLandingPageHtml, failAiLandingPage,
  deleteAiLandingPage, subscribeToAiLandingPages,
  type AiLandingPage, type Copyframe, type LandingPageCriteria,
} from "@/lib/firebase/ai-landing-pages";
import { uploadLandingPagePhoto, uploadLandingPageGif } from "@/lib/cloudinary";
import type { Project } from "@/lib/mock-data";

// ─── Copyframes ───────────────────────────────────────────────────────────────

const COPYFRAMES: Copyframe[] = ["AIDA", "PAS", "FAP"];

const COPYFRAME_COLOR: Record<Copyframe, string> = {
  AIDA: "var(--accent-primary)",
  PAS:  "var(--warning)",
  FAP:  "#C084FC",
};

// ─── Language helpers ─────────────────────────────────────────────────────────

type Language = "en" | "fr" | undefined; // undefined = native dialect

function dialectLabel(country: string): string {
  const lc = country.toLowerCase();
  if (lc.includes("morocco") || lc.includes("maroc"))      return "Darija";
  if (lc.includes("algeria") || lc.includes("algérie"))    return "Algérien";
  if (lc.includes("tunisia") || lc.includes("tunisie"))    return "Tunisien";
  if (lc.includes("egypt")   || lc.includes("egypte"))     return "Masri";
  if (lc.includes("france"))                                return "Français";
  return "Dialecte";
}

// ─── Criteria helpers ─────────────────────────────────────────────────────────

interface CriteriaState {
  segmentIdx: number | null;
  hookIdx:    number | null;
}

function defaultCriteria(project: Project): CriteriaState {
  const vd = project.planVisualData;
  return {
    segmentIdx: vd?.market?.segments?.length ? 0 : null,
    hookIdx:    vd?.content?.hooks?.length   ? 0 : null,
  };
}

function buildCriteriaPayload(project: Project, criteria: CriteriaState): LandingPageCriteria {
  const vd   = project.planVisualData;
  const seg  = criteria.segmentIdx !== null ? vd?.market?.segments?.[criteria.segmentIdx] : null;
  const hook = criteria.hookIdx    !== null ? vd?.content?.hooks?.[criteria.hookIdx]       : null;
  const tone = vd?.content?.tone;
  // Only include keys that have actual values — Firestore throws on undefined fields
  const result: LandingPageCriteria = {};
  if (seg)  result.segment = `${seg.name} (${seg.size}) — ${seg.traits.join(", ")}`;
  if (hook) result.hook    = hook;
  if (tone) result.tone    = tone;
  return result;
}

function buildPromptSummary(project: Project, criteria: LandingPageCriteria, copyframe: Copyframe): string {
  const parts = [`${copyframe} landing page for "${project.name}" — ${project.country}`];
  if (criteria.segment) parts.push(`Audience: ${criteria.segment.split(" — ")[0]}`);
  if (criteria.hook)    parts.push(`Hook: "${criteria.hook}"`);
  return parts.join(" | ");
}

function buildPromptText(
  project: Project,
  criteria: LandingPageCriteria,
  language: Language,
  copyframe: Copyframe,
  photos: string[],
  gifUrl: string | null,
  customDescription: string,
  dialectLbl: string,
): string {
  const langStr = language === "en"
    ? "English"
    : language === "fr"
    ? "French"
    : `Native dialect of ${project.country} (${dialectLbl})`;

  const lines: string[] = [
    `## Product Details`,
    `- Name: ${project.emoji ?? ""} ${project.name}`,
    `- Market: ${project.country}`,
    `- Description: ${customDescription || project.description || "(none)"}`,
    project.productImageUrl
      ? `- Product Image URL: ${project.productImageUrl}`
      : `- Product Image: none — AI will use contextual images`,
  ];

  if (photos.length > 0) {
    lines.push(`- Additional product photos — AI will place these in <img> tags:`);
    photos.forEach((u, i) => lines.push(`    Photo ${i + 1}: ${u}`));
  }

  if (gifUrl) {
    lines.push(`- Animated GIF URL (MUST be embedded as <img src="${gifUrl}"> — do NOT convert to video or change the URL):`);
    lines.push(`    GIF: ${gifUrl}`);
  }

  lines.push(``, `## Generation Config`);
  lines.push(`- Copyframe: ${copyframe}`);
  lines.push(`- Language: ${langStr}`);

  if (criteria.segment) lines.push(`- Marketing Angle: ${criteria.segment}`);
  if (criteria.hook)    lines.push(`- Hero Hook: "${criteria.hook}"`);
  if (criteria.tone)    lines.push(`- Brand Tone: ${criteria.tone}`);

  if (!criteria.segment && !criteria.hook) {
    lines.push(`- (No audience/hook selected — will use product defaults)`);
  }

  return lines.join("\n");
}

// ─── Export helpers ───────────────────────────────────────────────────────────

function downloadHtml(html: string, filename: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}


function extractForYouCan(html: string): { css: string; scriptHtml: string } {
  if (typeof window === "undefined") return { css: "", scriptHtml: html };
  const doc = new DOMParser().parseFromString(html, "text/html");

  // CSS: collect all <style> tag contents
  const styleContents: string[] = [];
  doc.querySelectorAll("style").forEach(el => {
    const content = el.textContent?.trim();
    if (content) styleContents.push(content);
  });
  const css = styleContents.join("\n\n");

  // Script content: external <script src> tags + body HTML + inline <script> blocks
  const parts: string[] = [];

  // 1. External script tags (head + body)
  const externalScripts: string[] = [];
  doc.querySelectorAll("script[src]").forEach(el => externalScripts.push(el.outerHTML));
  if (externalScripts.length > 0) {
    parts.push(...externalScripts, "");
  }

  // 2. Body HTML (non-script elements)
  doc.body.childNodes.forEach(node => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      if (el.tagName.toLowerCase() !== "script") {
        parts.push(el.outerHTML);
      }
    }
  });

  // 3. Inline script blocks
  const inlineScripts: string[] = [];
  doc.querySelectorAll("script:not([src])").forEach(el => inlineScripts.push(el.outerHTML));
  if (inlineScripts.length > 0) {
    parts.push("", ...inlineScripts);
  }

  return { css, scriptHtml: parts.join("\n") };
}

// CSS injected BEFORE the page loads to prevent any initial hidden-state from Tailwind
// scroll-animation classes (opacity-0, translate-y-*, data-aos, etc.)
const EXPORT_WIDTH = 1440;

const EXPORT_PRE_CSS = `<style id="__export_pre">
  html,body{width:${EXPORT_WIDTH}px!important;min-width:${EXPORT_WIDTH}px!important;max-width:none!important;overflow-x:hidden!important;}
  .landingsite-wrapper{width:${EXPORT_WIDTH}px!important;max-width:none!important;}
  .opacity-0,[class*=" opacity-0"],[class^="opacity-0"]{opacity:1!important}
  [data-aos],.aos-init,.aos-animate{opacity:1!important;transform:none!important}
  .invisible{visibility:visible!important}
  .translate-y-2,.translate-y-4,.translate-y-6,.translate-y-8,.translate-y-10,.translate-y-12,.translate-y-16,.translate-y-20,
  .-translate-y-2,.-translate-y-4,.-translate-y-6,.-translate-y-8,.-translate-y-10,.-translate-y-12,.-translate-y-16,.-translate-y-20{
    --tw-translate-y:0!important;transform:translateX(var(--tw-translate-x,0)) translateY(0)!important}
  *{animation-delay:0s!important;transition-delay:0s!important}
</style>`;

// Replace viewport meta to enforce desktop width inside the iframe
function prepareHtmlForExport(html: string): string {
  // Force viewport to desktop width
  const withViewport = html.replace(
    /<meta[^>]+name=["']viewport["'][^>]*>/i,
    `<meta name="viewport" content="width=${EXPORT_WIDTH}, initial-scale=1.0">`
  );
  // Inject override CSS right after <head>
  const withCss = /(<head[^>]*>)/i.test(withViewport)
    ? withViewport.replace(/(<head[^>]*>)/i, `$1${EXPORT_PRE_CSS}`)
    : EXPORT_PRE_CSS + withViewport;
  return withCss;
}

async function exportPageAsImage(html: string, filename: string, format: "png" | "jpeg" = "jpeg"): Promise<void> {
  const preparedHtml = prepareHtmlForExport(html);

  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    // Position off the top (not left) so horizontal layout is unaffected
    iframe.style.cssText = `position:fixed;top:-99999px;left:0;width:${EXPORT_WIDTH}px;height:900px;border:none;opacity:0;pointer-events:none;`;
    iframe.setAttribute("sandbox", "allow-same-origin allow-scripts");
    document.body.appendChild(iframe);

    const cleanup = () => { try { document.body.removeChild(iframe); } catch { /* */ } };

    iframe.addEventListener("load", async () => {
      try {
        // Phase 1: wait for Tailwind CDN + FontAwesome to process DOM
        await new Promise(r => setTimeout(r, 3500));

        const doc = iframe.contentDocument!;
        const win = iframe.contentWindow!;

        // Phase 2: enforce width on the document root after Tailwind runs
        doc.documentElement.style.cssText += `width:${EXPORT_WIDTH}px!important;min-width:${EXPORT_WIDTH}px!important;max-width:none!important;`;
        doc.body.style.cssText += `width:${EXPORT_WIDTH}px!important;min-width:${EXPORT_WIDTH}px!important;max-width:none!important;overflow-x:hidden!important;`;

        // Phase 3: flush any remaining opacity-0 classes that JS may have set after load
        const postStyle = doc.createElement("style");
        postStyle.textContent = `
          html,body{width:${EXPORT_WIDTH}px!important;min-width:${EXPORT_WIDTH}px!important;}
          .opacity-0,[class*=" opacity-0"],[class^="opacity-0"]{opacity:1!important}
          [data-aos],.aos-init,.aos-animate{opacity:1!important;transform:none!important}
          .invisible{visibility:visible!important}
        `;
        doc.head.appendChild(postStyle);

        // Phase 4: scroll through page to trigger IntersectionObserver callbacks
        const fullH = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight, 900);
        for (let pos = 0; pos <= fullH; pos += 300) {
          win.scrollTo(0, pos);
          await new Promise(r => setTimeout(r, 25));
        }
        win.scrollTo(0, 0);

        // Phase 5: expand iframe to full height + settle
        iframe.style.height = fullH + "px";
        await new Promise(r => setTimeout(r, 600));

        const html2canvas = (await import("html2canvas")).default;
        const canvas = await html2canvas(doc.documentElement, {
          useCORS: true, allowTaint: true, scale: 1.5, logging: false,
          width: EXPORT_WIDTH, height: fullH,
          windowWidth: EXPORT_WIDTH, windowHeight: fullH,
          x: 0, y: 0,
          scrollX: 0, scrollY: 0,
        });

        const url = canvas.toDataURL(format === "jpeg" ? "image/jpeg" : "image/png", 0.92);
        const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
        cleanup(); resolve();
      } catch (err) { cleanup(); reject(err); }
    }, { once: true });

    iframe.srcdoc = preparedHtml;
  });
}

// ─── Slug helper ──────────────────────────────────────────────────────────────

function pageSlug(page: AiLandingPage, projectName: string): string {
  const domain = projectName.toLowerCase().replace(/[^a-z]+/g, "").slice(0, 10) + ".ma";
  const pathMap: Record<Copyframe, string> = { AIDA: "glow", PAS: "fix", FAP: "features" };
  return `${domain}/${pathMap[page.copyframe]}`;
}

function pageTitle(page: AiLandingPage): string {
  const raw = page.prompt.replace(/^(AIDA|PAS|FAP) landing page for "[^"]+" — \w+ \| /i, "");
  const first = raw.split("|")[0].replace(/^(Audience:|Hook:).*/, "").trim();
  if (first.toLowerCase().startsWith("hook:")) {
    return first.replace(/^hook:\s*/i, "").replace(/^"(.*)"$/, "$1");
  }
  return first.slice(0, 48) || `${page.copyframe} Landing Page`;
}

// ─── Gen state ────────────────────────────────────────────────────────────────

type GenStatus = "idle" | "streaming" | "done" | "error";

interface GenState {
  status: GenStatus;
  html:   string;
  error:  string | null;
}

// ─── CopyButton ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 7, border: "1px solid var(--border-default)", background: copied ? "rgba(90,200,214,0.12)" : "var(--chip)", color: copied ? "var(--accent-primary)" : "var(--text-secondary)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s", flexShrink: 0 }}
    >
      {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
    </button>
  );
}

// ─── Gallery card (browser mockup) ────────────────────────────────────────────

function LandingPageCard({
  page, uid, projectId, projectName, onPreview, onYouCanExport,
}: {
  page: AiLandingPage;
  uid: string;
  projectId: string;
  projectName: string;
  onPreview: (page: AiLandingPage) => void;
  onYouCanExport: (page: AiLandingPage) => void;
}) {
  const [menuOpen,   setMenuOpen]   = useState(false);
  const [jpegBusy,   setJpegBusy]   = useState(false);

  const handleJpegExport = async () => {
    if (!page.html || jpegBusy) return;
    setJpegBusy(true);
    try {
      const slug = new Date().toISOString().slice(0, 10);
      await exportPageAsImage(page.html, `lp-${projectName.toLowerCase().replace(/\s+/g, "-")}-${slug}.jpg`, "jpeg");
    } catch (err) { console.error("JPEG export failed", err); }
    finally { setJpegBusy(false); }
  };

  const handleHtmlExport = () => {
    if (!page.html) return;
    const slug = new Date().toISOString().slice(0, 10);
    const blob = new Blob([page.html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lp-${projectName.toLowerCase().replace(/\s+/g, "-")}-${slug}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const slug = pageSlug(page, projectName);
  const title = pageTitle(page);
  const cfColor = COPYFRAME_COLOR[page.copyframe];

  return (
    <div style={{
      borderRadius: 14, overflow: "hidden",
      background: "var(--bg-elevated)", border: "1px solid var(--border-default)",
      display: "flex", flexDirection: "column",
      transition: "transform 0.22s var(--ease)",
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
    >
      {/* Browser chrome */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "9px 12px",
        background: "var(--bg-subtle)",
        borderBottom: "1px solid var(--hairline)",
      }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#FF5F57", display: "inline-block", flexShrink: 0 }} />
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#FEBC2E", display: "inline-block", flexShrink: 0 }} />
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#28C840", display: "inline-block", flexShrink: 0 }} />
        <div style={{
          flex: 1, background: "var(--chip)", borderRadius: 5, padding: "3px 8px",
          fontSize: 11, color: "var(--text-tertiary)", textAlign: "center",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {slug}
        </div>
      </div>

      {/* Preview area */}
      <div style={{
        height: 220, position: "relative",
        background: "var(--bg-subtle)",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
        cursor: page.html ? "pointer" : "default",
      }}
        onClick={() => page.html && onPreview(page)}
      >
        {page.status === "pending" && !page.html ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid var(--border-default)", borderTopColor: "var(--accent-primary)", animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: 12, color: "var(--text-tertiary)", textAlign: "center", lineHeight: 1.5 }}>Landing page<br />generating…</span>
          </div>
        ) : page.status === "failed" ? (
          <span style={{ fontSize: 12, color: "var(--danger)", textAlign: "center" }}>Generation failed</span>
        ) : page.html ? (
          <>
            <iframe
              srcDoc={page.html}
              sandbox="allow-same-origin"
              style={{ position: "absolute", top: 0, left: 0, width: "200%", height: "200%", border: "none", transformOrigin: "top left", transform: "scale(0.5)", pointerEvents: "none" }}
              title={title}
            />
            <div style={{ position: "absolute", inset: 0 }} />
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: 0.5 }}>
            <Globe size={24} strokeWidth={1.4} color="var(--text-tertiary)" />
            <span style={{ fontSize: 12, color: "var(--text-tertiary)", textAlign: "center", lineHeight: 1.5 }}>Landing page preview<br />or launch live</span>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 12px",
        borderTop: "1px solid var(--hairline)",
      }}>
        <span style={{
          fontSize: 10, fontWeight: 800, letterSpacing: ".04em",
          color: cfColor,
          background: `color-mix(in srgb, ${cfColor} 14%, transparent)`,
          padding: "2px 7px", borderRadius: 5, flexShrink: 0,
        }}>
          {page.copyframe}
        </span>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}
        </span>
        <div style={{ display: "flex", gap: 4, flexShrink: 0, position: "relative" }} onClick={e => e.stopPropagation()}>
          {page.html && (
            <>
              <button
                onClick={handleJpegExport}
                disabled={jpegBusy}
                title="Export as JPEG"
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 9px", borderRadius: 7, border: "1px solid var(--border-default)", background: "var(--chip)", color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, cursor: jpegBusy ? "default" : "pointer", fontFamily: "inherit", opacity: jpegBusy ? 0.6 : 1 }}
              >
                {jpegBusy
                  ? <div style={{ width: 10, height: 10, borderRadius: "50%", border: "1.5px solid var(--border-default)", borderTopColor: "var(--accent-primary)", animation: "spin 1s linear infinite" }} />
                  : <ImageIcon size={11} />
                }
                JPEG
              </button>
              <button
                onClick={handleHtmlExport}
                title="Download HTML file"
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 9px", borderRadius: 7, border: "1px solid var(--border-default)", background: "var(--chip)", color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >
                <FileCode2 size={11} /> HTML
              </button>
              <button
                onClick={() => { setMenuOpen(false); onYouCanExport(page); }}
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 9px", borderRadius: 7, border: "1px solid var(--border-default)", background: "var(--chip)", color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >
                <Download size={11} /> YouCan
              </button>
            </>
          )}
          <button
            onClick={() => setMenuOpen(o => !o)}
            style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border-default)", background: "var(--chip)", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <MoreVertical size={13} />
          </button>
          {menuOpen && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setMenuOpen(false)} />
              <div style={{ position: "absolute", bottom: "calc(100% + 4px)", right: 0, zIndex: 50, background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: 10, padding: "4px 0", minWidth: 140, boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
                {page.html && (
                  <button onClick={() => { onPreview(page); setMenuOpen(false); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "8px 14px", background: "none", border: "none", color: "var(--text-primary)", fontSize: 12, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                    <ExternalLink size={13} strokeWidth={1.8} /> Preview
                  </button>
                )}
                <button
                  onClick={async () => { await deleteAiLandingPage(uid, projectId, page.id); setMenuOpen(false); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "8px 14px", background: "none", border: "none", color: "var(--danger)", fontSize: 12, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                >
                  <Trash2 size={13} strokeWidth={1.8} /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LandingPageStudio({ project, uid }: { project: Project; uid: string }) {
  const { credits } = useAuth();
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const vd       = project.planVisualData;
  const segments = vd?.market?.segments ?? [];
  const hooks    = vd?.content?.hooks   ?? [];

  const [criteria,      setCriteria]      = useState<CriteriaState>(() => defaultCriteria(project));
  const [copyframe,     setCopyframe]     = useState<Copyframe>("AIDA");
  const [language,      setLanguage]      = useState<Language>(undefined);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [uploadingIdx,  setUploadingIdx]  = useState<number | null>(null);
  const [uploadedGif,   setUploadedGif]   = useState<string | null>(null);
  const [uploadingGif,  setUploadingGif]  = useState(false);
  const [customPrompt,  setCustomPrompt]  = useState(
    () => project.description
      ? `Promote ${project.description.slice(0, 120)} for ${project.country} buyers`
      : `Generate a high-converting landing page for ${project.name} — ${project.country}`
  );
  const [gen,           setGen]           = useState<GenState>({ status: "idle", html: "", error: null });
  const [pages,         setPages]         = useState<AiLandingPage[]>([]);
  const [previewPage,   setPreviewPage]   = useState<AiLandingPage | null>(null);
  const [exportOpen,    setExportOpen]    = useState(false);
  const [youCanOpen,    setYouCanOpen]    = useState(false);
  const [youCanData,    setYouCanData]    = useState<{ css: string; scriptHtml: string } | null>(null);
  const [showPrompt,    setShowPrompt]    = useState(true);

  const iframeRef     = useRef<HTMLIFrameElement>(null);
  const pendingDocRef = useRef<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoSlotRef  = useRef<number>(0);
  const gifInputRef   = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return subscribeToAiLandingPages(uid, project.id, setPages);
  }, [uid, project.id]);

  useEffect(() => {
    setCriteria(defaultCriteria(project));
  }, [project.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const criteriaPayload = buildCriteriaPayload(project, criteria);

  // ── Photo upload ──────────────────────────────────────────────────────────

  const handlePhotoSlotClick = (idx: number) => {
    if (uploadingIdx !== null) return;
    photoSlotRef.current = idx;
    photoInputRef.current?.click();
  };

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const idx = photoSlotRef.current;
    setUploadingIdx(idx);
    try {
      const url = await uploadLandingPagePhoto(uid, project.id, file);
      setUploadedPhotos(prev => {
        const next = [...prev];
        next[idx] = url;
        return next;
      });
    } catch (err) {
      console.error("Photo upload failed", err);
    } finally {
      setUploadingIdx(null);
    }
  };

  const removePhoto = (idx: number) => {
    setUploadedPhotos(prev => {
      const next = [...prev];
      next.splice(idx, 1);
      return next;
    });
  };

  // ── GIF upload ────────────────────────────────────────────────────────────

  const handleGifSlotClick = () => {
    if (uploadingGif) return;
    gifInputRef.current?.click();
  };

  const handleGifFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploadingGif(true);
    try {
      const url = await uploadLandingPageGif(uid, project.id, file);
      setUploadedGif(url);
    } catch (err) {
      console.error("GIF upload failed", err);
    } finally {
      setUploadingGif(false);
    }
  };

  // ── Generate ──────────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    const result = await deductCredits(uid, CREDIT_COSTS.LANDING_PAGE);
    if (!result.success) {
      setCreditModalOpen(true);
      return;
    }

    setGen({ status: "streaming", html: "", error: null });
    pendingDocRef.current = null;

    const criteriaWithLang: LandingPageCriteria = {
      ...criteriaPayload,
      ...(language !== undefined ? { language } : {}),
    };

    const photos = uploadedPhotos.filter(Boolean);

    try {
      const docId = await createAiLandingPage(uid, project.id, {
        html: "",
        copyframe,
        prompt: buildPromptSummary(project, criteriaWithLang, copyframe),
        criteria: criteriaWithLang,
        status: "pending",
      });
      pendingDocRef.current = docId;

      const res = await fetch("/api/generate-landing-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: {
            name:            project.name,
            description:     customPrompt || project.description,
            country:         project.country,
            emoji:           project.emoji,
            productImageUrl: project.productImageUrl,
            photoUrls:       photos.length > 0 ? photos : undefined,
            gifUrl:          uploadedGif ?? undefined,
          },
          copyframe,
          language,
          criteria: criteriaPayload,
        }),
      });

      if (!res.ok || !res.body) throw new Error(await res.text());

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setGen(prev => ({ ...prev, html: accumulated }));
      }

      const cleaned = accumulated
        .replace(/^```html\s*/i, "")
        .replace(/```\s*$/, "")
        .trim();

      setGen({ status: "done", html: cleaned, error: null });
      await updateAiLandingPageHtml(uid, project.id, docId, cleaned);
      pendingDocRef.current = null;

    } catch (err) {
      await refundCredits(uid, CREDIT_COSTS.LANDING_PAGE);
      const msg = err instanceof Error ? err.message : "Generation failed";
      setGen({ status: "error", html: "", error: msg });
      if (pendingDocRef.current) {
        await failAiLandingPage(uid, project.id, pendingDocRef.current);
        pendingDocRef.current = null;
      }
    }
  }, [uid, project, copyframe, language, customPrompt, criteriaPayload, uploadedPhotos, uploadedGif]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Export handlers ───────────────────────────────────────────────────────

  const openYouCan = (html: string) => {
    setYouCanData(extractForYouCan(html));
    setYouCanOpen(true);
  };

  const handleExportYouCan = () => {
    setExportOpen(false);
    openYouCan(gen.html);
  };

  const handleExportImage = async () => {
    setExportOpen(false);
    const slug = new Date().toISOString().slice(0, 10);
    await exportPageAsImage(gen.html, `landing-page-${project.name.toLowerCase().replace(/\s+/g, "-")}-${slug}.png`, "png");
  };

  const handleExportHtml = () => {
    const slug = new Date().toISOString().slice(0, 10);
    downloadHtml(gen.html, `landing-page-${project.name.toLowerCase().replace(/\s+/g, "-")}-${slug}.html`);
    setExportOpen(false);
  };

  const isGenerating = gen.status === "streaming";
  const dLabel = dialectLabel(project.country);

  const langOptions: { label: string; value: Language }[] = [
    { label: "English",   value: "en" },
    { label: "Français",  value: "fr" },
    { label: dLabel,      value: undefined },
  ];

  return (
    <div style={{ display: "grid", gap: 20 }}>

      {/* Hidden photo file input */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handlePhotoFileChange}
      />
      <input
        ref={gifInputRef}
        type="file"
        accept="image/gif"
        style={{ display: "none" }}
        onChange={handleGifFileChange}
      />

      {/* Generator card */}
      <div className="glass-card" style={{ overflow: "hidden", padding: 0 }}>
        <textarea
          value={customPrompt}
          onChange={e => setCustomPrompt(e.target.value)}
          disabled={isGenerating}
          placeholder="Describe what the landing page should promote…"
          style={{
            width: "100%", padding: "16px 18px",
            background: "transparent", border: "none", outline: "none",
            fontSize: 14, color: "var(--text-primary)",
            fontFamily: "inherit", lineHeight: 1.65, resize: "none",
            boxSizing: "border-box", minHeight: 72,
            opacity: isGenerating ? 0.55 : 1,
          }}
        />

        {/* Photos + GIF row */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 18px",
          borderTop: "1px solid var(--hairline)",
          flexWrap: "wrap",
        }}>
          {/* 3 photo slots */}
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: ".06em", textTransform: "uppercase", flexShrink: 0 }}>PHOTOS</span>
          <div style={{ display: "flex", gap: 8 }}>
            {[0, 1, 2, 3].map(idx => {
              const url = uploadedPhotos[idx];
              const isUploading = uploadingIdx === idx;
              return (
                <div key={idx} style={{ position: "relative", width: 48, height: 48, borderRadius: 8, overflow: "hidden", border: url ? "1.5px solid var(--accent-primary)" : "1.5px dashed var(--border-default)", background: "var(--bg-subtle)", flexShrink: 0, cursor: url || isUploading ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                  onClick={() => !url && !isUploading && handlePhotoSlotClick(idx)}
                >
                  {isUploading ? (
                    <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid var(--border-default)", borderTopColor: "var(--accent-primary)", animation: "spin 1s linear infinite" }} />
                  ) : url ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <button
                        onClick={e => { e.stopPropagation(); removePhoto(idx); }}
                        style={{ position: "absolute", top: 2, right: 2, width: 16, height: 16, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                      >
                        <X size={9} strokeWidth={2.5} />
                      </button>
                    </>
                  ) : (
                    <Plus size={16} strokeWidth={2} style={{ color: "var(--text-tertiary)" }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 36, background: "var(--hairline)", flexShrink: 0 }} />

          {/* GIF slot */}
          <span style={{ fontSize: 10, fontWeight: 700, color: "#C084FC", letterSpacing: ".06em", textTransform: "uppercase", flexShrink: 0 }}>GIF</span>
          <div
            style={{ position: "relative", width: 48, height: 48, borderRadius: 8, overflow: "hidden", border: uploadedGif ? "1.5px solid #C084FC" : "1.5px dashed var(--border-default)", background: "var(--bg-subtle)", flexShrink: 0, cursor: uploadedGif || uploadingGif ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={() => !uploadedGif && !uploadingGif && handleGifSlotClick()}
          >
            {uploadingGif ? (
              <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid var(--border-default)", borderTopColor: "#C084FC", animation: "spin 1s linear infinite" }} />
            ) : uploadedGif ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={uploadedGif} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button
                  onClick={e => { e.stopPropagation(); setUploadedGif(null); }}
                  style={{ position: "absolute", top: 2, right: 2, width: 16, height: 16, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                >
                  <X size={9} strokeWidth={2.5} />
                </button>
                {/* GIF badge */}
                <span style={{ position: "absolute", bottom: 2, left: 2, fontSize: 7, fontWeight: 800, background: "#C084FC", color: "#fff", padding: "1px 3px", borderRadius: 3, lineHeight: 1 }}>GIF</span>
              </>
            ) : (
              <span style={{ fontSize: 8, fontWeight: 800, color: "#C084FC", letterSpacing: ".04em" }}>GIF</span>
            )}
          </div>

          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>4 photos + 1 GIF</span>
        </div>

        {/* Prompt preview — shown by default, hideable */}
        {showPrompt && (
          <div style={{ borderTop: "1px solid var(--hairline)", padding: "12px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: ".06em", textTransform: "uppercase" }}>Generation Prompt</span>
              <CopyButton text={buildPromptText(project, criteriaPayload, language, copyframe, uploadedPhotos.filter(Boolean), uploadedGif, customPrompt, dLabel)} />
            </div>
            <pre style={{ margin: 0, padding: "11px 13px", background: "var(--bg-subtle)", borderRadius: 8, border: "1px solid var(--border-default)", fontSize: 11.5, color: "var(--text-secondary)", fontFamily: "monospace", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 260, overflowY: "auto" }}>
              {buildPromptText(project, criteriaPayload, language, copyframe, uploadedPhotos.filter(Boolean), uploadedGif, customPrompt, dLabel)}
            </pre>
          </div>
        )}

        {/* Controls row */}
        <div style={{
          display: "flex", alignItems: "center", gap: 16,
          padding: "10px 18px 14px",
          borderTop: "1px solid var(--hairline)",
          flexWrap: "wrap",
        }}>
          {/* Prompt toggle — same pattern as creative-studio */}
          <button
            onClick={() => setShowPrompt(s => !s)}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid var(--border-default)", background: showPrompt ? "color-mix(in srgb, var(--accent-primary) 10%, transparent)" : "transparent", color: showPrompt ? "var(--accent-primary)" : "var(--text-tertiary)", cursor: "pointer", fontFamily: "inherit", transition: "all 0.13s", flexShrink: 0 }}
          >
            <span style={{ fontSize: 11 }}>{showPrompt ? "▲" : "▼"}</span> Prompt
          </button>

          {/* COPYFRAME */}
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: ".06em", textTransform: "uppercase" }}>COPYFRAME</span>
            <div style={{ display: "flex", gap: 4 }}>
              {COPYFRAMES.map(cf => {
                const cfColor = COPYFRAME_COLOR[cf];
                const active = copyframe === cf;
                return (
                  <button key={cf}
                    onClick={() => setCopyframe(cf)}
                    disabled={isGenerating}
                    style={{ padding: "5px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700, border: `1px solid ${active ? cfColor : "var(--border-default)"}`, background: active ? `color-mix(in srgb, ${cfColor} 14%, transparent)` : "transparent", color: active ? cfColor : "var(--text-secondary)", cursor: "pointer", fontFamily: "inherit", transition: "all 0.13s", opacity: isGenerating ? 0.5 : 1 }}
                  >{cf}</button>
                );
              })}
            </div>
          </div>

          {/* LANGUAGE */}
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: ".06em", textTransform: "uppercase" }}>LANGUAGE</span>
            <div style={{ display: "flex", gap: 4 }}>
              {langOptions.map(opt => {
                const active = language === opt.value;
                return (
                  <button key={opt.label}
                    onClick={() => setLanguage(opt.value)}
                    disabled={isGenerating}
                    style={{ padding: "5px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${active ? "var(--accent-secondary)" : "var(--border-default)"}`, background: active ? "color-mix(in srgb, var(--accent-secondary) 14%, transparent)" : "transparent", color: active ? "var(--accent-secondary)" : "var(--text-secondary)", cursor: "pointer", fontFamily: "inherit", transition: "all 0.13s", opacity: isGenerating ? 0.5 : 1 }}
                  >{opt.label}</button>
                );
              })}
            </div>
          </div>

          {/* AUDIENCE */}
          {segments.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: ".06em", textTransform: "uppercase" }}>AUDIENCE</span>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {segments.map((seg, i) => {
                  const active = criteria.segmentIdx === i;
                  return (
                    <button key={i}
                      onClick={() => setCriteria(c => ({ ...c, segmentIdx: c.segmentIdx === i ? null : i }))}
                      disabled={isGenerating}
                      style={{ padding: "5px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${active ? "var(--accent-primary)" : "var(--border-default)"}`, background: active ? "color-mix(in srgb, var(--accent-primary) 12%, transparent)" : "transparent", color: active ? "var(--accent-primary)" : "var(--text-secondary)", cursor: "pointer", fontFamily: "inherit", transition: "all 0.13s", opacity: isGenerating ? 0.5 : 1, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >{seg.name}</button>
                  );
                })}
              </div>
            </div>
          )}

          {/* HOOK */}
          {hooks.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: ".06em", textTransform: "uppercase" }}>HOOK</span>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {hooks.slice(0, 3).map((h, i) => {
                  const active = criteria.hookIdx === i;
                  const label = h.length > 28 ? h.slice(0, 26) + "…" : h;
                  return (
                    <button key={i}
                      onClick={() => setCriteria(c => ({ ...c, hookIdx: c.hookIdx === i ? null : i }))}
                      disabled={isGenerating}
                      style={{ padding: "5px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${active ? "var(--accent-secondary)" : "var(--border-default)"}`, background: active ? "color-mix(in srgb, var(--accent-secondary) 12%, transparent)" : "transparent", color: active ? "var(--accent-secondary)" : "var(--text-secondary)", cursor: "pointer", fontFamily: "inherit", transition: "all 0.13s", opacity: isGenerating ? 0.5 : 1 }}
                    >{label}</button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Model + Generate */}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--success)", display: "inline-block", flexShrink: 0 }} />
              claude-opus-4-7
            </span>
            <CreditTooltip cost={CREDIT_COSTS.LANDING_PAGE}>
              <button
                className="btn-primary"
                style={{ width: "auto", padding: "8px 18px", fontSize: 13, opacity: isGenerating ? 0.6 : 1 }}
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating
                  ? <><RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> Building…</>
                  : <><Sparkles size={13} /> + Generate</>
                }
              </button>
            </CreditTooltip>
          </div>
        </div>

        {gen.status === "error" && gen.error && (
          <div style={{ margin: "0 18px 14px", padding: "8px 12px", background: "rgba(229,118,118,0.08)", borderRadius: 8, border: "1px solid rgba(229,118,118,0.20)" }}>
            <span style={{ fontSize: 12, color: "var(--danger)" }}>{gen.error}</span>
          </div>
        )}
      </div>

      {/* Live preview */}
      {(gen.status === "streaming" || gen.status === "done") && (
        <div className="glass-card" style={{ padding: "18px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Globe size={14} strokeWidth={1.8} style={{ color: "var(--accent-primary)" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                {isGenerating ? "Building your landing page…" : "Landing Page Preview"}
              </span>
              {isGenerating && (
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--accent-primary)", background: "rgba(90,200,214,0.12)", padding: "2px 8px", borderRadius: 20 }}>
                  {Math.round(gen.html.length / 1000)}KB
                </span>
              )}
            </div>
            {gen.status === "done" && (
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setExportOpen(v => !v)}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--accent-primary)", background: "rgba(90,200,214,0.10)", color: "var(--accent-primary)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                >
                  <Download size={12} strokeWidth={2} /> Export <ChevronDown size={10} strokeWidth={2} />
                </button>
                {exportOpen && (
                  <>
                    <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setExportOpen(false)} />
                    <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 50, background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: 10, padding: "4px 0", minWidth: 170, boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
                      {([
                        { icon: Download,   label: "YouCan",       action: handleExportYouCan },
                        { icon: ImageIcon,  label: "Image (PNG)",  action: handleExportImage },
                        { icon: FileCode2,  label: "HTML file",    action: handleExportHtml },
                      ] as { icon: React.ElementType; label: string; action: () => void }[]).map(({ icon: Icon, label, action }) => (
                        <button key={label} onClick={action}
                          style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 14px", background: "none", border: "none", color: "var(--text-primary)", fontSize: 12, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-subtle)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "none")}
                        >
                          <Icon size={13} strokeWidth={1.8} /> {label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--border-default)", background: "#fff", position: "relative", height: isGenerating ? 200 : 600, transition: "height 0.3s ease" }}>
            {isGenerating && gen.html.length < 100 ? (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, background: "var(--bg-subtle)" }}>
                <RefreshCw size={24} strokeWidth={1.5} style={{ color: "var(--accent-primary)", animation: "spin 1s linear infinite" }} />
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Generating your landing page…</span>
              </div>
            ) : (
              <iframe ref={iframeRef} srcDoc={gen.html} sandbox="allow-scripts" style={{ width: "100%", height: "100%", border: "none", display: "block" }} title="Landing page preview" />
            )}
          </div>

          {gen.status === "done" && (
            <button
              onClick={() => { const blob = new Blob([gen.html], { type: "text/html" }); const blobUrl = URL.createObjectURL(blob); window.open(blobUrl, "_blank", "noopener,noreferrer"); setTimeout(() => URL.revokeObjectURL(blobUrl), 30000); }}
              style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "11px 0", borderRadius: 10, border: "1.5px solid var(--accent-primary)", background: "rgba(90,200,214,0.08)", color: "var(--accent-primary)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(90,200,214,0.16)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(90,200,214,0.08)"; }}
            >
              <ExternalLink size={14} strokeWidth={2} /> Open in New Tab
            </button>
          )}
        </div>
      )}

      {/* Gallery */}
      {pages.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {pages.map(page => (
            <LandingPageCard
              key={page.id} page={page} uid={uid}
              projectId={project.id} projectName={project.name}
              onPreview={setPreviewPage}
              onYouCanExport={p => openYouCan(p.html)}
            />
          ))}
        </div>
      )}

      {/* Fullscreen preview modal */}
      {previewPage && previewPage.html && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.85)", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", background: "var(--bg-elevated)", borderBottom: "1px solid var(--border-default)", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Globe size={14} strokeWidth={1.8} style={{ color: "var(--accent-primary)" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                {previewPage.copyframe} — {previewPage.createdAt}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => { const blob = new Blob([previewPage.html], { type: "text/html" }); const blobUrl = URL.createObjectURL(blob); window.open(blobUrl, "_blank", "noopener,noreferrer"); setTimeout(() => URL.revokeObjectURL(blobUrl), 30000); }}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-elevated)", color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >
                <ExternalLink size={12} strokeWidth={2} /> Open in tab
              </button>
              <button
                onClick={() => downloadHtml(previewPage.html, `lp-${previewPage.createdAt.replace(/\s+/g, "-").toLowerCase()}.html`)}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-elevated)", color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >
                <Download size={12} strokeWidth={2} /> HTML
              </button>
              <button
                onClick={() => { openYouCan(previewPage.html); setPreviewPage(null); }}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--accent-primary)", background: "rgba(90,200,214,0.10)", color: "var(--accent-primary)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >
                <Download size={12} strokeWidth={2} /> YouCan
              </button>
              <button
                onClick={() => setPreviewPage(null)}
                style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-elevated)", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={14} strokeWidth={2} />
              </button>
            </div>
          </div>
          <iframe srcDoc={previewPage.html} sandbox="allow-scripts" style={{ flex: 1, border: "none", background: "#fff" }} title="Landing page fullscreen preview" />
        </div>
      )}

      {/* YouCan export modal */}
      {youCanOpen && youCanData && (
        <div style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ width: "100%", maxWidth: 700, background: "var(--bg-base)", borderRadius: "var(--r-card)", border: "1px solid var(--border-default)", boxShadow: "var(--card-shadow)", display: "flex", flexDirection: "column", maxHeight: "90vh", overflow: "hidden" }}>
            {/* Modal header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--hairline)" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>YouCan Export</div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                  Parameters → Content → Custom code → paste each field below
                </div>
              </div>
              <button
                onClick={() => setYouCanOpen(false)}
                style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-elevated)", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={14} strokeWidth={2} />
              </button>
            </div>

            {/* Modal body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "grid", gap: 18 }}>
              {/* CSS field */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>Custom CSS content</span>
                  <CopyButton text={youCanData.css} />
                </div>
                <textarea
                  readOnly
                  value={youCanData.css}
                  style={{ width: "100%", height: 180, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-subtle)", color: "var(--text-secondary)", fontSize: 11, fontFamily: "monospace", resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.5 }}
                />
              </div>

              {/* Script / HTML field */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>Custom script content</span>
                  <CopyButton text={youCanData.scriptHtml} />
                </div>
                <textarea
                  readOnly
                  value={youCanData.scriptHtml}
                  style={{ width: "100%", height: 180, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-subtle)", color: "var(--text-secondary)", fontSize: 11, fontFamily: "monospace", resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.5 }}
                />
              </div>
            </div>

            {/* Modal footer */}
            <div style={{ padding: "12px 20px", borderTop: "1px solid var(--hairline)", display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setYouCanOpen(false)}
                style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--chip)", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <InsufficientCreditsModal
        open={creditModalOpen}
        onClose={() => setCreditModalOpen(false)}
        required={CREDIT_COSTS.LANDING_PAGE}
        balance={credits ?? 0}
      />
    </div>
  );
}
