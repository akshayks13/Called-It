/**
 * A claim is one checkable prediction. The language model only ever produces
 * this structure; everything that decides right or wrong is code.
 */
export const METRICS = [
  "batter_runs",
  "batter_fours",
  "batter_sixes",
  "batter_boundaries",
  "batter_out",
  "bowler_wickets",
  "bowler_runs_conceded",
  "innings_runs",
  "innings_wickets",
  "innings_fours",
  "innings_sixes",
  "innings_boundaries",
  "match_winner",
] as const;
export type Metric = (typeof METRICS)[number];

export const OPS = ["gte", "lte", "eq"] as const;
export type Op = (typeof OPS)[number];

export const WINDOW_TYPES = ["over", "balls", "by_over", "innings", "match"] as const;
export type WindowType = (typeof WINDOW_TYPES)[number];

export interface ClaimWindow {
  type: WindowType;
  /** 1-based over number, for "over" and "by_over" */
  over?: number;
  /** number of legal balls from now, for "balls" */
  balls?: number;
}

export interface Claim {
  metric: Metric;
  /** Cricsheet player name, for batter_* and bowler_* */
  player?: string;
  /** batting team for innings_*; the predicted winner for match_winner */
  team?: string;
  op: Op;
  value: number;
  window: ClaimWindow;
  /**
   * "total": the figure on the scorecard when the window closes (Kohli 50, SA 170).
   * "window": only what happens inside the window from now (12 runs this over).
   */
  basis: "total" | "window";
}

export const isBatterMetric = (m: Metric) => m.startsWith("batter_");
export const isBowlerMetric = (m: Metric) => m.startsWith("bowler_");
export const isInningsMetric = (m: Metric) => m.startsWith("innings_");

/**
 * Tidy a claim so equivalent wordings end up identical: short windows always
 * count from now, yes/no metrics are 0 or 1.
 */
export function normalizeClaim(c: Claim): Claim {
  const n: Claim = { ...c, window: { ...c.window } };
  if (n.window.type === "over" || n.window.type === "balls") n.basis = "window";
  if (n.metric === "batter_out") {
    n.value = n.value >= 1 && n.op !== "lte" ? 1 : 0;
    n.op = "eq";
    n.basis = "window";
  }
  if (n.metric === "match_winner") {
    n.op = "eq";
    n.value = 1;
    n.window = { type: "match" };
    n.basis = "total";
  }
  if (n.window.type !== "over" && n.window.type !== "by_over") delete n.window.over;
  if (n.window.type !== "balls") delete n.window.balls;
  n.value = Math.round(n.value);
  return n;
}

/** Same call, said twice */
export function sameClaim(a: Claim, b: Claim): boolean {
  return (
    a.metric === b.metric &&
    a.player === b.player &&
    a.team === b.team &&
    a.op === b.op &&
    a.value === b.value &&
    a.basis === b.basis &&
    a.window.type === b.window.type &&
    a.window.over === b.window.over &&
    a.window.balls === b.window.balls
  );
}
