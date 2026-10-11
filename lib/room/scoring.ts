/**
 * Points depend on how unlikely a call was when it was made.
 * Obvious calls are "no-balls": worth nothing and not recorded.
 */
export type TierId = "obvious" | "safe" | "fair" | "bold" | "outrageous" | "miracle";

export interface Tier {
  id: TierId;
  label: string;
  /** a call belongs to the first tier whose minP it reaches */
  minP: number;
  win: number;
}

export const TIERS: Tier[] = [
  { id: "obvious", label: "Too obvious", minP: 0.85, win: 0 },
  { id: "safe", label: "Safe", minP: 0.6, win: 10 },
  { id: "fair", label: "Fair", minP: 0.35, win: 40 },
  { id: "bold", label: "Bold", minP: 0.15, win: 120 },
  { id: "outrageous", label: "Outrageous", minP: 0.05, win: 250 },
  { id: "miracle", label: "Miracle", minP: 0, win: 500 },
];

export const MISS_PENALTY = 20;
export const MAX_OPEN_CALLS = 3;

export const tierFor = (p: number): Tier => TIERS.find((t) => p >= t.minP) ?? TIERS[TIERS.length - 1];

/** "about 1 in 6", for people who don't think in percentages */
export function oddsText(p: number): string {
  if (p >= 0.995) return "certain";
  if (p >= 0.9) return `about ${Math.round(p * 100)}% likely`;
  if (p >= 0.45) return `about ${Math.round(p * 20) * 5}% likely`;
  if (p <= 0.004) return "less than 1 in 200";
  return `about 1 in ${Math.max(2, Math.round(1 / p))}`;
}
