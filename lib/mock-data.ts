export type ProjectStatus = "active" | "in-draft" | "testing" | "completed" | "archived";

export interface MarketAnalysisData {
  stats: {
    market_size: string;
    audience_size: string;
    growth_rate: string;
    competition: string;
  };
  demographics: {
    ages: { label: string; pct: number }[];
    gender: { label_a: string; pct_a: number; label_b: string; pct_b: number };
  };
  regions: { name: string; priority: string; pct: number }[];
  platforms: { name: string; score: number }[];
  segments: { name: string; size: string; traits: string[]; starred?: boolean }[];
}

export interface ChannelsData {
  total_budget: string;
  channels: {
    name: string;
    budget_pct: number;
    formats: string[];
    expected_roas: string;
    primary: boolean;
  }[];
}

export interface ContentData {
  tone: string;
  pillars: { name: string; pct: number; description: string }[];
  formats: { type: string; platforms: string[]; frequency: string; score: number }[];
  hooks: string[];
}

export interface PhasesData {
  phases: {
    name: string;
    duration: string;
    budget_pct: number;
    objective: string;
    tactics: string[];
    success_kpi: string;
  }[];
}

export interface KpiData {
  primary_metrics: {
    name: string;
    target: string;
    benchmark: string;
    description: string;
    lower_is_better: boolean;
  }[];
  secondary_metrics: {
    name: string;
    target: string;
    benchmark: string;
    lower_is_better: boolean;
  }[];
}

export interface ActionData {
  weeks: {
    label: string;
    focus: string;
    tasks: {
      task: string;
      priority: "high" | "medium" | "low";
      owner: string;
    }[];
  }[];
}

export interface PlanVisualData {
  market?: MarketAnalysisData;
  channels?: ChannelsData;
  content?: ContentData;
  phases?: PhasesData;
  kpi?: KpiData;
  action?: ActionData;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  emoji: string;
  status: ProjectStatus;
  country: string;
  /** ISO 3166-1 codes of the target markets. `country` holds the matching names (joined) for prompts and display. */
  countries?: string[];
  lastActivity: string;
  createdAt: string;
  marketingPlan?: string;
  marketAnalysisData?: MarketAnalysisData;
  planVisualData?: PlanVisualData;
  productImageUrl?: string;
  marketingAngle?: string;
  /** Index (in planVisualData.market.segments) of the angle the user chose to build creatives for. */
  selectedAngle?: number;
  /** Sections of the plan that are finished while it is still being written (cleared when done). */
  planDraft?: PlanVisualData;
  marketingPlanStatus?: "generating" | "done" | "failed";
  marketingPlanError?: string;
}

