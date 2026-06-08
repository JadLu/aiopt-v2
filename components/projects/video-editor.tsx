"use client";

import { useState, useEffect, useRef } from "react";
import {
  Play, Pause, SkipBack, Plus, Trash2, ZoomIn, ZoomOut,
  Download, X, Music, Video as VideoIcon, MoreVertical, AlertCircle, Check,
  Upload, Volume2, VolumeX,
} from "lucide-react";
import { uploadRenderedVideo } from "@/lib/cloudinary";
import {
  createRenderedVideo, deleteRenderedVideo,
  subscribeToRenderedVideos, type RenderedVideo,
} from "@/lib/firebase/rendered-videos";

// ─── Types ────────────────────────────────────────────────────────────────────

type ClipKind = "video" | "audio";

interface EditorClip {
  id: string;
  kind: ClipKind;
  name: string;
  file: File;
  localUrl: string;
  nativeDuration: number;
  thumbnails: string[];
  waveformBars: number[];
  startAt: number;
  trimStart: number;
  trimEnd: number;
  muted: boolean;
}

interface MediaItem {
  id: string;
  kind: ClipKind;
  name: string;
  file: File;
  localUrl: string;
  nativeDuration: number;
  thumbnails: string[];
  waveformBars: number[];
  processing: boolean;
}

type ExportPhase = "idle" | "recording" | "uploading" | "done" | "error";
interface ExportState { phase: ExportPhase; progress: number; error: string | null; }

const INITIAL_EXPORT: ExportState = { phase: "idle", progress: 0, error: null };
const ZOOM_STEPS = [20, 40, 60, 80, 120, 180, 240] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function extractVideoFrames(src: string, count = 10): Promise<string[]> {
  return new Promise(resolve => {
    const vid   = document.createElement("video");
    vid.src     = src;
    vid.muted   = true;
    vid.preload = "auto";

    const canvas = document.createElement("canvas");
    canvas.width = 96; canvas.height = 54;
    const ctx = canvas.getContext("2d");
    if (!ctx) { resolve([]); return; }

    const frames: string[] = [];
    let dur = 0; let seeking = false;
    const abort = setTimeout(() => resolve(frames), 10000);

    function seekTo(s: number) { seeking = true; vid.currentTime = s; }

    vid.addEventListener("loadedmetadata", () => {
      dur = vid.duration;
      if (!isFinite(dur) || dur <= 0) { clearTimeout(abort); resolve([]); return; }
      seekTo(0);
    });
    vid.addEventListener("seeked", () => {
      if (!seeking) return;
      seeking = false;
      ctx.drawImage(vid, 0, 0, 96, 54);
      frames.push(canvas.toDataURL("image/jpeg", 0.6));
      if (frames.length < count) seekTo((frames.length / count) * dur);
      else { clearTimeout(abort); resolve(frames); }
    });
    vid.addEventListener("error", () => { clearTimeout(abort); resolve(frames); });
  });
}

async function extractWaveform(file: File, barCount = 100): Promise<number[]> {
  try {
    const ab  = await file.arrayBuffer();
    const buf = await new OfflineAudioContext(1, 44100, 44100).decodeAudioData(ab);
    const data = buf.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / barCount));
    const raw  = Array.from({ length: barCount }, (_, i) => {
      let s = 0;
      const o = i * step;
      for (let j = 0; j < step && o + j < data.length; j++) s += Math.abs(data[o + j]);
      return s / step;
    });
    const peak = Math.max(...raw, 0.0001);
    return raw.map(v => v / peak);
  } catch { return []; }
}

function fmt(sec: number): string {
  const m  = Math.floor(sec / 60);
  const s  = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 10);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${ms}`;
}

function detectMime(): string {
  if (typeof MediaRecorder === "undefined") return "video/mp4";
  for (const m of [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4;codecs=h264,aac",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ]) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "video/mp4";
}

// ─── MediaItemRow ─────────────────────────────────────────────────────────────

function MediaItemRow({
  item, onAdd, onRemove,
}: { item: MediaItem; onAdd: () => void; onRemove: () => void; }) {
  return (
    <div
      onClick={onAdd}
      title="Click to add to timeline"
      style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-default)", cursor: "pointer", transition: "border-color 0.13s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent-primary)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-default)"; }}
    >
      {/* Thumbnail / waveform mini */}
      <div style={{ width: 44, height: 30, borderRadius: 4, overflow: "hidden", flexShrink: 0, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {item.kind === "video" && item.thumbnails[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.thumbnails[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : item.kind === "audio" && item.waveformBars.length > 0 ? (
          <svg width={44} height={30} viewBox="0 0 44 30">
            {item.waveformBars.slice(0, 22).map((bar, i) => {
              const h = Math.max(2, bar * 26);
              return <rect key={i} x={i * 2} y={(30 - h) / 2} width={1.5} height={h} fill="var(--accent-secondary)" opacity={0.8} />;
            })}
          </svg>
        ) : item.kind === "video"
          ? <VideoIcon size={14} color="var(--text-tertiary)" />
          : <Music size={14} color="var(--text-tertiary)" />
        }
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.name.length > 22 ? item.name.slice(0, 19) + "…" : item.name}
        </div>
        <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 1 }}>
          {item.processing ? "Processing…" : `${fmt(item.nativeDuration)}`}
        </div>
      </div>

      {/* Remove */}
      <button onClick={e => { e.stopPropagation(); onRemove(); }}
        style={{ width: 20, height: 20, borderRadius: 4, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", flexShrink: 0 }}>
        <X size={11} />
      </button>
    </div>
  );
}

// ─── ClipBlock ────────────────────────────────────────────────────────────────

interface ClipBlockProps {
  clip: EditorClip;
  pxPerSec: number;
  trackH: number;
  selected: boolean;
  onSelect: () => void;
  onBodyDrag: (e: React.MouseEvent) => void;
  onTrimLeft: (e: React.MouseEvent) => void;
  onTrimRight: (e: React.MouseEvent) => void;
  isMuted?: boolean;
  onToggleMute?: (e: React.MouseEvent) => void;
}

function ClipBlock({ clip, pxPerSec, trackH, selected, onSelect, onBodyDrag, onTrimLeft, onTrimRight, isMuted, onToggleMute }: ClipBlockProps) {
  const effectiveDur = clip.trimEnd - clip.trimStart;
  const left  = clip.startAt * pxPerSec;
  const width = Math.max(effectiveDur * pxPerSec, 20);
  const isVid = clip.kind === "video";
  const accent = isVid ? "var(--accent-primary)" : "var(--accent-secondary)";

  return (
    <div
      onMouseDown={onBodyDrag}
      onClick={e => { e.stopPropagation(); onSelect(); }}
      style={{
        position: "absolute", left, width, top: 2, bottom: 2,
        borderRadius: 5, overflow: "hidden", cursor: "grab", userSelect: "none", boxSizing: "border-box",
        border: `1.5px solid ${selected ? accent : `color-mix(in srgb, ${accent} 50%, transparent)`}`,
        background: isVid
          ? "color-mix(in srgb, var(--accent-primary) 18%, var(--bg-elevated))"
          : "color-mix(in srgb, var(--accent-secondary) 18%, var(--bg-elevated))",
      }}
    >
      {/* Filmstrip (video) */}
      {isVid && clip.thumbnails.length > 0 && (
        <div style={{ position: "absolute", inset: 0, display: "flex", overflow: "hidden" }}>
          {Array.from({ length: Math.ceil(width / 80) + 1 }, (_, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={clip.thumbnails[i % clip.thumbnails.length]} alt=""
              style={{ height: "100%", width: 80, objectFit: "cover", flexShrink: 0 }} />
          ))}
        </div>
      )}

      {/* Waveform (audio) */}
      {!isVid && clip.waveformBars.length > 0 && (
        <svg width={width} height={trackH - 4} style={{ position: "absolute", inset: 0 }} preserveAspectRatio="none">
          {clip.waveformBars.map((bar, i) => {
            const x = (i / clip.waveformBars.length) * width;
            const h = Math.max(2, bar * (trackH - 10));
            return <rect key={i} x={x} y={((trackH - 4) - h) / 2}
              width={Math.max(1, width / clip.waveformBars.length - 0.5)} height={h}
              fill="var(--accent-secondary)" opacity={0.75} />;
          })}
        </svg>
      )}

      {/* Name + mute overlay — painted after filmstrip so always on top */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        padding: "4px 10px",
        background: isVid
          ? "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 42%, transparent 55%, rgba(0,0,0,0.45) 100%)"
          : "transparent",
        pointerEvents: "none",
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: isVid ? "#fff" : accent,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          textShadow: isVid ? "0 1px 2px rgba(0,0,0,0.8)" : "none" }}>
          {clip.name}
        </span>
        {isVid && onToggleMute && (
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onToggleMute(e); }}
            style={{
              pointerEvents: "all",
              alignSelf: "flex-start",
              display: "flex", alignItems: "center", gap: 3,
              padding: "2px 7px", borderRadius: 4,
              fontSize: 9, fontWeight: 700,
              border: "none",
              background: isMuted ? "rgba(229,118,118,0.88)" : "rgba(0,0,0,0.65)",
              color: "#fff",
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {isMuted ? <VolumeX size={8} /> : <Volume2 size={8} />}
            {isMuted ? "Muted" : "Audio"}
          </button>
        )}
      </div>

      {/* Left trim handle */}
      <div onMouseDown={e => { e.stopPropagation(); onTrimLeft(e); }}
        style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 10,
          cursor: "col-resize", zIndex: 10, background: accent,
          display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 2, height: "55%", background: "rgba(255,255,255,0.65)", borderRadius: 1 }} />
      </div>

      {/* Right trim handle */}
      <div onMouseDown={e => { e.stopPropagation(); onTrimRight(e); }}
        style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 10,
          cursor: "col-resize", zIndex: 10, background: accent,
          display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 2, height: "55%", background: "rgba(255,255,255,0.65)", borderRadius: 1 }} />
      </div>
    </div>
  );
}

// ─── RenderedVideoCard ────────────────────────────────────────────────────────

export function RenderedVideoCard({
  video, uid, projectId,
}: { video: RenderedVideo; uid: string; projectId: string }) {
  const [err,      setErr]      = useState(false);
  const [menu,     setMenu]     = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const hasVideo = !!video.videoUrl && !err;

  function handleDownload() {
    setMenu(false);
    const fname = `render-${video.id}.mp4`;
    const a = document.createElement("a");
    a.href     = `/api/download?url=${encodeURIComponent(video.videoUrl)}&filename=${encodeURIComponent(fname)}`;
    a.download = fname;
    a.click();
  }

  async function handleDelete() {
    setMenu(false); setDeleting(true);
    try { await deleteRenderedVideo(uid, projectId, video.id); }
    catch { setDeleting(false); }
  }

  return (
    <>
      <div className="card" style={{ padding: 0, overflow: "hidden", opacity: deleting ? 0.45 : 1, transition: "opacity 0.2s" }}>
        <div style={{ height: 200, background: "var(--bg-subtle)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", cursor: hasVideo ? "pointer" : "default" }}
          onClick={() => { if (hasVideo) setLightbox(true); }}>
          {hasVideo ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={video.videoUrl} muted loop playsInline
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onMouseEnter={e => e.currentTarget.play()}
              onMouseLeave={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
              onError={() => setErr(true)} />
          ) : (
            <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Video unavailable</span>
          )}

          {/* Badges */}
          <div style={{ position: "absolute", bottom: 8, left: 8, display: "flex", gap: 5 }}>
            <span style={{ background: "rgba(0,0,0,0.55)", borderRadius: 5, padding: "2px 7px", fontSize: 10, color: "#fff" }}>Rendered</span>
            <span style={{ background: "rgba(0,0,0,0.55)", borderRadius: 5, padding: "2px 7px", fontSize: 10, color: "#fff" }}>
              {fmt(video.durationSec)} · {video.clipCount} clip{video.clipCount !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Menu */}
          <div style={{ position: "absolute", top: 6, right: 6 }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setMenu(o => !o)} style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(0,0,0,0.55)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
              <MoreVertical size={14} />
            </button>
            {menu && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setMenu(false)} />
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
        </div>

        <div style={{ padding: "10px 12px" }}>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 4px" }}>
            {video.clipCount} clip{video.clipCount !== 1 ? "s" : ""} composed
          </p>
          <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0 }}>{video.createdAt}</p>
        </div>
      </div>

      {lightbox && hasVideo && (
        <div className="dialog-overlay" style={{ zIndex: 100 }} onClick={() => setLightbox(false)}>
          <div style={{ maxWidth: "min(90vw, 900px)", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }} onClick={e => e.stopPropagation()}>
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

// ─── VideoEditor ──────────────────────────────────────────────────────────────

export function VideoEditor({ uid, projectId }: { uid: string; projectId: string }) {
  // ── State ────────────────────────────────────────────────────────────────────
  const [mediaItems,     setMediaItems]     = useState<MediaItem[]>([]);
  const [clips,          setClips]          = useState<EditorClip[]>([]);
  const [currentTime,    setCurrentTime]    = useState(0);
  const [isPlaying,      setIsPlaying]      = useState(false);
  const [pxPerSec,       setPxPerSec]       = useState<number>(80);
  const [selectedId,     setSelectedId]     = useState<string | null>(null);
  const [exportState,    setExportState]    = useState<ExportState>(INITIAL_EXPORT);
  const [renderedVideos, setRenderedVideos] = useState<RenderedVideo[]>([]);

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const canvasRef        = useRef<HTMLCanvasElement>(null);
  const videoElsRef      = useRef<Map<string, HTMLVideoElement>>(new Map());
  const audioCtxRef      = useRef<AudioContext | null>(null);
  const audioSrcsRef     = useRef<AudioBufferSourceNode[]>([]);
  const audioCacheRef    = useRef<Map<string, AudioBuffer>>(new Map());
  const rafRef           = useRef<number>(0);
  const rafTsRef         = useRef<number | null>(null);
  const currentTimeRef   = useRef(0);
  const isPlayingRef     = useRef(false);
  const clipsRef         = useRef<EditorClip[]>([]);
  const totalDurRef      = useRef(0);
  const pxPerSecRef      = useRef(80);
  const timelineRef      = useRef<HTMLDivElement>(null);
  const exportRafRef     = useRef<number>(0);

  // ── Keep refs in sync ────────────────────────────────────────────────────────
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  useEffect(() => { isPlayingRef.current   = isPlaying;   }, [isPlaying]);
  useEffect(() => { clipsRef.current       = clips;        }, [clips]);
  useEffect(() => { pxPerSecRef.current    = pxPerSec;    }, [pxPerSec]);

  // ── Computed ─────────────────────────────────────────────────────────────────
  const totalDuration = clips.length > 0
    ? Math.max(...clips.map(c => c.startAt + (c.trimEnd - c.trimStart)))
    : 0;
  useEffect(() => { totalDurRef.current = totalDuration; }, [totalDuration]);

  const videoClips = clips.filter(c => c.kind === "video");
  const audioClips = clips.filter(c => c.kind === "audio");
  const timelineW  = Math.max(totalDuration * pxPerSec + 400, 900);

  // ── Subscriptions / cleanup ───────────────────────────────────────────────────
  useEffect(() => subscribeToRenderedVideos(uid, projectId, setRenderedVideos), [uid, projectId]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      cancelAnimationFrame(exportRafRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
      mediaItems.forEach(m => URL.revokeObjectURL(m.localUrl));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Audio helpers ────────────────────────────────────────────────────────────

  async function decodeBuffer(file: File): Promise<AudioBuffer | null> {
    const cacheKey = file.name + file.size;
    const cached   = audioCacheRef.current.get(cacheKey);
    if (cached) return cached;
    try {
      const ab  = await file.arrayBuffer();
      const tmp = new AudioContext();
      const buf = await tmp.decodeAudioData(ab);
      await tmp.close();
      audioCacheRef.current.set(cacheKey, buf);
      return buf;
    } catch { return null; }
  }

  function cancelAudio() {
    for (const src of audioSrcsRef.current) { try { src.stop(); } catch {} }
    audioSrcsRef.current = [];
  }

  async function scheduleAudio(fromSec: number, destNode?: AudioNode) {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    cancelAudio();
    const now = ctx.currentTime;
    for (const clip of clipsRef.current.filter(c => c.kind === "audio" || (c.kind === "video" && !c.muted))) {
      const clipEnd = clip.startAt + (clip.trimEnd - clip.trimStart);
      if (clipEnd <= fromSec) continue;
      const buf = await decodeBuffer(clip.file);
      if (!buf) continue;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(destNode ?? ctx.destination);
      const posInClip = Math.max(0, fromSec - clip.startAt);
      const whenStart = now + Math.max(0, clip.startAt - fromSec);
      const playFrom  = clip.trimStart + posInClip;
      const dur       = clip.trimEnd - clip.trimStart - posInClip;
      if (dur > 0) { src.start(whenStart, playFrom, dur); audioSrcsRef.current.push(src); }
    }
  }

  // ── Playback ─────────────────────────────────────────────────────────────────

  function drawFrame(t: number, targetCanvas?: HTMLCanvasElement, targetW?: number, targetH?: number) {
    const canvas = targetCanvas ?? canvasRef.current;
    const ctx    = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const w = targetW ?? canvas.width;
    const h = targetH ?? canvas.height;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    const cur = clipsRef.current;
    const active = cur
      .filter(c => c.kind === "video" && t >= c.startAt && t < c.startAt + (c.trimEnd - c.trimStart))
      .sort((a, b) => a.startAt - b.startAt);
    for (const clip of active) {
      const el = videoElsRef.current.get(clip.id);
      if (el && el.readyState >= 2) ctx.drawImage(el, 0, 0, w, h);
    }
  }

  function syncVideoEls(t: number) {
    for (const clip of clipsRef.current.filter(c => c.kind === "video")) {
      const el = videoElsRef.current.get(clip.id);
      if (!el) continue;
      const pos = t - clip.startAt;
      if (pos < 0 || pos >= clip.trimEnd - clip.trimStart) {
        if (!el.paused) el.pause();
        continue;
      }
      const target = clip.trimStart + pos;
      if (Math.abs(el.currentTime - target) > 0.06) el.currentTime = target;
      if (el.paused) el.play().catch(() => {});
    }
  }

  function rafTick(ts: number) {
    if (rafTsRef.current === null) rafTsRef.current = ts;
    const wall = (ts - rafTsRef.current) / 1000;
    rafTsRef.current = ts;
    const dur  = totalDurRef.current;
    const next = Math.min(currentTimeRef.current + wall, dur);
    currentTimeRef.current = next;
    setCurrentTime(next);
    drawFrame(next);
    syncVideoEls(next);
    // Auto-scroll playhead into view
    if (timelineRef.current) {
      const ph   = next * pxPerSecRef.current;
      const sw   = timelineRef.current.clientWidth;
      const sl   = timelineRef.current.scrollLeft;
      if (ph > sl + sw - 60) timelineRef.current.scrollLeft = ph - sw / 2;
    }
    if (next >= dur && dur > 0) {
      setIsPlaying(false); isPlayingRef.current = false;
      for (const [, el] of videoElsRef.current) el.pause();
      return;
    }
    rafRef.current = requestAnimationFrame(rafTick);
  }

  async function play() {
    if (isPlayingRef.current || totalDurRef.current === 0) return;
    const t = currentTimeRef.current;

    // Re-seek every active video element to force the browser to decode the
    // current frame. Without this, resuming from pause can produce a black
    // canvas on the first RAF tick because the element hasn't re-composited.
    await Promise.all(
      clipsRef.current.filter(c => c.kind === "video").map(clip => {
        const el = videoElsRef.current.get(clip.id);
        if (!el) return Promise.resolve();
        const pos = t - clip.startAt;
        if (pos < 0 || pos >= clip.trimEnd - clip.trimStart) { el.pause(); return Promise.resolve(); }
        el.currentTime = clip.trimStart + pos;
        return new Promise<void>(res => {
          el.addEventListener("seeked", () => res(), { once: true });
          setTimeout(res, 600);
        });
      })
    );

    // Draw first frame now that elements have a decoded frame at the seek position
    drawFrame(t);

    // Kick off video playback (async, RAF will keep them in sync)
    for (const clip of clipsRef.current.filter(c => c.kind === "video")) {
      const el = videoElsRef.current.get(clip.id);
      if (!el) continue;
      const pos = t - clip.startAt;
      if (pos >= 0 && pos < clip.trimEnd - clip.trimStart) el.play().catch(() => {});
    }

    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    await audioCtxRef.current.resume();
    await scheduleAudio(t);

    isPlayingRef.current = true;
    setIsPlaying(true);
    rafTsRef.current = null;
    rafRef.current = requestAnimationFrame(rafTick);
  }

  async function pause() {
    cancelAnimationFrame(rafRef.current);
    isPlayingRef.current = false;
    setIsPlaying(false);
    for (const [, el] of videoElsRef.current) el.pause();
    if (audioCtxRef.current) { cancelAudio(); await audioCtxRef.current.suspend().catch(() => {}); }
  }

  function seekToTime(t: number) {
    const clamped = Math.max(0, Math.min(t, totalDurRef.current));
    currentTimeRef.current = clamped;
    setCurrentTime(clamped);
    drawFrame(clamped);
    if (isPlayingRef.current) {
      // reschedule audio from new position
      scheduleAudio(clamped).catch(() => {});
    }
  }

  // ── Timeline interactions ────────────────────────────────────────────────────

  function handleTimelineClick(e: React.MouseEvent<HTMLDivElement>) {
    // Only seek on direct track/ruler clicks (not on clips)
    if ((e.target as HTMLElement).closest("[data-clip]")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x    = e.clientX - rect.left + e.currentTarget.scrollLeft;
    seekToTime(x / pxPerSecRef.current);
  }

  function startBodyDrag(e: React.MouseEvent, clipId: string) {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX;
    const clip   = clipsRef.current.find(c => c.id === clipId);
    if (!clip) return;
    const origStartAt = clip.startAt;
    function onMove(ev: MouseEvent) {
      const dx = ev.clientX - startX;
      setClips(prev => prev.map(c => c.id === clipId
        ? { ...c, startAt: Math.max(0, origStartAt + dx / pxPerSecRef.current) }
        : c
      ));
    }
    function onUp() { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function startTrimLeft(e: React.MouseEvent, clipId: string) {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX;
    const clip   = clipsRef.current.find(c => c.id === clipId);
    if (!clip) return;
    const origTrimStart = clip.trimStart;
    const origStartAt   = clip.startAt;
    function onMove(ev: MouseEvent) {
      const dx  = ev.clientX - startX;
      const dSec = dx / pxPerSecRef.current;
      setClips(prev => prev.map(c => {
        if (c.id !== clipId) return c;
        const newTrimStart = Math.max(0, Math.min(origTrimStart + dSec, c.trimEnd - 0.5));
        const applied      = newTrimStart - origTrimStart;
        return { ...c, trimStart: newTrimStart, startAt: Math.max(0, origStartAt + applied) };
      }));
    }
    function onUp() { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function startTrimRight(e: React.MouseEvent, clipId: string) {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX;
    const clip   = clipsRef.current.find(c => c.id === clipId);
    if (!clip) return;
    const origTrimEnd = clip.trimEnd;
    function onMove(ev: MouseEvent) {
      const dx  = ev.clientX - startX;
      const dSec = dx / pxPerSecRef.current;
      setClips(prev => prev.map(c => {
        if (c.id !== clipId) return c;
        const newTrimEnd = Math.max(c.trimStart + 0.5, Math.min(origTrimEnd + dSec, c.nativeDuration));
        return { ...c, trimEnd: newTrimEnd };
      }));
    }
    function onUp() { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // ── Media management ─────────────────────────────────────────────────────────

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    files.forEach(file => {
      const id: string     = crypto.randomUUID();
      const isVid  = file.type.startsWith("video/");
      const localUrl = URL.createObjectURL(file);
      const item: MediaItem = {
        id, kind: isVid ? "video" : "audio", name: file.name, file, localUrl,
        nativeDuration: 0, thumbnails: [], waveformBars: [], processing: true,
      };
      setMediaItems(prev => [...prev, item]);

      // Process async
      (async () => {
        let nativeDuration = 0;
        let thumbnails: string[] = [];
        const waveformBars = await extractWaveform(file);

        if (isVid) {
          // Get duration from video element
          nativeDuration = await new Promise<number>(res => {
            const v = document.createElement("video");
            v.src = localUrl; v.preload = "metadata";
            v.onloadedmetadata = () => res(isFinite(v.duration) ? v.duration : 0);
            v.onerror = () => res(0);
          });
          thumbnails = await extractVideoFrames(localUrl);
        } else {
          try {
            const buf = await new OfflineAudioContext(1, 44100, 44100).decodeAudioData(await file.arrayBuffer());
            nativeDuration = buf.duration;
          } catch {}
        }

        setMediaItems(prev => prev.map(m =>
          m.id === id ? { ...m, nativeDuration, thumbnails, waveformBars, processing: false } : m
        ));
      })();
    });
  }

  function removeMediaItem(id: string) {
    setMediaItems(prev => {
      const item = prev.find(m => m.id === id);
      if (item) URL.revokeObjectURL(item.localUrl);
      return prev.filter(m => m.id !== id);
    });
    // Also remove from timeline if present
    setClips(prev => prev.filter(c => {
      // clips don't directly reference mediaItem id, match by localUrl is unreliable
      // Just leave clips intact — removing media doesn't auto-remove timeline clips
      return c.id !== id;
    }));
  }

  function addToTimeline(item: MediaItem) {
    if (item.processing || item.nativeDuration === 0) return;
    const isVid = item.kind === "video";
    // Find end of existing clips on this track
    const trackEnd = Math.max(0, ...clipsRef.current
      .filter(c => c.kind === item.kind)
      .map(c => c.startAt + (c.trimEnd - c.trimStart)));
    const clip: EditorClip = {
      id:             crypto.randomUUID(),
      kind:           item.kind,
      name:           item.name,
      file:           item.file,
      localUrl:       item.localUrl,
      nativeDuration: item.nativeDuration,
      thumbnails:     item.thumbnails,
      waveformBars:   item.waveformBars,
      startAt:        trackEnd,
      trimStart:      0,
      trimEnd:        item.nativeDuration,
      muted:          false,
    };
    void isVid; // suppress unused warning
    setClips(prev => [...prev, clip]);
  }

  function deleteSelected() {
    if (!selectedId) return;
    setClips(prev => prev.filter(c => c.id !== selectedId));
    setSelectedId(null);
  }

  function handleToggleMute(clipId: string) {
    setClips(prev => prev.map(c => c.id === clipId ? { ...c, muted: !c.muted } : c));
  }

  // ── Zoom ─────────────────────────────────────────────────────────────────────

  function zoomIn() {
    const idx = ZOOM_STEPS.indexOf(pxPerSec as typeof ZOOM_STEPS[number]);
    if (idx < ZOOM_STEPS.length - 1) setPxPerSec(ZOOM_STEPS[idx + 1]);
  }
  function zoomOut() {
    const idx = ZOOM_STEPS.indexOf(pxPerSec as typeof ZOOM_STEPS[number]);
    if (idx > 0) setPxPerSec(ZOOM_STEPS[idx - 1]);
  }

  // ── Export ───────────────────────────────────────────────────────────────────

  async function startExport() {
    if (clips.length === 0 || exportState.phase !== "idle") return;

    if (isPlayingRef.current) await pause();
    cancelAnimationFrame(rafRef.current);

    setExportState({ phase: "recording", progress: 0, error: null });

    // ── Fix 2: Pre-warm video elements while still in user-gesture context ────
    // Seek each clip to trimStart, wait for the seek to settle, then briefly
    // play+pause so the browser's autoplay policy is primed. Without this, the
    // el.play() calls inside exportTick (in a RAF callback) are silently rejected
    // and the canvas stays black.
    await Promise.all(
      clips.filter(c => c.kind === "video").map(async clip => {
        const el = videoElsRef.current.get(clip.id);
        if (!el) return;
        el.currentTime = clip.trimStart;
        await new Promise<void>(res => {
          const done = () => {
            el.removeEventListener("seeked", done);
            el.removeEventListener("error", done);
            res();
          };
          el.addEventListener("seeked", done);
          el.addEventListener("error", done);
          setTimeout(res, 2000); // fallback
        });
        // play() then immediately pause() to prime the autoplay policy.
        // Do NOT reset currentTime here — that triggers an un-awaited seek that
        // drops readyState to HAVE_METADATA before exportTick runs, causing a
        // black first frame.
        try { await el.play(); el.pause(); } catch {}
      })
    );

    // ── Fix 1a: Pre-decode audio BEFORE setting up the audio context ──────────
    // decodeBuffer() is async. If we called it inside the scheduling loop after
    // capturing `now = expAudioCtx.currentTime`, the context clock would have
    // advanced past `now` by the time we call src.start(), causing audio to play
    // in the past (or immediately, before the recorder is live).
    type AudioEntry = { clip: EditorClip; buf: AudioBuffer };
    const audioEntries: AudioEntry[] = [];
    for (const clip of clips.filter(c => c.kind === "audio" || (c.kind === "video" && !c.muted))) {
      const buf = await decodeBuffer(clip.file);
      if (buf) audioEntries.push({ clip, buf });
    }

    const expCanvas = document.createElement("canvas");
    expCanvas.width  = 1080;
    expCanvas.height = 1920;
    const expCtx = expCanvas.getContext("2d");
    if (!expCtx) { setExportState({ phase: "error", progress: 0, error: "Canvas unavailable" }); return; }

    const expAudioCtx = new AudioContext();
    const audioDest   = expAudioCtx.createMediaStreamDestination();

    const videoStream = expCanvas.captureStream(30);
    const combined    = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...audioDest.stream.getAudioTracks(),
    ]);

    const mimeType = detectMime();
    const recorder = new MediaRecorder(combined, { mimeType, videoBitsPerSecond: 4_000_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

    recorder.onstop = async () => {
      try {
        await expAudioCtx.close();
        const blob = new Blob(chunks, { type: mimeType });
        const ext   = mimeType.includes("mp4") ? "mp4" : "webm";
        const dlUrl = URL.createObjectURL(blob);
        const a     = document.createElement("a");
        a.href     = dlUrl;
        a.download = `render-${Date.now()}.${ext}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(dlUrl), 10_000);
        setExportState({ phase: "uploading", progress: 0, error: null });
        const videoUrl = await uploadRenderedVideo(uid, projectId, blob, pct =>
          setExportState({ phase: "uploading", progress: pct, error: null })
        );
        await createRenderedVideo(uid, projectId, {
          videoUrl,
          durationSec: totalDurRef.current,
          clipCount:   clips.length,
        });
        setExportState({ phase: "done", progress: 100, error: null });
        setTimeout(() => setExportState(INITIAL_EXPORT), 5000);
      } catch (err) {
        setExportState({ phase: "error", progress: 0, error: err instanceof Error ? err.message : "Export failed" });
      }
    };

    // ── Fix 1b: Start recorder FIRST, then schedule audio against live clock ──
    // Capturing `now` after recorder.start() guarantees the audio nodes fire
    // exactly in sync with what the recorder is capturing.
    recorder.start(100);

    const now = expAudioCtx.currentTime;
    for (const { clip, buf } of audioEntries) {
      const src = expAudioCtx.createBufferSource();
      src.buffer = buf;
      src.connect(audioDest);
      const delay = Math.max(0, clip.startAt);
      src.start(now + delay, clip.trimStart, clip.trimEnd - clip.trimStart);
    }

    let expTime = 0;
    let lastExpTs: number | null = null;
    const expDur = totalDurRef.current;

    function exportTick(ts: number) {
      const ctx2 = expCtx;
      if (!ctx2) return;
      if (lastExpTs === null) lastExpTs = ts;
      const wall = (ts - lastExpTs) / 1000;
      lastExpTs  = ts;
      expTime    = Math.min(expTime + wall, expDur);

      const pct = Math.round((expTime / expDur) * 100);
      setExportState({ phase: "recording", progress: pct, error: null });

      ctx2.fillStyle = "#000";
      ctx2.fillRect(0, 0, 1080, 1920);
      const activeVids = clips
        .filter(c => c.kind === "video" && expTime >= c.startAt && expTime < c.startAt + (c.trimEnd - c.trimStart))
        .sort((a, b) => a.startAt - b.startAt);
      for (const clip of activeVids) {
        const el = videoElsRef.current.get(clip.id);
        if (el && el.readyState >= 2) ctx2.drawImage(el, 0, 0, 1080, 1920);
      }

      // Drive video elements
      // Fix 3: threshold raised from 0.06 s → 0.5 s. At 0.06 s the element was
      // seeking on almost every RAF tick, stalling playback and producing frozen
      // frames. 0.5 s corrects real drifts without interrupting normal play.
      for (const clip of clips.filter(c => c.kind === "video")) {
        const el = videoElsRef.current.get(clip.id);
        if (!el) continue;
        const pos = expTime - clip.startAt;
        if (pos < 0 || pos >= clip.trimEnd - clip.trimStart) { if (!el.paused) el.pause(); continue; }
        const target = clip.trimStart + pos;
        if (Math.abs(el.currentTime - target) > 0.5) el.currentTime = target;
        if (el.paused) el.play().catch(() => {});
      }

      if (expTime >= expDur) {
        for (const [, el] of videoElsRef.current) el.pause();
        recorder.stop();
        return;
      }
      exportRafRef.current = requestAnimationFrame(exportTick);
    }

    exportRafRef.current = requestAnimationFrame(exportTick);
  }

  // ── Timeline ruler ───────────────────────────────────────────────────────────

  const rulerSec = Math.ceil(totalDuration + 5);
  const rulerTicks = Array.from({ length: rulerSec + 1 }, (_, i) => {
    const x = i * pxPerSec;
    const showLabel = pxPerSec >= 40 ? true : i % 5 === 0;
    return (
      <div key={i} style={{ position: "absolute", left: x, top: 0, bottom: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ width: 1, height: i % 5 === 0 ? 10 : 5, background: "var(--border-strong)", marginTop: i % 5 === 0 ? 0 : 5 }} />
        {showLabel && i % 5 === 0 && (
          <span style={{ fontSize: 8, color: "var(--text-tertiary)", marginTop: 1, letterSpacing: "0.02em" }}>
            {fmt(i).slice(0, -2)}
          </span>
        )}
      </div>
    );
  });

  // ─── JSX ───────────────────────────────────────────────────────────────────

  const isExporting = exportState.phase === "recording" || exportState.phase === "uploading";
  const zoomIdx     = (ZOOM_STEPS as ReadonlyArray<number>).indexOf(pxPerSec);

  return (
    <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: 14, overflow: "hidden" }}>

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderBottom: "1px solid var(--border-default)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "color-mix(in srgb, var(--accent-secondary) 12%, transparent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <VideoIcon size={15} color="var(--accent-secondary)" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Video Editor</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Arrange clips · preview · export</div>
          </div>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 9, fontSize: 12, fontWeight: 600, background: "color-mix(in srgb, var(--accent-primary) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)", color: "var(--accent-primary)", cursor: "pointer", fontFamily: "inherit" }}>
          <Plus size={13} /> Add Media
          <input type="file" multiple accept="video/*,audio/*,audio/mpeg,audio/wav,audio/aac" onChange={handleFiles} style={{ display: "none" }} />
        </label>
      </div>

      {/* ── Body: Media Panel + Preview ───────────────────────────────────────── */}
      <div style={{ display: "flex", height: 320 }}>

        {/* Media Panel */}
        <div style={{ width: 220, flexShrink: 0, borderRight: "1px solid var(--border-default)", overflowY: "auto", padding: "10px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
            Media ({mediaItems.length})
          </div>
          {mediaItems.length === 0 ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--text-tertiary)", textAlign: "center", padding: "20px 12px" }}>
              <Upload size={22} strokeWidth={1.5} />
              <div style={{ fontSize: 11 }}>Click "Add Media" to import video or audio files</div>
            </div>
          ) : (
            mediaItems.map(item => (
              <MediaItemRow
                key={item.id}
                item={item}
                onAdd={() => addToTimeline(item)}
                onRemove={() => removeMediaItem(item.id)}
              />
            ))
          )}
        </div>

        {/* Preview canvas */}
        <div style={{ flex: 1, background: "#111", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {clips.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, color: "var(--text-tertiary)" }}>
              <VideoIcon size={32} strokeWidth={1} />
              <div style={{ fontSize: 12 }}>Add clips to the timeline to preview</div>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              width={270}
              height={480}
              style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain", borderRadius: 4 }}
            />
          )}
        </div>
      </div>

      {/* ── Transport bar ──────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", borderTop: "1px solid var(--border-default)", borderBottom: "1px solid var(--border-default)", background: "var(--bg-subtle)" }}>
        <button
          onClick={() => seekToTime(0)}
          style={{ width: 28, height: 28, borderRadius: 7, background: "none", border: "1px solid var(--border-default)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}>
          <SkipBack size={13} />
        </button>

        <button
          onClick={() => isPlaying ? pause() : play()}
          disabled={clips.length === 0}
          style={{ width: 34, height: 34, borderRadius: 8, border: "none", cursor: clips.length === 0 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--accent-primary)", color: "#fff", opacity: clips.length === 0 ? 0.5 : 1 }}>
          {isPlaying ? <Pause size={15} /> : <Play size={15} />}
        </button>

        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums", minWidth: 110 }}>
          {fmt(currentTime)} / {fmt(totalDuration)}
        </span>

        {selectedId && (
          <button
            onClick={deleteSelected}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600, background: "rgba(229,118,118,0.08)", border: "1px solid rgba(229,118,118,0.25)", color: "var(--danger)", cursor: "pointer", fontFamily: "inherit" }}>
            <Trash2 size={11} /> Delete clip
          </button>
        )}

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>Zoom</span>
          <button onClick={zoomOut} disabled={zoomIdx <= 0}
            style={{ width: 26, height: 26, borderRadius: 6, background: "none", border: "1px solid var(--border-default)", cursor: zoomIdx <= 0 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", opacity: zoomIdx <= 0 ? 0.4 : 1 }}>
            <ZoomOut size={12} />
          </button>
          <button onClick={zoomIn} disabled={zoomIdx >= ZOOM_STEPS.length - 1}
            style={{ width: 26, height: 26, borderRadius: 6, background: "none", border: "1px solid var(--border-default)", cursor: zoomIdx >= ZOOM_STEPS.length - 1 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", opacity: zoomIdx >= ZOOM_STEPS.length - 1 ? 0.4 : 1 }}>
            <ZoomIn size={12} />
          </button>
        </div>
      </div>

      {/* ── Timeline ───────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", background: "var(--bg-base)" }}>

        {/* Track labels column */}
        <div style={{ width: 54, flexShrink: 0, borderRight: "1px solid var(--border-default)", display: "flex", flexDirection: "column" }}>
          <div style={{ height: 22 }} /> {/* ruler space */}
          <div style={{ height: 68, display: "flex", alignItems: "center", justifyContent: "center", borderTop: "1px solid var(--border-default)" }}>
            <span style={{ fontSize: 8, fontWeight: 800, color: "var(--accent-primary)", letterSpacing: "0.1em", textTransform: "uppercase", writingMode: "vertical-rl", transform: "rotate(180deg)" }}>VIDEO</span>
          </div>
          <div style={{ height: 52, display: "flex", alignItems: "center", justifyContent: "center", borderTop: "1px solid var(--border-default)" }}>
            <span style={{ fontSize: 8, fontWeight: 800, color: "var(--accent-secondary)", letterSpacing: "0.1em", textTransform: "uppercase", writingMode: "vertical-rl", transform: "rotate(180deg)" }}>AUDIO</span>
          </div>
        </div>

        {/* Scrollable track area */}
        <div
          ref={timelineRef}
          onClick={handleTimelineClick}
          style={{ flex: 1, overflowX: "auto", overflowY: "hidden", position: "relative", cursor: "crosshair" }}
        >
          <div style={{ width: timelineW, position: "relative" }}>

            {/* Ruler */}
            <div style={{ height: 22, position: "relative", background: "var(--bg-subtle)", borderBottom: "1px solid var(--border-default)" }}>
              {rulerTicks}
            </div>

            {/* Video track */}
            <div
              style={{ height: 68, position: "relative", background: "color-mix(in srgb, var(--accent-primary) 4%, var(--bg-elevated))", borderBottom: "1px solid var(--border-default)" }}
              onClick={e => { if ((e.target as HTMLElement) === e.currentTarget) setSelectedId(null); }}
            >
              {videoClips.map(clip => (
                <div key={clip.id} data-clip="1">
                  <ClipBlock
                    clip={clip} pxPerSec={pxPerSec} trackH={68}
                    selected={selectedId === clip.id}
                    onSelect={() => setSelectedId(clip.id)}
                    onBodyDrag={e => startBodyDrag(e, clip.id)}
                    onTrimLeft={e => startTrimLeft(e, clip.id)}
                    onTrimRight={e => startTrimRight(e, clip.id)}
                    isMuted={clip.muted}
                    onToggleMute={e => { e.stopPropagation(); handleToggleMute(clip.id); }}
                  />
                </div>
              ))}
              {videoClips.length === 0 && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", paddingLeft: 16, fontSize: 11, color: "var(--text-tertiary)", pointerEvents: "none" }}>
                  Click a video in the media panel to add it here
                </div>
              )}
            </div>

            {/* Audio track */}
            <div
              style={{ height: 52, position: "relative", background: "color-mix(in srgb, var(--accent-secondary) 3%, var(--bg-base))" }}
              onClick={e => { if ((e.target as HTMLElement) === e.currentTarget) setSelectedId(null); }}
            >
              {audioClips.map(clip => (
                <div key={clip.id} data-clip="1">
                  <ClipBlock
                    clip={clip} pxPerSec={pxPerSec} trackH={52}
                    selected={selectedId === clip.id}
                    onSelect={() => setSelectedId(clip.id)}
                    onBodyDrag={e => startBodyDrag(e, clip.id)}
                    onTrimLeft={e => startTrimLeft(e, clip.id)}
                    onTrimRight={e => startTrimRight(e, clip.id)}
                  />
                </div>
              ))}
              {audioClips.length === 0 && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", paddingLeft: 16, fontSize: 10, color: "var(--text-tertiary)", pointerEvents: "none" }}>
                  Click audio in the media panel to add it here
                </div>
              )}
            </div>

            {/* Playhead */}
            <div style={{ position: "absolute", left: currentTime * pxPerSec, top: 0, bottom: 0, width: 2, background: "#fff", boxShadow: "0 0 4px rgba(0,0,0,0.5)", pointerEvents: "none", zIndex: 25, transform: "translateX(-1px)" }}>
              <div style={{ position: "absolute", top: 18, left: "50%", transform: "translateX(-50%)", width: 10, height: 8, background: "#fff", borderRadius: "0 0 3px 3px", boxShadow: "0 2px 4px rgba(0,0,0,0.4)" }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Export bar ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border-default)", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <button
          className="btn-primary"
          onClick={startExport}
          disabled={clips.length === 0 || isExporting || exportState.phase === "done"}
          style={{ padding: "9px 20px", fontSize: 13, opacity: (clips.length === 0 || isExporting) ? 0.6 : 1 }}
        >
          {exportState.phase === "recording"
            ? <><div style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 1s linear infinite" }} /> Recording {exportState.progress}%</>
            : exportState.phase === "uploading"
            ? <><Upload size={13} /> Uploading {exportState.progress}%</>
            : exportState.phase === "done"
            ? <><Check size={13} /> Saved!</>
            : <><Upload size={13} /> Export &amp; Save</>
          }
        </button>

        {/* Progress bar */}
        {isExporting && (
          <div style={{ flex: 1, minWidth: 120, maxWidth: 240 }}>
            <div style={{ height: 4, background: "var(--border-default)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${exportState.progress}%`, background: "var(--accent-primary)", borderRadius: 3, transition: "width 0.3s" }} />
            </div>
          </div>
        )}

        {exportState.phase === "error" && exportState.error && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--danger)" }}>
            <AlertCircle size={13} /> {exportState.error}
          </div>
        )}

        {exportState.phase === "done" && (
          <span style={{ fontSize: 12, color: "var(--success)" }}>Video saved to your library below.</span>
        )}

        {clips.length === 0 && exportState.phase === "idle" && (
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Add clips to the timeline to export.</span>
        )}
      </div>

      {/* ── Hidden video elements (playback engine) ────────────────────────────── */}
      {/* IMPORTANT: must NOT use opacity:0 or overflow:hidden on a 1×1 container —
          Chrome skips compositing video frames in those cases, making drawImage return
          black pixels after any pause→play / seek transition.                        */}
      <div style={{ position: "fixed", left: -10000, top: 0, pointerEvents: "none", userSelect: "none" }}>
        {videoClips.map(clip => (
          <video
            key={clip.id}
            ref={el => {
              if (el) videoElsRef.current.set(clip.id, el);
              else    videoElsRef.current.delete(clip.id);
            }}
            src={clip.localUrl}
            muted
            preload="auto"
            playsInline
            style={{ width: 320, height: 240, display: "block" }}
          />
        ))}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
