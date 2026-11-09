"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Sparkles, Download, Trash2, MoreVertical, X,
  Globe, ExternalLink, FileCode2, Image as ImageIcon,
  ChevronDown, Plus, Copy, Check, Loader2, AlertCircle,
} from "lucide-react";
import { useAuth } from "@/lib/contexts/auth-context";
import { authFetch, readApiError } from "@/lib/auth-fetch";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import { InsufficientCreditsModal } from "@/components/credits/InsufficientCreditsModal";
import { CreditTooltip } from "@/components/credits/CreditTooltip";
import { LiquidButton } from "@/components/ui/liquid-button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ChipGroup } from "./studio-parts";
import {
  createAiLandingPage, updateAiLandingPageHtml, failAiLandingPage,
  deleteAiLandingPage, subscribeToAiLandingPages,
  type AiLandingPage, type Copyframe, type LandingPageCriteria,
} from "@/lib/firebase/ai-landing-pages";
import { uploadLandingPagePhoto, uploadLandingPageGif } from "@/lib/cloudinary";
import type { Project } from "@/lib/mock-data";

// ─── Copyframes ───────────────────────────────────────────────────────────────

const COPYFRAMES: Copyframe[] = ["AIDA", "PAS", "FAP"];

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
    segmentIdx: vd?.market?.segments?.length ? Math.min(project.selectedAngle ?? 0, vd.market.segments.length - 1) : null,
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
      type="button"
      className="chip studio-mini"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
    >
      {copied ? <><Check size={13} aria-hidden /> Copied</> : <><Copy size={13} aria-hidden /> Copy</>}
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

  return (
    <article className="glass lp-card lift">
      {/* Browser chrome */}
      <div className="lp-chrome" aria-hidden>
        <i /><i /><i />
        <span>{slug}</span>
      </div>

      {/* Preview area */}
      <div style={{ height: 220, position: "relative", background: "var(--glass-inner)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {page.status === "pending" && !page.html ? (
          <div className="gen-state shimmer" role="status">
            <Loader2 size={24} className="spinner" style={{ color: "var(--accent-primary)" }} aria-hidden />
            <span>Landing page<br />generating…</span>
          </div>
        ) : page.status === "failed" ? (
          <div className="gen-state">
            <AlertCircle size={22} style={{ color: "var(--danger)" }} aria-hidden />
            <span style={{ color: "var(--danger)" }}>Generation failed</span>
          </div>
        ) : page.html ? (
          <>
            <iframe
              srcDoc={page.html}
              sandbox="allow-same-origin"
              style={{ position: "absolute", top: 0, left: 0, width: "200%", height: "200%", border: "none", transformOrigin: "top left", transform: "scale(0.5)", pointerEvents: "none" }}
              title={title}
              tabIndex={-1}
            />
            <button type="button" className="gen-open" aria-label={`Preview landing page: ${title}`} onClick={() => onPreview(page)} />
          </>
        ) : (
          <div className="gen-state" style={{ opacity: 0.7 }}>
            <Globe size={24} strokeWidth={1.4} aria-hidden />
            <span>Landing page preview<br />or launch live</span>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "12px 14px", borderTop: "1px solid var(--hairline)" }}>
        <span className="stat-chip" style={{ fontWeight: 800, color: "var(--accent-primary)", flex: "none" }}>{page.copyframe}</span>
        <span dir="auto" style={{ flex: "1 1 120px", minWidth: 0, fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}
        </span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, position: "relative" }}>
          {page.html && (
            <>
              <button type="button" className="chip studio-mini" onClick={handleJpegExport} disabled={jpegBusy} title="Export as JPEG">
                {jpegBusy ? <Loader2 size={13} className="spinner" aria-hidden /> : <ImageIcon size={13} aria-hidden />} JPEG
              </button>
              <button type="button" className="chip studio-mini" onClick={handleHtmlExport} title="Download HTML file">
                <FileCode2 size={13} aria-hidden /> HTML
              </button>
              <button type="button" className="chip studio-mini" onClick={() => { setMenuOpen(false); onYouCanExport(page); }}>
                <Download size={13} aria-hidden /> YouCan
              </button>
            </>
          )}
          <button type="button" className="chip studio-mini" style={{ width: 34, padding: 0, justifyContent: "center" }} aria-label="More options" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(o => !o)}>
            <MoreVertical size={15} aria-hidden />
          </button>
          {menuOpen && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setMenuOpen(false)} />
              <div className="glass gen-menu" role="menu" style={{ top: "auto", bottom: "calc(100% + 8px)", right: 0 }}>
                {page.html && (
                  <button type="button" role="menuitem" className="menu-item" onClick={() => { onPreview(page); setMenuOpen(false); }}>
                    <ExternalLink size={14} aria-hidden /> <span style={{ flex: 1, textAlign: "left" }}>Preview</span>
                  </button>
                )}
                <button
                  type="button" role="menuitem" className="menu-item danger"
                  onClick={async () => { await deleteAiLandingPage(uid, projectId, page.id); setMenuOpen(false); }}
                >
                  <Trash2 size={14} aria-hidden /> <span style={{ flex: 1, textAlign: "left" }}>Delete</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </article>
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

      const res = await authFetch("/api/generate-landing-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: {
            name:            project.name,
            description:     customPrompt || project.description,
            country:         project.country,
            emoji:           project.emoji,
            productImageUrl: project.productImageUrl,
            photoUrls:       photos.length > 0 ? photos.slice(0, 4) : undefined,
            gifUrl:          uploadedGif ?? undefined,
          },
          copyframe,
          language,
          criteria: criteriaPayload,
        }),
      });

      if (res.status === 402) {
        // Server refused (not enough credits): nothing was charged.
        await failAiLandingPage(uid, project.id, docId);
        pendingDocRef.current = null;
        setGen({ status: "idle", html: "", error: null });
        setCreditModalOpen(true);
        return;
      }
      if (!res.ok || !res.body) throw new Error(await readApiError(res, "Generation failed"));

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
      const msg = err instanceof Error ? err.message : "Generation failed";
      setGen({ status: "error", html: "", error: msg });
      if (pendingDocRef.current) {
        await failAiLandingPage(uid, project.id, pendingDocRef.current);
        pendingDocRef.current = null;
      }
    }
  }, [uid, project, copyframe, language, customPrompt, criteriaPayload, uploadedPhotos, uploadedGif]);  

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

  const openInTab = (html: string) => {
    const blobUrl = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    window.open(blobUrl, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
  };

  const photoSlots = [0, 1, 2, 3];

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

      {/* Generator */}
      <section className="glass studio-card" aria-label="Landing page generator">
        <label className="studio-field">
          <span className="field-label">What should the page promote?</span>
          <textarea
            className="input-well"
            dir="auto"
            rows={3}
            value={customPrompt}
            onChange={e => setCustomPrompt(e.target.value)}
            disabled={isGenerating}
            placeholder="Describe what the landing page should promote…"
            style={{ borderRadius: 18, padding: "14px 16px", resize: "vertical" }}
          />
        </label>

        {/* Photos + GIF */}
        <div className="studio-field">
          <span className="field-label">
            Photos <span style={{ letterSpacing: 0, fontWeight: 400, textTransform: "none", opacity: 0.8 }}>· up to 4 photos and 1 GIF</span>
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
            {photoSlots.map(idx => {
              const url = uploadedPhotos[idx];
              const isUploading = uploadingIdx === idx;
              return (
                <div key={idx} style={{ position: "relative" }}>
                  <button
                    type="button"
                    className={`photo-slot${url ? " filled" : ""}`}
                    disabled={!!url || isUploading || isGenerating}
                    aria-label={url ? `Photo ${idx + 1} added` : `Add photo ${idx + 1}`}
                    onClick={() => handlePhotoSlotClick(idx)}
                  >
                    {isUploading ? <Loader2 size={20} className="spinner" style={{ color: "var(--accent-primary)" }} aria-hidden />
                      : url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt="" />
                      ) : <Plus size={20} strokeWidth={2} aria-hidden />}
                  </button>
                  {url && (
                    <button type="button" className="photo-slot-remove" aria-label={`Remove photo ${idx + 1}`} onClick={() => removePhoto(idx)}>
                      <X size={12} strokeWidth={2.5} aria-hidden />
                    </button>
                  )}
                </div>
              );
            })}

            <span aria-hidden style={{ width: 1, height: 40, background: "var(--hairline)", margin: "0 4px" }} />

            <div style={{ position: "relative" }}>
              <button
                type="button"
                className={`photo-slot gif${uploadedGif ? " filled" : ""}`}
                disabled={!!uploadedGif || uploadingGif || isGenerating}
                aria-label={uploadedGif ? "GIF added" : "Add a GIF"}
                onClick={handleGifSlotClick}
              >
                {uploadingGif ? <Loader2 size={20} className="spinner" aria-hidden />
                  : uploadedGif ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={uploadedGif} alt="" />
                      <span className="photo-slot-tag">GIF</span>
                    </>
                  ) : <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".04em" }}>GIF</span>}
              </button>
              {uploadedGif && (
                <button type="button" className="photo-slot-remove" aria-label="Remove GIF" onClick={() => setUploadedGif(null)}>
                  <X size={12} strokeWidth={2.5} aria-hidden />
                </button>
              )}
            </div>
          </div>
        </div>

        {segments.length > 0 && (
          <ChipGroup label="Audience" items={segments.map(s => s.name)} selected={criteria.segmentIdx} disabled={isGenerating}
            onPick={i => setCriteria(c => ({ ...c, segmentIdx: c.segmentIdx === i ? null : i }))} />
        )}
        {hooks.length > 0 && (
          <ChipGroup label="Hook" items={hooks.slice(0, 3)} selected={criteria.hookIdx} disabled={isGenerating}
            onPick={i => setCriteria(c => ({ ...c, hookIdx: c.hookIdx === i ? null : i }))} />
        )}

        {/* Prompt preview */}
        <div className="studio-field">
          <button type="button" className="chip" style={{ alignSelf: "flex-start" }} aria-expanded={showPrompt} aria-controls="lp-prompt" onClick={() => setShowPrompt(s => !s)}>
            <ChevronDown size={15} strokeWidth={2.2} style={{ transform: showPrompt ? "rotate(180deg)" : undefined, transition: "transform .2s" }} aria-hidden />
            {showPrompt ? "Hide generation prompt" : "Show generation prompt"}
          </button>
          {showPrompt && (
            <div id="lp-prompt" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <CopyButton text={buildPromptText(project, criteriaPayload, language, copyframe, uploadedPhotos.filter(Boolean), uploadedGif, customPrompt, dLabel)} />
              </div>
              <pre className="studio-pre">
                {buildPromptText(project, criteriaPayload, language, copyframe, uploadedPhotos.filter(Boolean), uploadedGif, customPrompt, dLabel)}
              </pre>
            </div>
          )}
        </div>

        <hr className="studio-divider" />

        {/* Options + generate */}
        <div className="studio-controls">
          <div className="studio-control">
            <span className="field-label">Copyframe</span>
            <SegmentedControl
              ariaLabel="Copyframe"
              disabled={isGenerating}
              value={copyframe}
              onChange={setCopyframe}
              options={COPYFRAMES.map(cf => ({ value: cf, label: cf }))}
            />
          </div>

          <div className="studio-control">
            <span className="field-label">Language</span>
            <SegmentedControl
              ariaLabel="Page language"
              disabled={isGenerating}
              value={language ?? "native"}
              onChange={v => setLanguage(v === "native" ? undefined : v)}
              options={langOptions.map(o => ({ value: (o.value ?? "native") as "en" | "fr" | "native", label: o.label }))}
            />
          </div>

          <div className="studio-spacer">
            <span className="stat-chip">
              <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--success)", flex: "none" }} />
              claude-opus-4-7
            </span>
            <CreditTooltip cost={CREDIT_COSTS.LANDING_PAGE}>
              <LiquidButton
                icon={<Sparkles size={16} fill="currentColor" aria-hidden />}
                loading={isGenerating}
                onClick={handleGenerate}
              >
                {isGenerating ? "Building…" : `Generate · ${CREDIT_COSTS.LANDING_PAGE} credits`}
              </LiquidButton>
            </CreditTooltip>
          </div>
        </div>

        {gen.status === "error" && gen.error && (
          <p role="alert" className="studio-error"><AlertCircle size={15} style={{ flex: "none" }} aria-hidden /> {gen.error}</p>
        )}
      </section>

      {/* Live preview */}
      {(gen.status === "streaming" || gen.status === "done") && (
        <section className="glass studio-card" aria-label="Landing page preview">
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Globe size={16} strokeWidth={1.8} style={{ color: "var(--accent-primary)" }} aria-hidden />
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                {isGenerating ? "Building your landing page…" : "Landing page preview"}
              </h3>
              {isGenerating && <span className="status-live tabular">{Math.round(gen.html.length / 1000)} KB</span>}
            </div>
            {gen.status === "done" && (
              <div style={{ position: "relative" }}>
                <button type="button" className="chip" aria-haspopup="menu" aria-expanded={exportOpen} onClick={() => setExportOpen(v => !v)}>
                  <Download size={14} strokeWidth={2} aria-hidden /> Export <ChevronDown size={13} strokeWidth={2} aria-hidden />
                </button>
                {exportOpen && (
                  <>
                    <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setExportOpen(false)} />
                    <div className="glass gen-menu" role="menu" style={{ top: "calc(100% + 8px)", right: 0 }}>
                      {([
                        { icon: Download,   label: "YouCan",       action: handleExportYouCan },
                        { icon: ImageIcon,  label: "Image (PNG)",  action: handleExportImage },
                        { icon: FileCode2,  label: "HTML file",    action: handleExportHtml },
                      ] as { icon: React.ElementType; label: string; action: () => void }[]).map(({ icon: Icon, label, action }) => (
                        <button key={label} type="button" role="menuitem" className="menu-item" onClick={action}>
                          <Icon size={14} strokeWidth={1.8} aria-hidden /> <span style={{ flex: 1, textAlign: "left" }}>{label}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="lp-frame" style={{ height: isGenerating ? 200 : 600, transition: "height 0.3s ease" }}>
            {isGenerating && gen.html.length < 100 ? (
              <div className="gen-state shimmer" role="status">
                <Loader2 size={26} className="spinner" style={{ color: "var(--accent-primary)" }} aria-hidden />
                <span>Generating your landing page…</span>
              </div>
            ) : (
              <iframe ref={iframeRef} srcDoc={gen.html} sandbox="allow-scripts" style={{ width: "100%", height: "100%", border: "none", display: "block" }} title="Landing page preview" />
            )}
          </div>

          {gen.status === "done" && (
            <button type="button" className="btn-secondary glass-inner" style={{ width: "100%", minHeight: 48, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={() => openInTab(gen.html)}>
              <ExternalLink size={15} strokeWidth={2} aria-hidden /> Open in new tab
            </button>
          )}
        </section>
      )}

      {/* Gallery */}
      {pages.length > 0 && (
        <div className="studio-gallery" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
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

      {/* Fullscreen preview */}
      {previewPage && previewPage.html && (
        <div role="dialog" aria-modal="true" aria-label="Landing page preview" style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(5,6,10,0.88)", display: "flex", flexDirection: "column" }}>
          <div className="lp-fs-head">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Globe size={16} strokeWidth={1.8} style={{ color: "var(--accent-primary)" }} aria-hidden />
              <span style={{ fontSize: 14, fontWeight: 600 }}>{previewPage.copyframe} · {previewPage.createdAt}</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button type="button" className="chip" onClick={() => openInTab(previewPage.html)}>
                <ExternalLink size={14} aria-hidden /> Open in tab
              </button>
              <button type="button" className="chip" onClick={() => downloadHtml(previewPage.html, `lp-${previewPage.createdAt.replace(/\s+/g, "-").toLowerCase()}.html`)}>
                <Download size={14} aria-hidden /> HTML
              </button>
              <button type="button" className="chip" onClick={() => { openYouCan(previewPage.html); setPreviewPage(null); }}>
                <Download size={14} aria-hidden /> YouCan
              </button>
              <button type="button" className="chip" style={{ width: 40, padding: 0, justifyContent: "center" }} aria-label="Close preview" onClick={() => setPreviewPage(null)}>
                <X size={16} aria-hidden />
              </button>
            </div>
          </div>
          <iframe srcDoc={previewPage.html} sandbox="allow-scripts" style={{ flex: 1, border: "none", background: "#fff" }} title="Landing page fullscreen preview" />
        </div>
      )}

      {/* YouCan export modal */}
      {youCanOpen && youCanData && (
        <div className="lp-modal-overlay" onClick={() => setYouCanOpen(false)}>
          <div className="glass" role="dialog" aria-modal="true" aria-labelledby="youcan-title" onClick={e => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 720, borderRadius: 28, padding: 24, display: "flex", flexDirection: "column", gap: 18, maxHeight: "90vh", overflow: "hidden", background: "var(--glass-strong)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div>
                <h3 id="youcan-title" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>YouCan export</h3>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>
                  Parameters → Content → Custom code → paste each field below
                </p>
              </div>
              <button type="button" className="glass-inner icon-chip" aria-label="Close" style={{ width: 40, height: 40, borderRadius: 14, flex: "none" }} onClick={() => setYouCanOpen(false)}>
                <X size={16} aria-hidden />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", display: "grid", gap: 18 }}>
              {([
                { label: "Custom CSS content",    value: youCanData.css },
                { label: "Custom script content", value: youCanData.scriptHtml },
              ]).map(({ label, value }) => (
                <div key={label} className="studio-field">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span className="field-label">{label}</span>
                    <CopyButton text={value} />
                  </div>
                  <textarea
                    readOnly
                    className="input-well"
                    aria-label={label}
                    value={value}
                    style={{ height: 180, borderRadius: 18, padding: "12px 14px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, lineHeight: 1.5, resize: "vertical" }}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" className="btn-secondary glass-inner" style={{ width: "auto", minHeight: 44, padding: "0 22px" }} onClick={() => setYouCanOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <InsufficientCreditsModal
        open={creditModalOpen}
        onClose={() => setCreditModalOpen(false)}
        required={CREDIT_COSTS.LANDING_PAGE}
        balance={credits ?? 0}
      />
    </div>
  );
}
