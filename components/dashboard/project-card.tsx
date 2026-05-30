"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Clock, Sparkles } from "lucide-react";
import type { Project } from "@/lib/mock-data";
import { GeneratePlanDialog } from "./generate-plan-dialog";

function healthColor(score: number): "red" | "yellow" | "green" {
  if (score <= 40) return "red";
  if (score <= 70) return "yellow";
  return "green";
}

const STATUS_LABELS: Record<string, string> = {
  "active": "Active", "in-draft": "In Draft", "testing": "Testing",
  "scaling": "Scaling", "completed": "Completed", "archived": "Archived",
};

export function ProjectCard({ project, uid }: { project: Project; uid: string }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);

  const isDraft = project.status === "in-draft";
  const hasMetrics = project.spend > 0;
  const color = healthColor(project.healthIndex);

  return (
    <>
      <div
        className="card project-card"
        style={{ cursor: "pointer" }}
        onClick={() => router.push(`/projects/${project.id}`)}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
          <div className="project-img">
            <span style={{ fontSize: 22 }}>{project.emoji}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {project.name}
              </h3>
              <span className={`status-badge ${project.status}`}>{STATUS_LABELS[project.status]}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-tertiary)", fontSize: 12 }}>
              <MapPin size={11} strokeWidth={1.8} />
              <span>{project.country}</span>
            </div>
          </div>
        </div>

        {/* Health bar — only when there's real campaign data */}
        {hasMetrics && project.healthIndex > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500 }}>Campaign Health</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: color === "green" ? "var(--success)" : color === "yellow" ? "var(--warning)" : "var(--danger)" }}>
                {project.healthIndex}
              </span>
            </div>
            <div className="health-bar-track">
              <div className={`health-bar-fill ${color}`} style={{ width: `${project.healthIndex}%` }} />
            </div>
          </div>
        )}

        {/* Bottom section: metrics, generate button, or plan-ready state */}
        <div style={{ borderTop: "1px solid var(--border-default)", paddingTop: 12 }}>
          {hasMetrics ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0 }}>
              {[
                { label: "CPA", value: `$${project.cpa.toFixed(2)}` },
                { label: "ROAS", value: `${project.roas.toFixed(1)}x` },
                { label: "Spend", value: `$${(project.spend / 1000).toFixed(1)}k` },
              ].map(({ label, value }) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{value}</div>
                </div>
              ))}
            </div>
          ) : isDraft ? (
            <button
              onClick={(e) => { e.stopPropagation(); setDialogOpen(true); }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                width: "100%", background: "none", border: "none", cursor: "pointer",
                fontSize: 12, color: "var(--accent-primary)", fontWeight: 500,
                padding: "2px 0", fontFamily: "inherit",
              }}
            >
              <Sparkles size={12} strokeWidth={2} />
              Generate marketing plan to start
            </button>
          ) : (
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", textAlign: "center" }}>
              Plan ready — campaigns starting
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 12, color: "var(--text-tertiary)", fontSize: 11 }}>
          <Clock size={11} strokeWidth={1.8} />
          <span>{project.lastActivity}</span>
        </div>
      </div>

      <GeneratePlanDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        uid={uid}
        project={project}
      />
    </>
  );
}
