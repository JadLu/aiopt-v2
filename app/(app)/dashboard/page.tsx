"use client";

import Link from "next/link";
import { useState, useEffect, useMemo, useSyncExternalStore } from "react";
import { Plus, FolderOpen, FolderPlus, Globe, Zap, Search, Moon, Sun, SearchX } from "lucide-react";
import { useTheme } from "next-themes";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ProjectCard } from "@/components/dashboard/project-card";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { CreateProjectDialog } from "@/components/dashboard/create-project-dialog";
import { TopUpModal } from "@/components/credits/TopUpModal";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { LiquidButton } from "@/components/ui/liquid-button";
import { EmptyState } from "@/components/ui/empty-state";
import type { Project, ProjectStatus } from "@/lib/mock-data";
import { useAuth } from "@/lib/contexts/auth-context";
import { subscribeToProjects } from "@/lib/firebase/projects";
import { projectCountryCodes, countryName } from "@/lib/countries";

type Filter = "all" | ProjectStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "in-draft", label: "In Draft" },
  { value: "testing", label: "Testing" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

const MAX_MARKET_CHIPS = 3;

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

const subscribeNoop = () => () => {};

function ThemeButton() {
  const { resolvedTheme, setTheme } = useTheme();
  // false on the server / first render, true after hydration (avoids a theme-icon mismatch)
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  if (!mounted) return <div style={{ width: 44, height: 44 }} />;
  const dark = resolvedTheme === "dark";
  return (
    <button
      type="button"
      className="glass icon-glass"
      aria-label="Switch theme"
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Sun size={18} strokeWidth={1.8} /> : <Moon size={18} strokeWidth={1.8} />}
    </button>
  );
}

export default function DashboardPage() {
  const { user, credits, creditsLoading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToProjects(user.uid, (data) => {
      setProjects(data);
      setLoadingProjects(false);
    });
    return () => { unsub(); };
  }, [user]);

  const firstName = getFirstName(user?.displayName, user?.email);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: projects.length, active: 0, "in-draft": 0, testing: 0, completed: 0, archived: 0 };
    for (const p of projects) c[p.status] += 1;
    return c;
  }, [projects]);

  // Distinct markets across projects (multi-country projects count each country; legacy text is kept as-is).
  const markets = useMemo(() => {
    const names = new Set<string>();
    for (const p of projects) {
      const codes = projectCountryCodes(p);
      if (codes.length > 0) codes.forEach((code) => names.add(countryName(code)));
      else if (p.country) names.add(p.country);
    }
    return Array.from(names);
  }, [projects]);

  const q = search.trim().toLowerCase();
  const filtered = projects.filter((p) => {
    if (filter !== "all" && p.status !== filter) return false;
    if (q) return p.name.toLowerCase().includes(q) || p.country.toLowerCase().includes(q);
    return true;
  });

  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const creditsKnown = !creditsLoading && credits !== null;

  function resetFilters() {
    setFilter("all");
    setSearch("");
  }

  return (
    <div style={{ padding: "32px 16px 48px", display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Header */}
      <header className="page-header">
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="page-sub" suppressHydrationWarning>{today}</span>
          <h1 className="page-title" suppressHydrationWarning>
            {getGreeting()}{firstName ? `, ${firstName}` : ""}
          </h1>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          <label className="glass search-glass">
            <Search size={16} strokeWidth={2} aria-hidden />
            <input
              type="search"
              placeholder="Search projects…"
              aria-label="Search projects"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <NotificationBell />
          <ThemeButton />
          <LiquidButton icon={<Plus size={16} strokeWidth={2.4} />} onClick={() => setDialogOpen(true)}>
            New Project
          </LiquidButton>
        </div>
      </header>

      {/* KPIs */}
      <section aria-label="Overview" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        <KpiCard label="Projects" value={loadingProjects ? null : String(projects.length)} icon={FolderOpen}>
          {projects.length === 0 && !loadingProjects ? (
            <button type="button" className="stat-chip" onClick={() => setDialogOpen(true)}>
              <Plus size={12} aria-hidden /> Create your first project
            </button>
          ) : (
            <>
              <span className="stat-chip ok">{counts.active} active</span>
              <span className="stat-chip">{counts.archived} archived</span>
            </>
          )}
        </KpiCard>

        <KpiCard label="Markets" value={loadingProjects ? null : String(markets.length)} icon={Globe}>
          {markets.length === 0 ? (
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Pick target countries when you create a project</span>
          ) : (
            <>
              {markets.slice(0, MAX_MARKET_CHIPS).map((m) => <span key={m} className="stat-chip">{m}</span>)}
              {markets.length > MAX_MARKET_CHIPS && (
                <span className="stat-chip tabular">+{markets.length - MAX_MARKET_CHIPS}</span>
              )}
            </>
          )}
        </KpiCard>

        <KpiCard label="Credits" value={creditsKnown ? credits.toLocaleString() : null} icon={Zap}>
          <span style={{ fontSize: 12, color: "var(--text-secondary)", flex: 1 }}>Pro workspace</span>
          <button
            type="button"
            className="sidebar-link"
            style={{ minHeight: 40 }}
            onClick={() => setTopUpOpen(true)}
          >
            Top up
          </button>
        </KpiCard>
      </section>

      {/* Projects */}
      <section aria-label="Projects" style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2 className="section-title">Projects</h2>
              <span className="stat-chip tabular">{projects.length}</span>
              <Link href="/projects" className="sidebar-link">List view</Link>
            </div>
            <SegmentedControl
              ariaLabel="Filter projects by status"
              value={filter}
              onChange={setFilter}
              options={FILTERS.map((f) => ({ ...f, count: counts[f.value] }))}
            />
          </div>

          {loadingProjects ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 18 }}>
              {[1, 2].map((i) => <div key={i} className="shimmer" style={{ height: 360, borderRadius: "var(--r-card-lg)" }} />)}
            </div>
          ) : projects.length === 0 ? (
            <EmptyState
              icon={<FolderPlus size={24} />}
              title="No projects yet"
              description="Create your first project to generate a marketing plan and start producing creatives."
              action={<LiquidButton icon={<Plus size={16} />} onClick={() => setDialogOpen(true)}>Create project</LiquidButton>}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<SearchX size={24} />}
              title={q ? `No matches for “${search.trim()}”` : `No ${FILTERS.find((f) => f.value === filter)?.label.toLowerCase()} projects`}
              description="Try another filter, or clear the search to see everything."
              action={<LiquidButton onClick={resetFilters}>Show all projects</LiquidButton>}
            />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 18 }}>
              {filtered.map((project, idx) => (
                <ProjectCard key={project.id} project={project} uid={user?.uid ?? ""} delay={idx * 40} />
              ))}
            </div>
          )}
      </section>

      <CreateProjectDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      <TopUpModal open={topUpOpen} onClose={() => setTopUpOpen(false)} balance={credits} />
    </div>
  );
}
