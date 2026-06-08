"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FolderKanban, Palette,
  Megaphone, Settings, ChevronLeft, ChevronRight, Bell, Zap
} from "lucide-react";
import { useAuth } from "@/lib/contexts/auth-context";
import { MOCK_ALERTS } from "@/lib/mock-data";

const NAV_GROUPS = [
  {
    label: "Workspace",
    items: [
      { label: "Dashboard",      href: "/dashboard",   icon: LayoutDashboard },
      { label: "Projects",       href: "/projects",    icon: FolderKanban },
      { label: "Creative Studio",href: "/creative",    icon: Palette },
      { label: "Advertising",    href: "/advertising", icon: Megaphone },
      { label: "Alerts",         href: "/advertising", icon: Bell, badgeKey: "alerts" as const },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  if (name) return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  if (email) return email[0].toUpperCase();
  return "U";
}

function getFirstName(name: string | null | undefined, email: string | null | undefined): string {
  if (name) return name.split(" ")[0];
  if (email) return email.split("@")[0];
  return "User";
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { user, credits, creditsLoading } = useAuth();

  const initials = getInitials(user?.displayName, user?.email);
  const firstName = getFirstName(user?.displayName, user?.email);
  const alertCount = MOCK_ALERTS.filter((a) => a.tier === "red").length;

  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      {/* Brand */}
      <div style={{
        padding: collapsed ? "20px 14px 16px" : "20px 18px 16px",
        display: "flex", alignItems: "center", gap: 10,
        borderBottom: "1px solid var(--hairline)",
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
          background: "linear-gradient(135deg, #5AC8D6 0%, #6FB1E8 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 6px 16px rgba(90,200,214,.40)",
          fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px",
        }}>
          A
        </div>
        {!collapsed && (
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1, letterSpacing: "-0.4px" }}>AIOPT</div>
            <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginTop: 2 }}>E-commerce Suite</div>
          </div>
        )}
      </div>

      {/* Nav groups */}
      <nav style={{ flex: 1, padding: "14px 10px", display: "flex", flexDirection: "column", gap: 18, overflowY: "auto" }}>
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: ".7px", textTransform: "uppercase", padding: "0 10px", marginBottom: 6 }}>
                {group.label}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {group.items.map(({ label, href, icon: Icon, badgeKey }) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                const badge = badgeKey === "alerts" ? alertCount : 0;
                return (
                  <Link
                    key={label}
                    href={href}
                    className={`sidebar-nav-item${active ? " active" : ""}`}
                    title={collapsed ? label : undefined}
                    style={{ justifyContent: "space-between" }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Icon size={18} strokeWidth={active ? 2.1 : 1.8} style={{ flexShrink: 0 }} />
                      <span className="nav-label">{label}</span>
                    </span>
                    {badge > 0 && !collapsed && (
                      <span style={{
                        minWidth: 18, height: 18, padding: "0 5px",
                        borderRadius: 999, background: "var(--danger)",
                        color: "#fff", fontSize: 10.5, fontWeight: 700,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        lineHeight: 1,
                      }}>
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User card */}
      <div style={{ padding: "10px 10px 18px", borderTop: "1px solid var(--hairline)" }}>
        {!collapsed && (
          <div className="user-card" style={{ alignItems: "center" }}>
            <div className="user-avatar" style={{ flexShrink: 0 }}>{initials}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="user-name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{firstName}</div>
              <div className="user-plan">Pro · workspace</div>
            </div>
            {/* Credits chip — inline with user card */}
            {!creditsLoading && credits !== null && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  padding: "3px 7px",
                  borderRadius: "var(--r-input)",
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--border-default)",
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                }}
              >
                <Zap
                  size={11}
                  style={{
                    flexShrink: 0,
                    color: credits < 10
                      ? "var(--danger)"
                      : credits < 50
                      ? "var(--warning)"
                      : "var(--accent-primary)",
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: credits < 10
                      ? "var(--danger)"
                      : credits < 50
                      ? "var(--warning)"
                      : "var(--accent-primary)",
                  }}
                >
                  {credits.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        )}
        {/* Collapsed: avatar + small credits badge stacked */}
        {collapsed && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div className="user-avatar">{initials}</div>
            {!creditsLoading && credits !== null && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  padding: "2px 5px",
                  borderRadius: "var(--r-input)",
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--border-default)",
                }}
              >
                <Zap
                  size={10}
                  style={{
                    color: credits < 10
                      ? "var(--danger)"
                      : credits < 50
                      ? "var(--warning)"
                      : "var(--accent-primary)",
                  }}
                />
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: credits < 10
                      ? "var(--danger)"
                      : credits < 50
                      ? "var(--warning)"
                      : "var(--accent-primary)",
                  }}
                >
                  {credits}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        style={{
          position: "absolute", top: 68, right: -12,
          width: 24, height: 24, borderRadius: "50%",
          background: "var(--glass-strong)", border: "1px solid var(--hairline)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: "var(--text-tertiary)",
          boxShadow: "var(--card-shadow)",
          backdropFilter: "blur(12px)",
          transition: "color 0.13s", zIndex: 1,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-tertiary)"; }}
      >
        {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
      </button>
    </aside>
  );
}
