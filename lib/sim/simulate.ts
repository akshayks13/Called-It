import rates from "../../data/rates.json";
import type { Ball, InnState, MatchMeta, MatchState } from "../match/types";
import { applyBallMut, BALLS_PER_INNINGS, cloneState } from "../match/replay";
import { PLAYERS } from "../match/players";
import type { Claim } from "../claims/schema";
import { startProgress, stepProgress } from "../claims/settle";

type PhaseRates = { "0": number; "1": number; "2": number; "3": number; "4": number; "6": number; W: number; extra: number };
const PHASES = rates.phases as Record<"pp" | "mid" | "death", PhaseRates>;
const BATTERS = rates.batters as Record<string, { boundary: number; out: number }>;
const BOWLERS = rates.bowlers as Record<string, { econ: number; wkt: number }>;

export type Rng = () => number;

/** Small seeded generator so the same call at the same moment always gets the same rating. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const phaseOf = (over: number) => (over < 6 ? "pp" : over < 15 ? "mid" : "death");

function nextBatter(inn: InnState, meta: MatchMeta): string | null {
  for (const id of meta.squads[inn.team]) if (!inn.bat[id]) return id;
  return null;
}

function pickBowler(s: MatchState, meta: MatchMeta, rng: Rng): string {
  const inn = s.innings[s.inn];
  const squad = meta.squads[inn.bowlingTeam];
  const eligible = (strict: boolean) =>
    squad.filter((id) => {
      const used = inn.bowl[id]?.legal ?? 0;
      if (used >= 24 || id === s.lastBowler) return false;
      return strict ? PLAYERS[id]?.bowls || used > 0 : true;
    });
  let pool = eligible(true);
  if (!pool.length) pool = eligible(false);
  // bowlers with more overs left are more likely to be used
  const weights = pool.map((id) => 24 - (inn.bowl[id]?.legal ?? 0));
  let r = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/** Draw the next delivery for the current state. Does not apply it. */
function drawBall(s: MatchState, rng: Rng): Ball {
  const inn = s.innings[s.inn];
  const over = Math.floor(inn.legal / 6);
  const base = PHASES[phaseOf(over)];
  const striker = s.striker as string;
  const bowler = s.bowler as string;
  const ball: Ball = {
    i: s.idx, inn: s.inn, over, label: "", batter: striker, bowler, nonStriker: s.nonStriker as string,
    runsBat: 0, total: 0, wide: 0, noball: 0, bye: 0, legbye: 0, legal: true, four: false, six: false,
  };

  if (rng() < base.extra) {
    ball.legal = false;
    ball.wide = 1;
    ball.total = 1;
    return ball;
  }

  const bf = BATTERS[striker] ?? { boundary: 1, out: 1 };
  const bw = BOWLERS[bowler] ?? { econ: 1, wkt: 1 };
  let p1 = base["1"] * bw.econ;
  let p2 = base["2"] * bw.econ;
  let p3 = base["3"] * bw.econ;
  let p4 = base["4"] * bf.boundary * bw.econ;
  let p6 = base["6"] * bf.boundary * bw.econ;
  let pW = base.W * bf.out * bw.wkt;

  // A chasing side bats to the asking rate: harder when behind, safer when ahead.
  if (s.inn === 1 && inn.target != null) {
    const left = BALLS_PER_INNINGS - inn.legal;
    const asking = (inn.target - inn.runs) / Math.max(1, left);
    const usual = base["1"] + 2 * base["2"] + 3 * base["3"] + 4 * base["4"] + 6 * base["6"];
    const g = clamp((asking - usual) / usual, -0.5, 1.5);
    const risk = 1 + (g > 0 ? 0.45 : 0.4) * g;
    p4 *= risk;
    p6 *= risk;
    pW *= 1 + 0.5 * g;
    if (g < 0) p1 *= 1 - 0.15 * g;
  }

  let scoring = p1 + p2 + p3 + p4 + p6;
  if (scoring + pW > 0.97) {
    const k = (0.97 - pW) / scoring;
    p1 *= k; p2 *= k; p3 *= k; p4 *= k; p6 *= k;
    scoring = 0.97 - pW;
  }

  let r = rng();
  if ((r -= pW) < 0) {
    // roughly 1 dismissal in 12 is a run out, which the bowler doesn't get
    ball.wicket = { playerOut: striker, kind: rng() < 0.08 ? "run out" : "caught", fielders: [] };
    return ball;
  }
  let runs = 0;
  if ((r -= p1) < 0) runs = 1;
  else if ((r -= p2) < 0) runs = 2;
  else if ((r -= p3) < 0) runs = 3;
  else if ((r -= p4) < 0) runs = 4;
  else if ((r -= p6) < 0) runs = 6;
  ball.runsBat = ball.total = runs;
  ball.four = runs === 4;
  ball.six = runs === 6;
  return ball;
}

/**
 * Play the match out once from `start`. `onBall` sees every simulated ball
 * (after it is applied) and returns true to stop early.
 */
export function simulateOnce(start: MatchState, meta: MatchMeta, rng: Rng, onBall: (s: MatchState, b: Ball) => boolean): void {
  const s = cloneState(start);
  // generous cap: a T20 has at most 240 legal balls plus extras
  for (let guard = 0; guard < 400 && !s.done; guard++) {
    let inn = s.innings[s.inn];
    if (inn.done) {
      if (s.inn === 1) break;
      s.inn = 1;
      inn = s.innings[1];
      inn.target ??= s.innings[0].runs + 1;
      s.striker = s.nonStriker = s.bowler = s.lastBowler = null;
    }
    if (!s.striker || !s.nonStriker) {
      const squad = meta.squads[inn.team];
      s.striker = squad[0];
      s.nonStriker = squad[1];
    }
    s.bowler ??= pickBowler(s, meta, rng);

    const ball = drawBall(s, rng);
    applyBallMut(s, ball);

    if (ball.wicket && !inn.done) s.striker = nextBatter(inn, meta) ?? s.striker;
    const overDone = ball.legal && inn.legal % 6 === 0;
    if ((ball.runsBat % 2 === 1) !== overDone) [s.striker, s.nonStriker] = [s.nonStriker, s.striker];
    if (overDone) s.bowler = null;

    if (onBall(s, ball)) return;
  }
}

export interface Estimate {
  /** share of simulated matches in which the claim came true */
  p: number;
  runs: number;
}

/** How likely is this claim, judged from this exact moment? */
export function estimate(claim: Claim, meta: MatchMeta, state: MatchState, opts: { runs?: number; seed?: number } = {}): Estimate {
  const runs = opts.runs ?? 2000;
  const first = startProgress(claim, meta, state);
  if (first.status !== "pending") return { p: first.status === "hit" ? 1 : 0, runs: 0 };

  const rng = mulberry32(opts.seed ?? hashSeed(JSON.stringify(claim) + state.idx));
  let hits = 0;
  for (let i = 0; i < runs; i++) {
    const p = { ...first };
    simulateOnce(state, meta, rng, (s, b) => stepProgress(claim, p, s, b) !== "pending");
    if (p.status === "hit") hits++;
  }
  return { p: hits / runs, runs };
}
