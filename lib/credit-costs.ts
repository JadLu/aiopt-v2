/**
 * Single source of truth for credit prices.
 * No Firebase imports and no "use client" — safe to import from both
 * client components (display) and API routes (charging).
 */

export const CREDIT_COSTS = {
  MARKETING_PLAN: 20,
  PHOTO: 35,
  LANDING_PAGE: 35,
  ANGLE: 5,
} as const;

export function videoCreditCost(duration: string): number {
  const num = parseInt(duration, 10);
  if (num >= 10) return 300;
  if (num >= 8) return 260;
  return 240; // 5s / 6s
}
