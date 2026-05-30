"use client";

import { useState, useEffect } from "react";
import { ChevronDown, FolderOpen, ArrowRight, Sparkles, MapPin } from "lucide-react";
import { useAuth } from "@/lib/contexts/auth-context";
import { subscribeToProjects } from "@/lib/firebase/projects";
import { useRouter } from "next/navigation";
import { CreativeStudio } from "@/components/projects/creative-studio";
import type { Project } from "@/lib/mock-data";

export default function CreativePage() {
  const { user }   = useAuth();
  const router     = useRouter();

  const [projects, setProjects]         = useState<Project[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToProjects(user.uid, (data) => {
      setProjects(data);
      setLoading(false);
      setSelectedId(prev => {
        if (prev && data.find(p => p.id === prev)) return prev;
        return data.find(p => p.marketingPlan)?.id ?? data[0]?.id ?? null;
      });
    });
    return unsub;
  }, [user]);

  const selected = projects.find(p => p.id === selectedId) ?? null;

  return (
    <>
      <header className="app-topbar">
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Creative Studio</h1>
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "1px 0 0" }}>
            AI-generated ad creatives from your marketing plan
          </p>
        </div>

        {projects.length > 0 && (
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "var(--bg-elevated)", border: "1px solid var(--border-default)",
                borderRadius: 10, padding: "8px 14px", cursor: "pointer",
                fontSize: 13, fontWeight: 500, color: "var(--text-primary)",
                fontFamily: "inherit", minWidth: 200,
              }}
            >
              {selected
                ? <><span>{selected.emoji}</span><span style={{ flex: 1, textAlign: "left" }}>{selected.name}</span></>
                : <span style={{ flex: 1, color: "var(--text-tertiary)" }}>Select a project</span>
              }
              <ChevronDown size={14} color="var(--text-tertiary)" style={{ transform: dropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }} />
            </button>

            {dropdownOpen && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setDropdownOpen(false)} />
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50,
                  background: "var(--bg-elevated)", border: "1px solid var(--border-default)",
                  borderRadius: 10, overflow: "hidden", minWidth: 240,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.16)",
                }}>
                  {projects.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedId(p.id); setDropdownOpen(false); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 14px",
                        background: p.id === selectedId ? "rgba(90,200,214,0.07)" : "transparent",
                        border: "none", cursor: "pointer", fontFamily: "inherit",
                        fontSize: 13, color: p.id === selectedId ? "var(--accent-primary)" : "var(--text-primary)",
                        fontWeight: p.id === selectedId ? 600 : 400, textAlign: "left",
                      }}
                    >
                      <span>{p.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 1 }}>
                          {p.marketingPlan ? "Plan ready" : "No plan yet"}
                        </div>
                      </div>
                      {p.marketingPlan && (
                        <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "var(--accent-primary)", background: "rgba(90,200,214,0.10)", padding: "1px 6px", borderRadius: 10 }}>
                          <MapPin size={8} /> {p.country}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </header>

      <div className="app-content fade-up">
        {loading ? (
          <div style={{ display: "grid", gap: 16 }}>
            {[1, 2, 3].map(i => <div key={i} className="card" style={{ height: 120, opacity: 0.4 }} />)}
          </div>

        ) : projects.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-icon"><FolderOpen size={24} strokeWidth={1.4} color="var(--text-tertiary)" /></div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", margin: 0 }}>No projects yet</p>
              <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>Create a project first to generate creatives.</p>
              <button className="btn-primary" style={{ width: "auto", marginTop: 8, padding: "9px 20px", fontSize: 13 }} onClick={() => router.push("/dashboard")}>
                <ArrowRight size={14} /> Go to Dashboard
              </button>
            </div>
          </div>

        ) : !selected?.marketingPlan ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-icon"><Sparkles size={24} strokeWidth={1.4} color="var(--text-tertiary)" /></div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", margin: 0 }}>
                Marketing plan required
              </p>
              <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>
                Generate a marketing plan for {selected?.emoji} {selected?.name} first — creatives are built from the audience & creative strategy in your plan.
              </p>
              {selected && (
                <button className="btn-primary" style={{ width: "auto", marginTop: 8, padding: "9px 20px", fontSize: 13 }} onClick={() => router.push(`/projects/${selected.id}`)}>
                  <ArrowRight size={14} /> Open Project
                </button>
              )}
            </div>
          </div>

        ) : user && selected ? (
          <CreativeStudio project={selected} uid={user.uid} />
        ) : null}
      </div>
    </>
  );
}
