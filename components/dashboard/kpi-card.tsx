import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface KpiCardProps {
  label: string;
  /** null renders a loading shimmer. */
  value: string | null;
  icon: LucideIcon;
  /** Footer row pinned to the bottom: chips, links, a next action. */
  children?: ReactNode;
}

export function KpiCard({ label, value, icon: Icon, children }: KpiCardProps) {
  return (
    <div className="glass kpi-tile lift">
      <div className="kpi-head">
        <span className="label-caps">{label}</span>
        <span className="glass-inner icon-chip" aria-hidden>
          <Icon size={16} strokeWidth={1.8} />
        </span>
      </div>
      {value === null ? (
        <div className="shimmer" style={{ height: 44, width: 96 }} aria-label={`${label} loading`} />
      ) : (
        <span className="kpi-big">{value}</span>
      )}
      {children && <div className="kpi-foot">{children}</div>}
    </div>
  );
}
