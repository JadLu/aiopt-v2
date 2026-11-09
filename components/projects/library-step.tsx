"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, Film, Sparkles } from "lucide-react";
import { subscribeToAiCreatives, type AiCreative } from "@/lib/firebase/ai-creatives";
import { subscribeToAiVideos, type AiVideo } from "@/lib/firebase/ai-videos";
import { subscribeToRenderedVideos, type RenderedVideo } from "@/lib/firebase/rendered-videos";
import { downloadViaProxy } from "@/lib/auth-fetch";
import { EmptyState } from "@/components/ui/empty-state";
import { LiquidButton } from "@/components/ui/liquid-button";

interface LibraryStepProps {
  uid: string;
  projectId: string;
  projectName: string;
  onGoToCreatives: () => void;
}

interface Asset {
  key: string;
  kind: "image" | "video";
  label: string;
  url: string;
  filename: string;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
}

export function LibraryStep({ uid, projectId, projectName, onGoToCreatives }: LibraryStepProps) {
  const [images, setImages] = useState<AiCreative[]>([]);
  const [videos, setVideos] = useState<AiVideo[]>([]);
  const [renders, setRenders] = useState<RenderedVideo[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Assets whose file no longer loads are left out of the library.
  const [broken, setBroken] = useState<Set<string>>(() => new Set());
  const markBroken = (key: string) => setBroken((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));

  useEffect(() => subscribeToAiCreatives(uid, projectId, setImages), [uid, projectId]);
  useEffect(() => subscribeToAiVideos(uid, projectId, setVideos), [uid, projectId]);
  useEffect(() => subscribeToRenderedVideos(uid, projectId, setRenders), [uid, projectId]);

  const base = slug(projectName);
  const assets: Asset[] = [
    ...images.filter((c) => c.status === "done" && c.imageUrl).map((c, i): Asset => ({
      key: `i-${c.id}`, kind: "image", label: c.prompt, url: c.imageUrl, filename: `${base}-image-${i + 1}.jpg`,
    })),
    ...videos.filter((v) => v.status === "done" && v.videoUrl).map((v, i): Asset => ({
      key: `v-${v.id}`, kind: "video", label: v.prompt, url: v.videoUrl, filename: `${base}-video-${i + 1}.mp4`,
    })),
    ...renders.filter((r) => r.videoUrl).map((r, i): Asset => ({
      key: `r-${r.id}`, kind: "video", label: `Final video · ${r.clipCount} clips`, url: r.videoUrl, filename: `${base}-final-${i + 1}.mp4`,
    })),
  ].filter((a) => !broken.has(a.key));

  async function download(a: Asset) {
    setBusy(a.key);
    setError(null);
    try { await downloadViaProxy(a.url, a.filename); }
    catch (e) { setError(e instanceof Error ? e.message : "Download failed"); }
    finally { setBusy(null); }
  }

  if (assets.length === 0) {
    return (
      <EmptyState
        icon={<Sparkles size={24} />}
        title="Nothing to export yet"
        description="Images and videos you create for this project show up here, ready to download."
        action={<LiquidButton onClick={onGoToCreatives}>Go to Creatives</LiquidButton>}
      />
    );
  }

  return (
    <section aria-label="Library" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h2 className="section-title">Library</h2>
        <span className="page-sub" style={{ fontSize: 13.5 }}>
          <span className="tabular">{assets.length}</span> finished asset{assets.length !== 1 ? "s" : ""} for this project.
        </span>
      </div>
      {error && <p role="alert" className="field-error" style={{ margin: 0 }}>{error}</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 18 }}>
        {assets.map((a) => (
          <article key={a.key} className="glass asset-tile lift">
            <div className="asset-media">
              {a.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.url} alt={a.label} loading="lazy" style={{ fontSize: 0, color: "transparent" }} onError={() => markBroken(a.key)} />
              ) : (
                <>
                  <video src={a.url} muted playsInline preload="metadata" aria-label={a.label} onError={() => markBroken(a.key)} />
                </>
              )}
            </div>
            <div style={{ padding: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-secondary)" }}>
                {a.kind === "video" && <Film size={13} aria-hidden />}
                <span dir="auto" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.label}</span>
              </span>
              <button
                type="button"
                className="icon-btn-sm"
                aria-label={`Download ${a.filename}`}
                disabled={busy === a.key}
                onClick={() => download(a)}
              >
                {busy === a.key ? <Loader2 size={15} className="spinner" /> : <Download size={15} />}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
