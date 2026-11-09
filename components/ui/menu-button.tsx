"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/** Round glass "…" button that opens a small action menu. */
export function MenuButton({ label, items }: { label: string; items: MenuItem[] }) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const open = pos !== null;

  useEffect(() => {
    if (!open) return;
    const close = () => setPos(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setPos(null); btnRef.current?.focus(); }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="glass icon-glass"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          if (open) { setPos(null); return; }
          const rect = e.currentTarget.getBoundingClientRect();
          setPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
        }}
      >
        <MoreHorizontal size={16} />
      </button>

      {pos && createPortal(
        <div
          role="menu"
          className="glass"
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: "fixed", top: pos.top, right: pos.right, zIndex: 40, minWidth: 210, padding: "6px 0",
            borderRadius: "var(--r-tile)", overflow: "hidden", background: "var(--glass-strong)",
          }}
        >
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              className={`menu-item${it.danger ? " danger" : ""}`}
              onClick={() => { setPos(null); it.onSelect(); }}
            >
              {it.icon}
              <span style={{ flex: 1, textAlign: "left" }}>{it.label}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
