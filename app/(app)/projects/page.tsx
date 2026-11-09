"use client";

import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { Plus, Search, FolderPlus, SearchX } from "lucide-react";
import { useAuth } from "@/lib/contexts/auth-context";
import { subscribeToProjects } from "@/lib/firebase/projects";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { CreateProjectDialog } from "@/components/dashboard/create-project-dialog";
import { ProjectRow } from "@/components/dashboard/project-row";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { LiquidButton } from "@/components/ui/liquid-button";
import { EmptyState } from "@/components/ui/empty-state";
import type { Project, ProjectStatus } from "@/lib/mock-data";

type Filter = "all" | ProjectStatus;
type Sort = "recent" | "name";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "in-draft", label: "In Draft" },
  { value: "testing", label: "Testing" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToProjects(user.uid, (data) => {
      setProjects(data);
      setLoading(false);
    });
    return () => { unsub(); };
  }, [user]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: projects.length, active: 0, "in-draft": 0, testing: 0, completed: 0, archived: 0 };
    for (const p of projects) c[p.status] += 1;
    return c;
  }, [projects]);

  const q = search.trim().toLowerCase();
  const visible = useMemo(() => {
    const list = projects.filter((p) => {
      if (filter !== "all" && p.status !== filter) return false;
      if (q) return p.name.toLowerCase().includes(q) || p.country.toLowerCase().includes(q);
      return true;
    });
    // "recent" keeps the Firestore order (createdAt desc)
    return sort === "name" ? [...list].sort((a, b) => a.name.localeCompare(b.name)) : list;
  }, [projects, filter, q, sort]);

  function resetFilters() {
    setFilter("all");
    setSearch("");
  }

  return (
    <div style={{ padding: "32px 16px 48px", display: "flex", flexDirection: "column", gap: 24 }}>
      <nav aria-label="Breadcrumb" className="crumbs" style={{ marginBottom: -12 }}>
        <Link href="/dashboard">Dashboard</Link>
      </nav>
      <header className="page-header" style={{ alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 className="page-title">Projects</h1>
          <span className="page-sub" style={{ fontSize: 14 }}>
            {projects.length} project{projects.length !== 1 ? "s" : ""} · open one to see its plan and creatives
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <NotificationBell />
          <LiquidButton icon={<Plus size={16} strokeWidth={2.4} />} onClick={() => setDialogOpen(true)}>
            New Project
          </LiquidButton>
        </div>
      </header>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <SegmentedControl
          ariaLabel="Filter projects by status"
          value={filter}
          onChange={setFilter}
          options={FILTERS.map((f) => ({ ...f, count: counts[f.value] }))}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <label className="glass search-glass" style={{ height: 42, width: 240, borderRadius: 21 }}>
            <Search size={16} strokeWidth={2} aria-hidden />
            <input
              type="search"
              placeholder="Search projects"
              aria-label="Search projects"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            className="glass sort-glass"
            aria-label="Sort projects"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
          >
            <option value="recent">Recent</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {loading ? (
          [1, 2, 3].map((i) => <div key={i} className="shimmer" style={{ height: 92, borderRadius: 24 }} />)
        ) : projects.length === 0 ? (
          <EmptyState
            icon={<FolderPlus size={24} />}
            title="No projects yet"
            description="Create your first project to generate a marketing plan and start producing creatives."
            action={<LiquidButton icon={<Plus size={16} />} onClick={() => setDialogOpen(true)}>Create project</LiquidButton>}
          />
        ) : (
          <>
            {visible.length === 0 ? (
              <EmptyState
                icon={<SearchX size={24} />}
                title={q ? `No matches for “${search.trim()}”` : `No ${FILTERS.find((f) => f.value === filter)?.label.toLowerCase()} projects`}
                description="Try another filter, or clear the search to see everything."
                action={<LiquidButton onClick={resetFilters}>Show all projects</LiquidButton>}
              />
            ) : (
              visible.map((p, i) => <ProjectRow key={p.id} project={p} uid={user?.uid ?? ""} delay={i * 30} />)
            )}
            <button type="button" className="dashed-row lift" onClick={() => setDialogOpen(true)}>
              <span className="glass-inner icon-chip" aria-hidden><Plus size={16} strokeWidth={2.2} /></span>
              Start a new product test
            </button>
          </>
        )}
      </div>

      <CreateProjectDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
