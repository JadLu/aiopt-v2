import type { ReactNode } from "react";
import { GlassCard } from "./glass-card";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  /** Required: every empty state shows the one next action, never a bare "—". */
  action: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <GlassCard
      inner
      padding={32}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}
    >
      <div
        className="glass-inner"
        style={{
          width: 56, height: 56, borderRadius: "var(--r-tile)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--accent-primary)",
        }}
        aria-hidden
      >
        {icon}
      </div>
      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
        {title}
      </h3>
      {description && (
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-secondary)", maxWidth: 360 }}>{description}</p>
      )}
      <div style={{ marginTop: 6 }}>{action}</div>
    </GlassCard>
  );
}
