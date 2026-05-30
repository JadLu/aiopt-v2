"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FolderKanban,
  Megaphone, Bot, Settings, ChevronLeft, ChevronRight, Layers
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

const NAV = [
  { label: "Dashboard",   href: "/dashboard",   icon: LayoutDashboard },
  { label: "Projects",    href: "/projects",     icon: FolderKanban },
  { label: "Advertising", href: "/advertising",  icon: Megaphone },
  { label: "AI Assistant",href: "/ai-assistant", icon: Bot },
];

const BOTTOM_NAV = [
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      {/* Logo */}
      <div style={{ padding: "18px 16px 14px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--border-default)" }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
          background: "linear-gradient(135deg, #5AC8D6 0%, #6FB1E8 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 8px rgba(90,200,214,0.30)",
        }}>
          <Layers size={16} color="white" strokeWidth={2.2} />
        </div>
        {!collapsed && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>AIOPT</div>
            <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>E-commerce Suite</div>
          </div>
        )}
      </div>

      {/* Main nav */}
      <nav style={{ flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`sidebar-nav-item${active ? " active" : ""}`}
              title={collapsed ? label : undefined}
            >
              <Icon size={17} strokeWidth={active ? 2.2 : 1.8} style={{ flexShrink: 0 }} />
              <span className="nav-label">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div style={{ padding: "8px 8px 16px", borderTop: "1px solid var(--border-default)", display: "flex", flexDirection: "column", gap: 2 }}>
        {BOTTOM_NAV.map(({ label, href, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} className={`sidebar-nav-item${active ? " active" : ""}`} title={collapsed ? label : undefined}>
              <Icon size={17} strokeWidth={1.8} style={{ flexShrink: 0 }} />
              <span className="nav-label">{label}</span>
            </Link>
          );
        })}

        {/* Theme toggle row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 12px", marginTop: 4 }}>
          <ThemeToggle />
          {!collapsed && <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Theme</span>}
        </div>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        style={{
          position: "absolute", top: 68, right: -12,
          width: 24, height: 24, borderRadius: "50%",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: "var(--text-tertiary)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          transition: "color 0.13s, background-color 0.13s",
          zIndex: 1,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.background = "var(--bg-subtle)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-tertiary)"; e.currentTarget.style.background = "var(--bg-elevated)"; }}
      >
        {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
      </button>
    </aside>
  );
}
