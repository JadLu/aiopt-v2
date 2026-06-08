import type { HealthTier } from "./firebase/meta-campaigns";

export interface CampaignMetrics {
  roas: number;
  cpa: number;
  ctr: number;
  frequency: number;
}

export interface HealthTargets {
  targetRoas: number;
  targetCpa: number;
}

function normalize(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}

export function computeHealthScore(
  metrics: CampaignMetrics,
  targets: HealthTargets
): { score: number; tier: HealthTier } {
  const { roas, cpa, ctr, frequency } = metrics;
  const { targetRoas, targetCpa } = targets;

  const score = clamp(
    0,
    100,
    40 * normalize(roas / targetRoas) +
      30 * (1 - normalize(cpa / targetCpa)) +
      20 * normalize(ctr / 2.0) +
      10 * (1 - normalize(frequency / 3.5))
  );

  const tier: HealthTier =
    score >= 71 ? "green" : score >= 41 ? "yellow" : "red";

  return { score: Math.round(score), tier };
}

export function formatCurrency(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

export function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function isStale(lastSyncedAt: string | null, thresholdMinutes = 15): boolean {
  if (!lastSyncedAt) return true;
  const diff = Date.now() - new Date(lastSyncedAt).getTime();
  return diff > thresholdMinutes * 60 * 1000;
}
