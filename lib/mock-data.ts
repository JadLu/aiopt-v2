export type ProjectStatus = "active" | "in-draft" | "testing" | "scaling" | "completed" | "archived";

export interface Project {
  id: string;
  name: string;
  description: string;
  emoji: string;
  status: ProjectStatus;
  country: string;
  targetCpa: number;
  targetRoas: number;
  healthIndex: number;
  cpa: number;
  roas: number;
  spend: number;
  lastActivity: string;
  createdAt: string;
  marketingPlan?: string;
  productImageUrl?: string;
}

export interface Creative {
  id: string;
  name: string;
  type: "photo" | "video";
  url: string;
  createdAt: string;
}

export interface Alert {
  id: string;
  tier: "red" | "yellow" | "green";
  campaign: string;
  metric: string;
  value: string;
  threshold: string;
  time: string;
}

export const MOCK_PROJECTS: Project[] = [
  { id: "1", name: "Wireless Earbuds Pro", description: "Premium wireless earbuds targeting UAE & KSA", emoji: "🎧", status: "active", country: "UAE", targetCpa: 12, targetRoas: 4.0, healthIndex: 82, cpa: 14.2, roas: 3.8, spend: 4200, lastActivity: "2m ago", createdAt: "2026-05-01" },
  { id: "2", name: "Posture Corrector", description: "Ergonomic back support for office workers", emoji: "🦴", status: "testing", country: "KSA", targetCpa: 18, targetRoas: 3.0, healthIndex: 58, cpa: 22.5, roas: 2.1, spend: 980, lastActivity: "18m ago", createdAt: "2026-05-08" },
  { id: "3", name: "LED Face Mask", description: "Beauty device targeting women 25-40", emoji: "✨", status: "scaling", country: "EGY", targetCpa: 16, targetRoas: 3.5, healthIndex: 76, cpa: 18.9, roas: 3.1, spend: 7800, lastActivity: "1h ago", createdAt: "2026-04-20" },
  { id: "4", name: "Portable Blender", description: "Fitness niche — protein shakes on the go", emoji: "🥤", status: "in-draft", country: "MAR", targetCpa: 20, targetRoas: 2.5, healthIndex: 0, cpa: 0, roas: 0, spend: 0, lastActivity: "3h ago", createdAt: "2026-05-15" },
  { id: "5", name: "Car Phone Mount", description: "Universal gravity mount — mass market", emoji: "📱", status: "completed", country: "UAE", targetCpa: 10, targetRoas: 4.0, healthIndex: 91, cpa: 9.4, roas: 4.6, spend: 12400, lastActivity: "2d ago", createdAt: "2026-03-10" },
  { id: "6", name: "Posture Cushion", description: "Memory foam seat cushion for long hours", emoji: "🪑", status: "active", country: "KSA", targetCpa: 20, targetRoas: 3.0, healthIndex: 44, cpa: 31.2, roas: 1.8, spend: 1650, lastActivity: "5m ago", createdAt: "2026-05-12" },
];

export const MOCK_ALERTS: Alert[] = [
  { id: "1", tier: "red",    campaign: "Posture Cushion — Awareness", metric: "CPA",       value: "$31.20", threshold: "$20.00", time: "5m ago" },
  { id: "2", tier: "red",    campaign: "Posture Corrector — Retargeting", metric: "ROAS",   value: "2.1x",   threshold: "2.5x",  time: "22m ago" },
  { id: "3", tier: "yellow", campaign: "LED Face Mask — Lookalike",    metric: "Frequency", value: "3.8",    threshold: "3.5",   time: "1h ago" },
  { id: "4", tier: "yellow", campaign: "Wireless Earbuds — Cold",      metric: "CPM",       value: "$14.20", threshold: "$12.00", time: "2h ago" },
  { id: "5", tier: "green",  campaign: "Car Phone Mount — Scale",      metric: "ROAS",      value: "4.6x",   threshold: "2.5x",  time: "2d ago" },
];

export const MOCK_STATS = {
  totalProjects: 6,
  avgTimeToTest: "4.2 hrs",
  cumulativeSpend: 27030,
};
