"use client";

import { Sparkles, Palette, MessageSquare } from "lucide-react";
import type { ContentData } from "@/lib/mock-data";

interface ContentVisualProps {
  data: ContentData | null | undefined;
  onRegenerate: () => void;
}

function Bar({ pct, color = "var(--accent-primary)", height = 8 }: { pct: number; color?: string; height?: number }) {
  return (
    <div style={{ background: "var(--bg-subtle)", borderRadius: 99, overflow: "hidden", height }}>
      <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.4s ease" }} />
    </div>
  );
}

const PILLAR_COLORS = ["var(--accent-primary)", "var(--accent-secondary)", "#C084FC", "var(--warning)", "var(--success)"];

export function ContentVisual({ data, onRegenerate }: ContentVisualProps) {
  if (!data) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "48px 24px", textAlign: "center" }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "color-mix(in srgb, #C084FC 12%, transparent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Palette size={20} color="#C084FC" strokeWidth={1.6} />
        </div>
        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", margin: 0 }}>No visual data yet</p>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>Regenerate the plan to get the graphical content strategy.</p>
        <button className="btn-primary" style={{ width: "auto", marginTop: 4, padding: "8px 20px", fontSize: 13 }} onClick={onRegenerate}>
          <Sparkles size={13} /> Regenerate Plan
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Tone */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", background: "color-mix(in srgb, #C084FC 8%, transparent)", border: "1px solid color-mix(in srgb, #C084FC 20%, transparent)", borderRadius: 12 }}>
        <MessageSquare size={15} color="#C084FC" strokeWidth={1.8} />
        <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500 }}>Brand Tone</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginLeft: 4 }}>{data.tone}</span>
      </div>

      {/* Two-column: pillars + formats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Content Pillars */}
        <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14 }}>Content Pillars</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {data.pillars.map(({ name, pct, description }, i) => (
              <div key={name}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{name}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: PILLAR_COLORS[i % PILLAR_COLORS.length] }}>{pct}%</span>
                </div>
                <Bar pct={pct} color={PILLAR_COLORS[i % PILLAR_COLORS.length]} />
                {description && (
                  <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: "5px 0 0", lineHeight: 1.5 }}>{description}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Format Priority */}
        <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14 }}>Format Priority</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[...data.formats].sort((a, b) => b.score - a.score).map(({ type, platforms, frequency, score }) => (
              <div key={type}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", flex: 1, marginRight: 8 }}>{type}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-secondary)", flexShrink: 0 }}>{score}</span>
                </div>
                <Bar pct={score} color="var(--accent-secondary)" />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
                  {platforms.map((p) => (
                    <span key={p} style={{ fontSize: 10, color: "var(--text-tertiary)", background: "var(--bg-subtle)", border: "1px solid var(--border-default)", borderRadius: 5, padding: "1px 6px" }}>{p}</span>
                  ))}
                  <span style={{ fontSize: 10, color: "var(--text-tertiary)", marginLeft: "auto" }}>{frequency}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hook templates */}
      {data.hooks.length > 0 && (
        <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>Hook Templates</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.hooks.map((hook, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", background: "var(--bg-subtle)", borderRadius: 9 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#C084FC", flexShrink: 0, marginTop: 1 }}>#{i + 1}</span>
                <span style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>{hook}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
