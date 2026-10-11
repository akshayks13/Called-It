export type InnIdx = 0 | 1;

export interface Wicket {
  playerOut: string;
  kind: string;
  fielders: string[];
}

/** One delivery. Field names stay close to Cricsheet's. */
export interface Ball {
  i: number;
  inn: InnIdx;
  /** 0-based over index */
  over: number;
  /** "15.3": completed overs, then the legal ball this delivery is (or is re-bowling) */
  label: string;
  batter: string;
  bowler: string;
  nonStriker: string;
  runsBat: number;
  total: number;
  wide: number;
  noball: number;
  bye: number;
  legbye: number;
  legal: boolean;
  four: boolean;
  six: boolean;
  wicket?: Wicket;
}

export interface MatchMeta {
  title: string;
  event: string;
  stage: string;
  date: string;
  venue: string;
  /** batting order: teams[0] bats first */
  teams: [string, string];
  squads: Record<string, string[]>;
  result: { winner: string | null; text: string };
  source: string;
}

export interface MatchData {
  meta: MatchMeta;
  balls: Ball[];
}

export interface BatStat {
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: boolean;
  how?: string;
}

export interface BowlStat {
  legal: number;
  runs: number;
  wickets: number;
}

export interface InnState {
  team: string;
  bowlingTeam: string;
  runs: number;
  wickets: number;
  legal: number;
  fours: number;
  sixes: number;
  bat: Record<string, BatStat>;
  bowl: Record<string, BowlStat>;
  done: boolean;
  target?: number;
}

export interface MatchState {
  /** balls applied so far */
  idx: number;
  inn: InnIdx;
  innings: [InnState, InnState];
  /** who faces the next ball; null between innings or after the match */
  striker: string | null;
  nonStriker: string | null;
  bowler: string | null;
  lastBowler: string | null;
  done: boolean;
  winner: string | null;
}
