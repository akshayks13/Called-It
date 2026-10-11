import { describe, expect, it } from "vitest";
import data from "../data/match.json";
import { Replay } from "../lib/match/replay";
import type { MatchData } from "../lib/match/types";

const match = data as unknown as MatchData;

describe("replay", () => {
  const replay = new Replay(match);
  const end = replay.stateAt(match.balls.length);

  it("reproduces the recorded result", () => {
    expect(end.done).toBe(true);
    expect(end.winner).toBe(match.meta.result.winner);
    // India 176/7, South Africa 169/8: India won by 7 runs
    expect(match.meta.result.text).toBe("India won by 7 runs");
    expect(end.innings[0].runs - end.innings[1].runs).toBe(7);
    expect([end.innings[0].runs, end.innings[0].wickets]).toEqual([176, 7]);
    expect([end.innings[1].runs, end.innings[1].wickets]).toEqual([169, 8]);
    expect(end.innings[1].target).toBe(177);
  });

  it("keeps batter and bowler figures consistent with the team score", () => {
    for (const inn of end.innings) {
      const batRuns = Object.values(inn.bat).reduce((a, b) => a + b.runs, 0);
      const extras = match.balls.filter((b) => match.meta.teams[b.inn] === inn.team).reduce((a, b) => a + b.total - b.runsBat, 0);
      expect(batRuns + extras).toBe(inn.runs);
      expect(Object.values(inn.bowl).reduce((a, b) => a + b.legal, 0)).toBe(inn.legal);
      expect(inn.legal).toBe(120);
    }
  });

  it("knows who is at the crease before each ball", () => {
    const s = replay.stateAt(226); // start of the 17th over of the chase
    expect(s.inn).toBe(1);
    expect(s.striker).toBe("H Klaasen");
    expect(s.bowler).toBe("HH Pandya");
    expect(s.innings[1].runs).toBe(151);
  });

  it("closes the first innings at the break", () => {
    const s = replay.stateAt(127);
    expect(s.innings[0].done).toBe(true);
    expect(s.inn).toBe(1);
    expect(s.innings[1].legal).toBe(0);
  });
});
