import { describe, expect, it } from "vitest";
import data from "../data/match.json";
import type { Claim } from "../lib/claims/schema";
import { Replay } from "../lib/match/replay";
import type { MatchData } from "../lib/match/types";
import { tierFor } from "../lib/room/scoring";
import { estimate } from "../lib/sim/simulate";

const match = data as unknown as MatchData;
const replay = new Replay(match);
const p = (claim: Claim, at: number) => estimate(claim, match.meta, replay.stateAt(at)).p;
const SA = "South Africa";
const indiaWin: Claim = { metric: "match_winner", team: "India", op: "eq", value: 1, window: { type: "match" }, basis: "total" };

describe("boldness simulator", () => {
  it("gives the same answer for the same call at the same moment", () => {
    expect(p(indiaWin, 220)).toBe(p(indiaWin, 220));
  });

  it("is roughly even before a ball is bowled", () => {
    const x = p(indiaWin, 0);
    expect(x).toBeGreaterThan(0.35);
    expect(x).toBeLessThan(0.65);
  });

  it("rates India as a long shot at 30 needed off 30, and a favourite at 16 off 6", () => {
    expect(p(indiaWin, 220)).toBeLessThan(0.15);
    expect(p(indiaWin, 244)).toBeGreaterThan(0.6);
  });

  it("easier targets are more likely", () => {
    const total = (value: number): Claim => ({ metric: "innings_runs", team: "India", op: "gte", value, window: { type: "innings" }, basis: "total" });
    const [a, b, c] = [150, 170, 190].map((v) => p(total(v), 88));
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
  });

  it("opposite calls add up to about one", () => {
    // not exactly one: a few simulated matches end tied, and each estimate has ~1% sampling noise
    const sum = p(indiaWin, 200) + p({ ...indiaWin, team: SA }, 200);
    expect(sum).toBeGreaterThan(0.93);
    expect(sum).toBeLessThanOrEqual(1.03);
  });

  it("flags obvious guesses as no-balls", () => {
    // "at least 1 run in the 5th over"
    const oneRun: Claim = { metric: "innings_runs", team: "India", op: "gte", value: 1, window: { type: "over", over: 5 }, basis: "window" };
    expect(tierFor(p(oneRun, 24)).id).toBe("obvious");
    // "a boundary in the last over" is likely, but not a gimme
    const boundary: Claim = { metric: "innings_boundaries", team: SA, op: "gte", value: 1, window: { type: "over", over: 20 }, basis: "window" };
    expect(tierFor(p(boundary, 244)).id).toBe("safe");
  });

  it("rates a wicket off the very next ball as a long shot", () => {
    const w: Claim = { metric: "innings_wickets", team: SA, op: "gte", value: 1, window: { type: "balls", balls: 1 }, basis: "window" };
    const x = p(w, 244);
    expect(x).toBeGreaterThan(0.03);
    expect(x).toBeLessThan(0.2);
  });
});
