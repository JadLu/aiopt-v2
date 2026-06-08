"use client";

import { Sparkles, Play, Layers, Image, Film, FileText, Monitor } from "lucide-react";
import type { ContentData } from "@/lib/mock-data";

interface ContentVisualProps {
  data: ContentData | null | undefined;
  onRegenerate: () => void;
}

function getPriorityStyle(score: number): { label: string; color: string } {
  if (score >= 90) return { label: "Priority", color: "var(--danger)" };
  if (score >= 65) return { label: "High",     color: "var(--warning)" };
  if (score >= 40) return { label: "Med",      color: "var(--accent-secondary)" };
  return               { label: "Low",      color: "var(--text-tertiary)" };
}

function getFormatIcon(type: string) {
  const t = type.toLowerCase();
  if (t.includes("video") || t.includes("reel") || t.includes("ugc") || t.includes("hook"))
    return <Play size={14} strokeWidth={1.9} />;
  if (t.includes("carousel") || t.includes("slide"))
    return <Layers size={14} strokeWidth={1.9} />;
  if (t.includes("static") || t.includes("image") || t.includes("photo"))
    return <Image size={14} strokeWidth={1.9} />;
  if (t.includes("story") || t.includes("stories"))
    return <Film size={14} strokeWidth={1.9} />;
  if (t.includes("landing") || t.includes("page"))
    return <Monitor size={14} strokeWidth={1.9} />;
  return <FileText size={14} strokeWidth={1.9} />;
}

const CHIP_COLORS = [
  "var(--accent-primary)",
  "var(--accent-secondary)",
  "#C084FC",
  "var(--warning)",
  "var(--success)",
];

export function ContentVisual({ data, onRegenerate }: ContentVisualProps) {
  if (!data) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "28px 16px", textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>Regenerate the plan to get the content strategy.</p>
        <button className="btn-primary" style={{ width: "auto", padding: "7px 18px", fontSize: 12 }} onClick={onRegenerate}>
          <Sparkles size={12} /> Regenerate Plan
        </button>
      </div>
    );
  }

  const sortedFormats = [...data.formats].sort((a, b) => b.score - a.score);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* Pillar chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {data.pillars.map(({ name }, i) => (
          <span
            key={name}
            style={{
              padding: "5px 12px",
              borderRadius: 999,
              fontSize: 12.5,
              fontWeight: 600,
              background: `color-mix(in srgb, ${CHIP_COLORS[i % CHIP_COLORS.length]} 12%, transparent)`,
              color: CHIP_COLORS[i % CHIP_COLORS.length],
              border: `1px solid color-mix(in srgb, ${CHIP_COLORS[i % CHIP_COLORS.length]} 22%, transparent)`,
            }}
          >
            {name}
          </span>
        ))}
      </div>

      {/* Format rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sortedFormats.map(({ type, platforms, score }) => {
          const { label, color } = getPriorityStyle(score);
          return (
            <div
              key={type}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 12px",
                background: "var(--chip)", borderRadius: 10,
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: `color-mix(in srgb, var(--accent-secondary) 14%, transparent)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--accent-secondary)",
              }}>
                {getFormatIcon(type)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{type}</div>
                {platforms.length > 0 && (
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                    {platforms.slice(0, 3).join(" · ")}
                  </div>
                )}
              </div>
              <span style={{
                fontSize: 11, fontWeight: 600, color,
                background: `color-mix(in srgb, ${color} 14%, transparent)`,
                padding: "3px 9px", borderRadius: 999, flexShrink: 0,
              }}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
