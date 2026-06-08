import { TrendingUp, TrendingDown, type LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  trend?: { direction: "up" | "down"; label: string };
  icon: LucideIcon;
  accentColor?: string;
  gradientFrom?: string;
  gradientTo?: string;
  delay?: number;
}

export function KpiCard({
  label,
  value,
  sub,
  trend,
  icon: Icon,
  accentColor = "var(--accent-primary)",
  gradientFrom = "#5AC8D6",
  gradientTo = "#6FB1E8",
  delay = 0,
}: KpiCardProps) {
  return (
    <div
      className="glass-card kpi-card rise"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Top row: icon + trend pill */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div
          className="kpi-icon-wrap"
          style={{ background: `linear-gradient(135deg, ${gradientFrom} 0%, ${gradientTo} 100%)`, boxShadow: `0 4px 12px ${gradientFrom}44` }}
        >
          <Icon size={16} color="#fff" strokeWidth={1.9} />
        </div>
        {trend && (
          <span className={`kpi-trend-pill ${trend.direction}`}>
            {trend.direction === "up"
              ? <TrendingUp size={11} strokeWidth={2} />
              : <TrendingDown size={11} strokeWidth={2} />}
            {trend.label}
          </span>
        )}
      </div>

      {/* Value */}
      <div className="kpi-value">{value}</div>

      {/* Label + sub */}
      <div>
        <div className="kpi-label">{label}</div>
        {sub && <div className="kpi-sub" style={{ marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}
