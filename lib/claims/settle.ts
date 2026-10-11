import type { Ball, InnIdx, MatchMeta, MatchState } from "../match/types";
import { bowlerGetsWicket, bowlerRuns, countsAsWicket, OVERS } from "../match/replay";
import { PLAYERS } from "../match/players";
import { type Claim, isBatterMetric, isBowlerMetric, isInningsMetric } from "./schema";

export type Status = "pending" | "hit" | "miss";

/** Running tally for one claim. The same code runs on the real match and on simulated ones. */
export interface Progress {
  /** innings the claim is about; -1 for match_winner */
  inn: InnIdx | -1;
  /** scorecard figure at the moment the call was made ("total" basis) */
  base: number;
  /** what has been added inside the window since */
  acc: number;
  /** legal balls seen since the call, for "balls" windows */
  legalSeen: number;
  status: Status;
}

export function inningsOf(claim: Claim, meta: MatchMeta, s: MatchState): InnIdx | -1 {
  if (claim.metric === "match_winner") return -1;
  if (claim.player) {
    const team = PLAYERS[claim.player]?.team;
    const batsIn = meta.teams.indexOf(team as string);
    if (batsIn < 0) return s.inn;
    return (isBatterMetric(claim.metric) ? batsIn : 1 - batsIn) as InnIdx;
  }
  const idx = meta.teams.indexOf(claim.team as string);
  return (idx < 0 ? s.inn : idx) as InnIdx;
}

function scorecardValue(claim: Claim, s: MatchState, inn: InnIdx): number {
  const st = s.innings[inn];
  const bat = claim.player ? st.bat[claim.player] : undefined;
  const bowl = claim.player ? st.bowl[claim.player] : undefined;
  switch (claim.metric) {
    case "batter_runs": return bat?.runs ?? 0;
    case "batter_fours": return bat?.fours ?? 0;
    case "batter_sixes": return bat?.sixes ?? 0;
    case "batter_boundaries": return (bat?.fours ?? 0) + (bat?.sixes ?? 0);
    case "batter_out": return bat?.out ? 1 : 0;
    case "bowler_wickets": return bowl?.wickets ?? 0;
    case "bowler_runs_conceded": return bowl?.runs ?? 0;
    case "innings_runs": return st.runs;
    case "innings_wickets": return st.wickets;
    case "innings_fours": return st.fours;
    case "innings_sixes": return st.sixes;
    case "innings_boundaries": return st.fours + st.sixes;
    default: return 0;
  }
}

function contribution(claim: Claim, b: Ball): number {
  const p = claim.player;
  switch (claim.metric) {
    case "batter_runs": return b.batter === p ? b.runsBat : 0;
    case "batter_fours": return b.batter === p && b.four ? 1 : 0;
    case "batter_sixes": return b.batter === p && b.six ? 1 : 0;
    case "batter_boundaries": return b.batter === p && (b.four || b.six) ? 1 : 0;
    case "batter_out": return b.wicket?.playerOut === p ? 1 : 0;
    case "bowler_wickets": return b.bowler === p && bowlerGetsWicket(b) ? 1 : 0;
    case "bowler_runs_conceded": return b.bowler === p ? bowlerRuns(b) : 0;
    case "innings_runs": return b.total;
    case "innings_wickets": return countsAsWicket(b) ? 1 : 0;
    case "innings_fours": return b.four ? 1 : 0;
    case "innings_sixes": return b.six ? 1 : 0;
    case "innings_boundaries": return b.four || b.six ? 1 : 0;
    default: return 0;
  }
}

function inWindow(claim: Claim, p: Progress, b: Ball): boolean {
  const w = claim.window;
  switch (w.type) {
    case "over": return b.over === (w.over ?? 0) - 1;
    case "by_over": return b.over <= (w.over ?? OVERS) - 1;
    case "balls": return p.legalSeen < (w.balls ?? 1);
    default: return true;
  }
}

function windowClosed(claim: Claim, p: Progress, s: MatchState): boolean {
  if (p.inn === -1) return s.done;
  const st = s.innings[p.inn];
  if (st.done) return true;
  if (isBatterMetric(claim.metric) && claim.player && st.bat[claim.player]?.out) return true;
  const w = claim.window;
  switch (w.type) {
    case "over":
    case "by_over": return st.legal >= (w.over ?? OVERS) * 6;
    case "balls": return p.legalSeen >= (w.balls ?? 1);
    default: return false;
  }
}

function resolve(claim: Claim, p: Progress, s: MatchState): Status {
  if (claim.metric === "match_winner") {
    if (!s.done) return "pending";
    return s.winner === claim.team ? "hit" : "miss";
  }
  const m = p.base + p.acc;
  const closed = windowClosed(claim, p, s);
  switch (claim.op) {
    case "gte": return m >= claim.value ? "hit" : closed ? "miss" : "pending";
    case "lte": return m > claim.value ? "miss" : closed ? "hit" : "pending";
    case "eq": return m > claim.value ? "miss" : closed ? (m === claim.value ? "hit" : "miss") : "pending";
  }
}

/** Start tracking a claim made when the match is in state `s`. */
export function startProgress(claim: Claim, meta: MatchMeta, s: MatchState): Progress {
  const inn = inningsOf(claim, meta, s);
  const p: Progress = { inn, base: 0, acc: 0, legalSeen: 0, status: "pending" };
  if (inn !== -1 && claim.basis === "total") p.base = scorecardValue(claim, s, inn);
  p.status = resolve(claim, p, s);
  return p;
}

/** Feed one ball (already applied to `s`) to a claim. Mutates and returns its status. */
export function stepProgress(claim: Claim, p: Progress, s: MatchState, b: Ball): Status {
  if (p.status !== "pending") return p.status;
  if (p.inn !== -1 && b.inn === p.inn) {
    if (inWindow(claim, p, b)) p.acc += contribution(claim, b);
    if (b.legal) p.legalSeen++;
  }
  p.status = resolve(claim, p, s);
  return p.status;
}

/** The figure a claim is being measured on, for display ("needs 50, on 31") */
export const measured = (p: Progress) => p.base + p.acc;

/**
 * Reasons a claim cannot be accepted right now. Returns null when it is fine.
 * (Already-true and already-impossible calls are caught separately by their
 * status straight after startProgress.)
 */
export function invalidReason(claim: Claim, meta: MatchMeta, s: MatchState): string | null {
  if (s.done) return "The match is over.";
  if (isBatterMetric(claim.metric) || isBowlerMetric(claim.metric)) {
    if (!claim.player || !PLAYERS[claim.player]) return "I couldn't tell which player you mean.";
  }
  if (claim.metric === "match_winner" && !meta.teams.includes(claim.team as string)) {
    return "I couldn't tell which team you mean.";
  }
  if (isInningsMetric(claim.metric) && claim.team && !meta.teams.includes(claim.team)) {
    return "I couldn't tell which team you mean.";
  }
  if (!Number.isFinite(claim.value) || claim.value < 0) return "That number doesn't make sense.";

  const inn = inningsOf(claim, meta, s);
  if (inn === -1) return null;
  const st = s.innings[inn];
  if (st.done) return `${st.team}'s innings is already over.`;

  const w = claim.window;
  if (w.type === "over" || w.type === "by_over") {
    if (!w.over || w.over < 1 || w.over > OVERS) return "That over doesn't exist in a T20.";
    if (st.legal >= w.over * 6) return `Over ${w.over} is already done.`;
  }
  if (w.type === "balls" && (!w.balls || w.balls < 1 || w.balls > 120)) return "That number of balls doesn't make sense.";
  if ((w.type === "over" || w.type === "balls") && inn !== s.inn) return `${st.team} aren't batting yet.`;

  if (isBatterMetric(claim.metric) && claim.player) {
    const bat = st.bat[claim.player];
    if (bat?.out) return `${PLAYERS[claim.player].short} is already out.`;
  }
  if (isBowlerMetric(claim.metric) && claim.player && !PLAYERS[claim.player].bowls && !st.bowl[claim.player]) {
    return `${PLAYERS[claim.player].short} isn't bowling in this match.`;
  }
  return null;
}
