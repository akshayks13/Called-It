import type { Claim } from "../claims/schema";
import type { MatchMeta, MatchState } from "../match/types";
import { chase, currentOverNumber, oversText } from "../match/replay";

/** What the reader is told about the moment a message was sent. Small on purpose. */
export interface ReadContext {
  teams: [string, string];
  innings: 1 | 2;
  battingTeam: string;
  bowlingTeam: string;
  score: string;
  /** 1-based number of the over in progress (or about to start) */
  over: number;
  /** legal balls already bowled in that over */
  ballsIntoOver: number;
  striker: string | null;
  nonStriker: string | null;
  bowler: string | null;
  /** batters' current scores, e.g. { "H Klaasen": "49 (22)" } */
  atCrease: Record<string, string>;
  target?: number;
  need?: number;
  ballsLeft?: number;
}

export function buildContext(meta: MatchMeta, s: MatchState): ReadContext {
  const inn = s.innings[s.inn];
  const c = chase(s);
  const atCrease: Record<string, string> = {};
  for (const id of [s.striker, s.nonStriker]) {
    if (!id) continue;
    const b = inn.bat[id];
    atCrease[id] = b ? `${b.runs} (${b.balls})` : "0 (0)";
  }
  return {
    teams: meta.teams,
    innings: (s.inn + 1) as 1 | 2,
    battingTeam: inn.team,
    bowlingTeam: inn.bowlingTeam,
    score: `${inn.team} ${inn.runs}/${inn.wickets} (${oversText(inn.legal)} ov)`,
    over: currentOverNumber(s),
    ballsIntoOver: inn.legal % 6,
    striker: s.striker,
    nonStriker: s.nonStriker,
    bowler: s.bowler,
    atCrease,
    ...(c ? { target: c.target, need: c.need, ballsLeft: c.balls } : {}),
  };
}

export interface CallOption {
  text: string;
  claim: Claim;
}

/** What the reader makes of one chat message. */
export type ReadResult =
  | { kind: "banter" }
  | { kind: "call"; claim: Claim; ifRight?: string; ifWrong?: string }
  | { kind: "vague"; nudge: string; options: CallOption[] };

export type ReadSource = "gemini" | "groq" | "rules";
