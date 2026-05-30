"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, FolderOpen, FolderKanban, MapPin, Clock, Target, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/contexts/auth-context";
import { subscribeToProjects } from "@/lib/firebase/projects";
import { CreateProjectDialog } from "@/components/dashboard/create-project-dialog";
import { StatusFilter } from "@/components/dashboard/status-filter";
import type { Project, ProjectStatus } from "@/lib/mock-data";

const STATUS_LABELS: Record<string, string> = {
  "active": "Active", "in-draft": "In Draft", "testing": "Testing",
  "scaling": "Scaling", "completed": "Completed", "archived": "Archived",
};

function healthColor(score: number) {
  if (score <= 40) return "var(--danger)";
  if (score <= 70) return "var(--warning)";
  return "var(--success)";
}

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | ProjectStatus>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToProjects(user.uid, (data) => {
      setProjects(data);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const filtered = filter === "all" ? projects : projects.filter((p) => p.status === filter);

  return (
    <>
      <header className="app-topbar">
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Projects</h1>
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0, marginTop: 1 }}>
            {projects.length} project{projects.length !== 1 ? "s" : ""} — click to view details &amp; creatives
          </p>
        </div>
        <button
          className="btn-primary"
          style={{ width: "auto", padding: "9px 18px", fontSize: 13 }}
          onClick={() => setDialogOpen(true)}
        >
          <Plus size={15} />
          New Project
        </button>
      </header>

      <div className="app-content fade-up">
        <div style={{ marginBottom: 16 }}>
          <StatusFilter active={filter} onChange={setFilter} />
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="card" style={{ height: 88, opacity: 0.4, background: "var(--bg-elevated)" }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-icon"><FolderOpen size={22} strokeWidth={1.5} color="var(--text-tertiary)" /></div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", margin: 0 }}>No projects here</p>
              <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>
                {filter === "all" ? "Create your first project to get started." : `No projects with status "${filter}".`}
              </p>
              {filter === "all" && (
                <button className="btn-primary" style={{ width: "auto", marginTop: 8, padding: "9px 20px", fontSize: 13 }} onClick={() => setDialogOpen(true)}>
                  <Plus size={14} /> New Project
                </button>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`} style={{ textDecoration: "none" }}>
                <div
                  className="card project-row"
                  style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 18px", cursor: "pointer" }}
                >
                  {/* Emoji */}
                  <div className="project-img" style={{ flexShrink: 0 }}>
                    <span style={{ fontSize: 20 }}>{project.emoji}</span>
                  </div>

                  {/* Name + meta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {project.name}
                      </span>
                      <span className={`status-badge ${project.status}`}>{STATUS_LABELS[project.status]}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--text-tertiary)", fontSize: 12 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <MapPin size={11} strokeWidth={1.8} />{project.country}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Clock size={11} strokeWidth={1.8} />{project.lastActivity}
                      </span>
                    </div>
                  </div>

                  {/* Targets */}
                  <div style={{ display: "flex", gap: 20, flexShrink: 0 }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 2, display: "flex", alignItems: "center", gap: 3 }}>
                        <Target size={10} />Target CPA
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                        ${project.targetCpa.toFixed(0)}
                      </div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 2, display: "flex", alignItems: "center", gap: 3 }}>
                        <Target size={10} />Target ROAS
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                        {project.targetRoas.toFixed(1)}x
                      </div>
                    </div>
                    {project.status !== "in-draft" && (
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 2 }}>Health</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: healthColor(project.healthIndex) }}>
                          {project.healthIndex}
                        </div>
                      </div>
                    )}
                  </div>

                  <ChevronRight size={16} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <CreateProjectDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  );
}
