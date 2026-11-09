"use client";

import { authFetch } from "@/lib/auth-fetch";
import type { Project } from "@/lib/mock-data";

export type StartPlanResult =
  | { ok: true }
  | { ok: false; kind: "credits"; required: number; balance: number }
  | { ok: false; kind: "error"; message: string };

/**
 * Asks the server to start writing a marketing plan. The server charges credits,
 * marks the project `marketingPlanStatus: "generating"` and keeps generating after
 * the response, so callers may navigate away right after `{ ok: true }`.
 */
export async function startMarketingPlan(project: Project): Promise<StartPlanResult> {
  try {
    const res = await authFetch("/api/marketing-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project }),
    });

    if (res.status === 402) {
      const data = (await res.json()) as { required: number; balance: number };
      return { ok: false, kind: "credits", required: data.required, balance: data.balance };
    }
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, kind: "error", message: text || `Request failed (${res.status})` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, kind: "error", message: err instanceof Error ? err.message : "Something went wrong" };
  }
}

export interface Angle {
  name: string;
  size: string;
  traits: string[];
}

export type RegenerateAngleResult =
  | { ok: true; angle: Angle }
  | { ok: false; kind: "credits"; required: number; balance: number }
  | { ok: false; kind: "error"; message: string };

/** Rewrites one marketing angle (costs CREDIT_COSTS.ANGLE, refunded automatically on failure). */
export async function regenerateAngle(projectId: string, index: number, name: string): Promise<RegenerateAngleResult> {
  try {
    const res = await authFetch("/api/regenerate-angle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, index, name }),
    });
    if (res.status === 402) {
      const data = (await res.json()) as { required: number; balance: number };
      return { ok: false, kind: "credits", required: data.required, balance: data.balance };
    }
    if (res.status === 409) {
      return { ok: false, kind: "error", message: "That angle changed. Refresh the page and try again." };
    }
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, kind: "error", message: text || `Request failed (${res.status})` };
    }
    const data = (await res.json()) as { angle: Angle };
    return { ok: true, angle: data.angle };
  } catch (err) {
    return { ok: false, kind: "error", message: err instanceof Error ? err.message : "Something went wrong" };
  }
}
