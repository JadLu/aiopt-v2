"use client";

import { useState, useEffect } from "react";
import { Plus, FolderOpen, DollarSign, Activity, BarChart3, Bell, Search, Moon, Sun, TrendingUp } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ProjectCard } from "@/components/dashboard/project-card";
import { AlertsFeed } from "@/components/dashboard/alerts-feed";
import { StatusFilter } from "@/components/dashboard/status-filter";
import { CreateProjectDialog } from "@/components/dashboard/create-project-dialog";
import { type ProjectStatus } from "@/lib/mock-data";
import type { Project } from "@/lib/mock-data";
import { useAuth } from "@/lib/contexts/auth-context";
import { subscribeToProjects } from "@/lib/firebase/projects";
import { subscribeToAdAlerts, type AdAlert } from "@/lib/firebase/ad-alerts";
import { useTheme } from "next-themes";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getFirstName(name: string | null | undefined, email: string | null | undefined): string {
  if (name) return name.split(" ")[0];
  if (email) return email.split("@")[0];
  return "";
}

function ThemeIconBtn() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div style={{ width: 38, height: 38 }} />;
  return (
    <button
      className="icon-btn"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      {resolvedTheme === "dark"
        ? <Sun size={16} strokeWidth={1.8} />
        : <Moon size={16} strokeWidth={1.8} />}
    </button>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [adAlerts, setAdAlerts] = useState<AdAlert[]>([]);
  const [filter, setFilter] = useState<"all" | ProjectStatus>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    const unsubProjects = subscribeToProjects(user.uid, (data) => {
      setProjects(data);
      setLoadingProjects(false);
    });
    const unsubAlerts = subscribeToAdAlerts(user.uid, setAdAlerts);
    return () => { unsubProjects(); unsubAlerts(); };
  }, [user]);

  const firstName = getFirstName(user?.displayName, user?.email);

  const filtered = projects.filter((p) => {
    if (filter !== "all" && p.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.country.toLowerCase().includes(q);
    }
    return true;
  });

  // KPI computations — all derived from live Firestore data
  const cumulativeSpend = projects.reduce((sum, p) => sum + p.spend, 0);

  const roasProjects = projects.filter((p) => p.roas > 0);
  const avgRoas = roasProjects.length > 0
    ? roasProjects.reduce((sum, p) => sum + p.roas, 0) / roasProjects.length
    : 0;

  // Projects created since start of the current calendar month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const projectsThisMonth = projects.filter(
    (p) => new Date(p.createdAt) >= startOfMonth
  ).length;

  // Avg health index across non-draft projects that have a health score
  const scoredProjects = projects.filter((p) => p.healthIndex > 0);
  const avgHealth = scoredProjects.length > 0
    ? Math.round(scoredProjects.reduce((sum, p) => sum + p.healthIndex, 0) / scoredProjects.length)
    : 0;

  const criticalAlertCount = adAlerts.filter((a) => a.tier === "red").length;

  return (
    <>
      {/* Topbar */}
      <header className="app-topbar">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.5px", lineHeight: 1.1 }}>
            {getGreeting()}{firstName ? `, ${firstName}` : ""}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0, marginTop: 2 }}>
            Here&apos;s your overview for today
          </p>
        </div>

        <div className="topbar-actions">
          {/* Search */}
          <label className="search-pill">
            <Search size={14} strokeWidth={1.8} style={{ flexShrink: 0 }} />
            <input
              placeholder="Search projects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>

          {/* Notifications */}
          <button className="icon-btn" aria-label="Notifications">
            <Bell size={16} strokeWidth={1.8} />
            {criticalAlertCount > 0 && <span className="dot" />}
          </button>

          {/* Theme */}
          <ThemeIconBtn />

          {/* New Project */}
          <button
            className="btn-primary"
            style={{ width: "auto", padding: "9px 18px", fontSize: 13, flexShrink: 0 }}
            onClick={() => setDialogOpen(true)}
          >
            <Plus size={14} strokeWidth={2.2} />
            New Project
          </button>
        </div>
      </header>

      {/* Page content */}
      <div className="app-content">

        {/* KPI Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
          <KpiCard
            label="Total Projects"
            value={String(projects.length)}
            sub="across all statuses"
            trend={projectsThisMonth > 0 ? { direction: "up", label: `+${projectsThisMonth} this month` } : undefined}
            icon={FolderOpen}
            gradientFrom="#5AC8D6"
            gradientTo="#6FB1E8"
            delay={0}
          />
          <KpiCard
            label="Avg Health Index"
            value={avgHealth > 0 ? `${avgHealth}` : "—"}
            sub={scoredProjects.length > 0 ? `across ${scoredProjects.length} active project${scoredProjects.length > 1 ? "s" : ""}` : "no active projects yet"}
            icon={Activity}
            gradientFrom="#6FB1E8"
            gradientTo="#9B8FE8"
            delay={60}
          />
          <KpiCard
            label="Cumulative Spend"
            value={cumulativeSpend > 0 ? `$${(cumulativeSpend / 1000).toFixed(1)}k` : "—"}
            sub="across all projects"
            icon={DollarSign}
            gradientFrom="#34C759"
            gradientTo="#30D158"
            delay={120}
          />
          <KpiCard
            label="Avg ROAS"
            value={avgRoas > 0 ? `${avgRoas.toFixed(1)}x` : "—"}
            sub={roasProjects.length > 0 ? `across ${roasProjects.length} project${roasProjects.length > 1 ? "s" : ""}` : "no ROAS data yet"}
            icon={TrendingUp}
            gradientFrom="#FF9F0A"
            gradientTo="#FFB340"
            delay={180}
          />
        </div>

        {/* Main grid: Projects + Alerts */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, alignItems: "start" }}>

          {/* Left: Projects */}
          <div>
            {/* Section head */}
            <div className="section-head">
              <BarChart3 size={16} strokeWidth={1.8} color="var(--text-secondary)" />
              <h2>Projects</h2>
              <span className="count-pill">{projects.length}</span>
              <div style={{ marginLeft: "auto" }}>
                <StatusFilter active={filter} onChange={setFilter} />
              </div>
            </div>

            {/* Project grid */}
            {loadingProjects ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 14 }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="glass-card" style={{ height: 190, opacity: 0.35 }} />
                ))}
              </div>
            ) : filtered.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 14 }}>
                {filtered.map((project, idx) => (
                  <ProjectCard key={project.id} project={project} uid={user?.uid ?? ""} delay={idx * 40} />
                ))}
              </div>
            ) : (
              <div className="glass-card">
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
            <AlertsFeed alerts={adAlerts} />
          </div>
        </div>
      </div>

      <CreateProjectDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  );
}
