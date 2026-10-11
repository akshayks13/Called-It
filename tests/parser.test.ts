import { describe, expect, it } from "vitest";
import data from "../data/match.json";
import { buildContext } from "../lib/ai/context";
import { looksLikeCall, readWithRules } from "../lib/ai/fallbackParser";
import { describeClaim } from "../lib/claims/describe";
import { Replay } from "../lib/match/replay";
import type { MatchData } from "../lib/match/types";

const match = data as unknown as MatchData;
const replay = new Replay(match);
// SA 147/4 after 15 overs: Klaasen and Miller batting, Bumrah about to bowl the 16th
const ctx = buildContext(match.meta, replay.stateAt(220));
// SA 149/4, three balls into the 16th
const mid = buildContext(match.meta, replay.stateAt(223));

const read = (text: string, c = ctx) => {
  const r = readWithRules(text, c);
  return r.kind === "call" ? describeClaim(r.claim) : r.kind;
};

describe("rule-based reader", () => {
  it("lets plain banter through without flagging it", () => {
    for (const t of ["what a shot!", "OUT!!", "lol", "kya maara hai", "gone 🔥", "bhai chai le aa", "who is watching?", "Klaasen is on fire"]) {
      expect(looksLikeCall(t, ctx), t).toBe(false);
      expect(read(t), t).toBe("banter");
    }
  });

  it("reads English calls", () => {
    expect(read("India will win this")).toBe("IND to win");
    expect(read("South Africa wins easily")).toBe("SA to win");
    expect(read("Klaasen out this over")).toBe("Klaasen dismissed in the 16th over");
    expect(read("Bumrah gets a wicket this over")).toBe("Bumrah at least 1 wicket in the 16th over");
    expect(read("wicket next ball")).toBe("at least 1 wicket off the next ball");
    expect(read("six next ball")).toBe("at least 1 six off the next ball");
    expect(read("15 runs this over")).toBe("15+ runs in the 16th over");
    expect(read("Klaasen will get 80")).toBe("Klaasen 80+ runs");
    expect(read("Miller will finish this not out")).toBe("Miller not out at the end of the innings");
    expect(read("SA all out")).toBe("SA all out");
    expect(read("wicket in the last over")).toBe("at least 1 wicket in the 20th over");
  });

  it("reads Hinglish calls", () => {
    expect(read("India jeetega pakka")).toBe("IND to win");
    expect(read("SA harega aaj")).toBe("IND to win");
    expect(read("klaasen agle over mein out pakka")).toBe("Klaasen dismissed in the 16th over");
    expect(read("is over mein wicket girega")).toBe("at least 1 wicket in the 16th over");
    expect(read("agli ball chakka")).toBe("at least 1 six off the next ball");
    expect(read("boom wicket lega is over mein")).toBe("Bumrah at least 1 wicket in the 16th over");
    expect(read("SA 170 nahi banayega")).toBe("SA 169 or fewer runs total");
    expect(read("175 pakka")).toBe("SA 175+ runs total");
  });

  it("knows 'next over' from 'this over' once an over is under way", () => {
    expect(read("Klaasen out this over", mid)).toBe("Klaasen dismissed in the 16th over");
    expect(read("Klaasen out next over", mid)).toBe("Klaasen dismissed in the 17th over");
  });

  it("asks for a deadline instead of inventing one", () => {
    const r = readWithRules("Klaasen will get out", ctx);
    expect(r.kind).toBe("vague");
    if (r.kind === "vague") expect(r.options.length).toBe(2);
    expect(readWithRules("wicket aayega pakka", ctx).kind).toBe("vague");
  });
});
