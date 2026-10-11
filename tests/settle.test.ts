import { describe, expect, it } from "vitest";
import data from "../data/match.json";
import type { Claim } from "../lib/claims/schema";
import { describeClaim } from "../lib/claims/describe";
import { invalidReason, startProgress, stepProgress, type Status } from "../lib/claims/settle";
import { Replay } from "../lib/match/replay";
import type { MatchData } from "../lib/match/types";

const match = data as unknown as MatchData;
const replay = new Replay(match);

/** Make a call after `at` balls and play the real match forward until it settles. */
function settle(claim: Claim, at: number): { status: Status; idx: number } {
  let s = replay.stateAt(at);
  const p = startProgress(claim, match.meta, s);
  while (p.status === "pending") {
    const n = replay.next(s);
    if (!n) break;
    s = n.state;
    stepProgress(claim, p, s, n.ball);
  }
  return { status: p.status, idx: s.idx };
}

const SA = "South Africa";

describe("settlement on the real match", () => {
  it("batter dismissed in a named over", () => {
    const c: Claim = { metric: "batter_out", player: "H Klaasen", op: "eq", value: 1, window: { type: "over", over: 17 }, basis: "window" };
    expect(settle(c, 220)).toEqual({ status: "hit", idx: 227 }); // first ball of the 17th
    expect(settle({ ...c, window: { type: "over", over: 16 } }, 220)).toEqual({ status: "miss", idx: 226 });
  });

  it("resolves the moment a target is reached, not at the end of the window", () => {
    const c: Claim = { metric: "innings_runs", team: SA, op: "gte", value: 20, window: { type: "over", over: 15 }, basis: "window" };
    const r = settle(c, 212);
    expect(r.status).toBe("hit");
    expect(r.idx).toBeLessThan(220);
  });

  it("only counts what happens after the call is made", () => {
    // 15th over went 4,wd,wd,0,6,6,4,2. Called after the first six, only 12 more came.
    const c: Claim = { metric: "innings_runs", team: SA, op: "gte", value: 13, window: { type: "over", over: 15 }, basis: "window" };
    expect(settle(c, 217).status).toBe("miss");
    expect(settle({ ...c, value: 12 }, 217).status).toBe("hit");
  });

  it("next-ball calls ignore nothing and settle after one legal ball", () => {
    const wicket: Claim = { metric: "innings_wickets", team: SA, op: "gte", value: 1, window: { type: "balls", balls: 1 }, basis: "window" };
    expect(settle(wicket, 244)).toEqual({ status: "hit", idx: 245 });
    expect(settle(wicket, 245)).toEqual({ status: "miss", idx: 246 });
  });

  it("a wide does not use up a 'next ball' call", () => {
    // ball 248 is a wide, 249 is the wicket
    const wicket: Claim = { metric: "innings_wickets", team: SA, op: "gte", value: 1, window: { type: "balls", balls: 1 }, basis: "window" };
    expect(settle(wicket, 248)).toEqual({ status: "hit", idx: 250 });
  });

  it("scorecard totals: milestones and team totals", () => {
    const kohli50: Claim = { metric: "batter_runs", player: "V Kohli", op: "gte", value: 50, window: { type: "innings" }, basis: "total" };
    expect(settle(kohli50, 0).status).toBe("hit");
    const kohli100: Claim = { ...kohli50, value: 100 };
    expect(settle(kohli100, 0).status).toBe("miss"); // out for 76: resolves at his dismissal
    expect(settle(kohli100, 0).idx).toBeLessThan(127);
    const under170: Claim = { metric: "innings_runs", team: SA, op: "lte", value: 169, window: { type: "innings" }, basis: "total" };
    expect(settle(under170, 220)).toEqual({ status: "hit", idx: 251 });
    expect(settle({ ...under170, value: 168 }, 220).status).toBe("miss");
  });

  it("bowler wickets ignore run outs and count only that bowler", () => {
    const bumrah2: Claim = { metric: "bowler_wickets", player: "JJ Bumrah", op: "gte", value: 2, window: { type: "innings" }, basis: "total" };
    expect(settle(bumrah2, 127).status).toBe("hit");
    expect(settle({ ...bumrah2, value: 3 }, 127).status).toBe("miss");
    // Axar was run out in India's innings: no South African bowler is credited
    const rabada: Claim = { metric: "bowler_wickets", player: "K Rabada", op: "gte", value: 1, window: { type: "over", over: 14 }, basis: "window" };
    expect(settle(rabada, 81).status).toBe("miss");
  });

  it("not-out calls fail on dismissal and pass at the end", () => {
    const miller: Claim = { metric: "batter_out", player: "DA Miller", op: "eq", value: 0, window: { type: "innings" }, basis: "window" };
    expect(settle(miller, 238)).toEqual({ status: "miss", idx: 245 });
    const maharaj: Claim = { ...miller, player: "KA Maharaj" };
    expect(settle(maharaj, 238)).toEqual({ status: "hit", idx: 251 });
  });

  it("match winner settles on the last ball", () => {
    const india: Claim = { metric: "match_winner", team: "India", op: "eq", value: 1, window: { type: "match" }, basis: "total" };
    expect(settle(india, 220)).toEqual({ status: "hit", idx: 251 });
    expect(settle({ ...india, team: SA }, 220).status).toBe("miss");
  });

  it("refuses calls that cannot be checked any more", () => {
    const at = replay.stateAt(230);
    const out: Claim = { metric: "batter_out", player: "H Klaasen", op: "eq", value: 1, window: { type: "over", over: 18 }, basis: "window" };
    expect(invalidReason(out, match.meta, at)).toMatch(/already out/);
    const past: Claim = { metric: "innings_runs", team: SA, op: "gte", value: 10, window: { type: "over", over: 15 }, basis: "window" };
    expect(invalidReason(past, match.meta, at)).toMatch(/already done/);
    const done: Claim = { metric: "innings_runs", team: "India", op: "gte", value: 200, window: { type: "innings" }, basis: "total" };
    expect(invalidReason(done, match.meta, at)).toMatch(/already over/);
    // already true: India had 176, so "170+" is no longer a prediction
    expect(startProgress({ ...done, team: SA, value: 150 }, match.meta, at).status).toBe("hit");
  });

  it("describes claims in plain words", () => {
    expect(describeClaim({ metric: "batter_out", player: "H Klaasen", op: "eq", value: 1, window: { type: "over", over: 16 }, basis: "window" })).toBe("Klaasen dismissed in the 16th over");
    expect(describeClaim({ metric: "match_winner", team: "India", op: "eq", value: 1, window: { type: "match" }, basis: "total" })).toBe("IND to win");
    expect(describeClaim({ metric: "innings_runs", team: SA, op: "lte", value: 159, window: { type: "innings" }, basis: "total" })).toBe("SA 159 or fewer runs total");
    expect(describeClaim({ metric: "innings_wickets", team: SA, op: "gte", value: 1, window: { type: "balls", balls: 1 }, basis: "window" })).toBe("at least 1 wicket off the next ball");
  });
});
