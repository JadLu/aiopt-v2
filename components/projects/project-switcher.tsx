"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ChevronsUpDown, Check, Image as ImageIcon, FolderKanban, Search } from "lucide-react";
import { subscribeToProjects } from "@/lib/firebase/projects";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Project } from "@/lib/mock-data";

const SEARCH_THRESHOLD = 6;

/** "Switch project" button: a glass popover listing the user's projects, so they can jump between them. */
export function ProjectSwitcher({ uid, currentId }: { uid: string; currentId: string }) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const [opened, setOpened] = useState(false); // subscribe on first open, keep afterwards
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [q, setQ] = useState("");
  const btnRef = useRef<HTMLButtonElement>(null);
  const open = pos !== null;

  useEffect(() => {
    if (!opened) return;
    return subscribeToProjects(uid, setProjects);
  }, [opened, uid]);

  useEffect(() => {
    if (!open) return;
    const close = () => setPos(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setPos(null); btnRef.current?.focus(); }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close); // page scroll only: element scroll doesn't bubble
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (projects ?? []).filter((p) => !term || p.name.toLowerCase().includes(term));
  }, [projects, q]);

  const showSearch = (projects?.length ?? 0) > SEARCH_THRESHOLD;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="glass switch-btn"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(e) => {
          if (open) { setPos(null); return; }
          const rect = e.currentTarget.getBoundingClientRect();
          setQ("");
          setOpened(true);
          setPos({ top: rect.bottom + 8, right: Math.max(12, window.innerWidth - rect.right) });
        }}
      >
        <ChevronsUpDown size={16} strokeWidth={2} aria-hidden />
        <span className="switch-btn-label">Switch project</span>
      </button>

      {pos && createPortal(
        <div
          role="dialog"
          aria-label="Switch project"
          className="glass switch-pop"
          onMouseDown={(e) => e.stopPropagation()}
          style={{ top: pos.top, right: pos.right }}
        >
          {showSearch && (
            <label className="glass-inner switch-search">
              <Search size={15} strokeWidth={2} aria-hidden />
              <input
                type="search"
                autoFocus
                placeholder="Search projects…"
                aria-label="Search projects"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
          )}

          <ul className="switch-list">
            {projects === null && [1, 2, 3].map((n) => <li key={n}><div className="shimmer" style={{ height: 52, borderRadius: 16 }} /></li>)}
            {projects !== null && filtered.length === 0 && (
              <li style={{ padding: "14px 12px", fontSize: 13, color: "var(--text-secondary)" }}>
                {q ? `No project matches “${q.trim()}”.` : "No projects yet."}
              </li>
            )}
            {filtered.map((p) => {
              const current = p.id === currentId;
              return (
                <li key={p.id}>
                  <Link
                    href={`/projects/${p.id}`}
                    className="switch-item"
                    aria-current={current ? "page" : undefined}
                    onClick={() => setPos(null)}
                  >
                    <span className="row-thumb" style={{ width: 40, height: 40, borderRadius: 12 }}>
                      {p.productImageUrl
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={p.productImageUrl} alt="" />
                        : <ImageIcon size={18} strokeWidth={1.5} aria-hidden />}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                      <span dir="auto" className="switch-name">{p.name}</span>
                      <StatusBadge status={p.status} />
                    </span>
                    {current && <Check size={16} strokeWidth={2.4} style={{ color: "var(--accent-primary)", flex: "none" }} aria-label="Current project" />}
                  </Link>
                </li>
              );
            })}
          </ul>

          <Link href="/projects" className="switch-foot" onClick={() => setPos(null)}>
            <FolderKanban size={15} strokeWidth={1.9} aria-hidden /> All projects
          </Link>
        </div>,
        document.body
      )}
    </>
  );
}
