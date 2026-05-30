import { TrendingUp, TrendingDown, type LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  trend?: { direction: "up" | "down"; label: string };
  icon: LucideIcon;
  accentColor?: string;
}

export function KpiCard({ label, value, sub, trend, icon: Icon, accentColor = "var(--accent-primary)" }: KpiCardProps) {
  return (
    <div className="card kpi-card">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <span className="kpi-label">{label}</span>
        <div style={{
          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
          background: `${accentColor}18`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={16} color={accentColor} strokeWidth={1.8} />
        </div>
      </div>
      <div className="kpi-value">{value}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {trend && (
          <span className={`kpi-trend ${trend.direction}`}>
            {trend.direction === "up" ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trend.label}
          </span>
        )}
        {sub && <span className="kpi-sub">{sub}</span>}
      </div>
    </div>
  );
}
