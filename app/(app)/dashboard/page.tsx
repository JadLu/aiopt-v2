"use client";

import { useState, useEffect } from "react";
import { Plus, FolderOpen, DollarSign, Clock, BarChart3 } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ProjectCard } from "@/components/dashboard/project-card";
import { AlertsFeed } from "@/components/dashboard/alerts-feed";
import { StatusFilter } from "@/components/dashboard/status-filter";
import { CreateProjectDialog } from "@/components/dashboard/create-project-dialog";
import { MOCK_ALERTS, MOCK_STATS, type ProjectStatus } from "@/lib/mock-data";
import type { Project } from "@/lib/mock-data";
import { useAuth } from "@/lib/contexts/auth-context";
import { subscribeToProjects } from "@/lib/firebase/projects";

export default function DashboardPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [filter, setFilter] = useState<"all" | ProjectStatus>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToProjects(user.uid, (data) => {
      setProjects(data);
      setLoadingProjects(false);
    });
    return unsub;
  }, [user]);

  const filtered = filter === "all"
    ? projects
    : projects.filter((p) => p.status === filter);

  const cumulativeSpend = projects.reduce((sum, p) => sum + p.spend, 0);

  return (
    <>
      {/* Top bar */}
      <header className="app-topbar">
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Dashboard</h1>
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0, marginTop: 1 }}>
            Welcome back — here&apos;s your overview
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

      {/* Page content */}
      <div className="app-content fade-up">

        {/* KPI Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
          <KpiCard
            label="Total Projects"
            value={String(projects.length || MOCK_STATS.totalProjects)}
            sub="across all statuses"
            trend={{ direction: "up", label: "+2 this month" }}
            icon={FolderOpen}
            accentColor="var(--accent-primary)"
          />
          <KpiCard
            label="Avg Time-to-Test"
            value={MOCK_STATS.avgTimeToTest}
            sub="from idea to first ad"
            trend={{ direction: "down", label: "-0.8 hrs vs last month" }}
            icon={Clock}
            accentColor="var(--accent-secondary)"
          />
          <KpiCard
            label="Cumulative Ad Spend"
            value={`$${((cumulativeSpend || MOCK_STATS.cumulativeSpend) / 1000).toFixed(1)}k`}
            sub="across all campaigns"
            trend={{ direction: "up", label: "+$4.2k this week" }}
            icon={DollarSign}
            accentColor="var(--success)"
          />
        </div>

        {/* Main grid: Projects + Alerts */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, alignItems: "start" }}>

          {/* Left: Projects */}
          <div>
            <div className="section-header">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <BarChart3 size={15} strokeWidth={1.8} color="var(--text-secondary)" />
                <span className="section-title">Projects</span>
                <span style={{ fontSize: 12, color: "var(--text-tertiary)", background: "var(--bg-subtle)", padding: "2px 8px", borderRadius: 20 }}>
                  {projects.length}
                </span>
              </div>
            </div>

            {/* Status filter */}
            <div style={{ marginBottom: 16 }}>
              <StatusFilter active={filter} onChange={setFilter} />
            </div>

            {/* Project grid */}
            {loadingProjects ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="card" style={{ height: 180, opacity: 0.4, background: "var(--bg-elevated)" }} />
                ))}
              </div>
            ) : filtered.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
                {filtered.map((project) => (
                  <ProjectCard key={project.id} project={project} uid={user?.uid ?? ""} />
                ))}
              </div>
            ) : (
              <div className="card">
                <div className="empty-state">
                  <div className="empty-icon">
                    <FolderOpen size={22} strokeWidth={1.5} color="var(--text-tertiary)" />
                  </div>
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
            )}
          </div>

          {/* Right: Alerts */}
          <div style={{ position: "sticky", top: 84 }}>
            <AlertsFeed alerts={MOCK_ALERTS} />
          </div>
        </div>
      </div>

      {/* Create project dialog */}
      <CreateProjectDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  );
}
