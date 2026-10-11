import type { Ball, InnState, MatchData, MatchMeta, MatchState } from "./types";

export const OVERS = 20;
export const BALLS_PER_INNINGS = OVERS * 6;

/** Dismissals that don't count as a wicket falling (innings_wickets) */
const NOT_A_WICKET = new Set(["retired hurt", "retired not out"]);
/** Dismissals not credited to the bowler */
const NOT_BOWLERS = new Set(["run out", "retired hurt", "retired out", "retired not out", "obstructing the field", "timed out"]);

export const countsAsWicket = (b: Ball) => !!b.wicket && !NOT_A_WICKET.has(b.wicket.kind);
export const bowlerGetsWicket = (b: Ball) => !!b.wicket && !NOT_BOWLERS.has(b.wicket.kind);
/** runs charged to the bowler */
export const bowlerRuns = (b: Ball) => b.total - b.bye - b.legbye;

function emptyInnings(team: string, bowlingTeam: string): InnState {
  return { team, bowlingTeam, runs: 0, wickets: 0, legal: 0, fours: 0, sixes: 0, bat: {}, bowl: {}, done: false };
}

export function initialState(meta: MatchMeta): MatchState {
  const [a, b] = meta.teams;
  return {
    idx: 0,
    inn: 0,
    innings: [emptyInnings(a, b), emptyInnings(b, a)],
    striker: null,
    nonStriker: null,
    bowler: null,
    lastBowler: null,
    done: false,
    winner: null,
  };
}

function cloneInnings(i: InnState): InnState {
  const bat: InnState["bat"] = {};
  for (const k in i.bat) bat[k] = { ...i.bat[k] };
  const bowl: InnState["bowl"] = {};
  for (const k in i.bowl) bowl[k] = { ...i.bowl[k] };
  return { ...i, bat, bowl };
}

/** Hand-rolled because the simulator clones thousands of times per estimate. */
export function cloneState(s: MatchState): MatchState {
  return { ...s, innings: [cloneInnings(s.innings[0]), cloneInnings(s.innings[1])] };
}

function batStat(inn: InnState, id: string) {
  return (inn.bat[id] ??= { runs: 0, balls: 0, fours: 0, sixes: 0, out: false });
}

/**
 * Apply one delivery in place. Updates the scorecard and innings/match
 * completion, but not who is on strike next: the replay reads that from the
 * data and the simulator works it out itself.
 */
export function applyBallMut(s: MatchState, b: Ball): void {
  const inn = s.innings[b.inn];
  s.inn = b.inn;
  s.idx++;

  const bat = batStat(inn, b.batter);
  batStat(inn, b.nonStriker);
  if (!b.wide) bat.balls++;
  bat.runs += b.runsBat;
  if (b.four) {
    bat.fours++;
    inn.fours++;
  }
  if (b.six) {
    bat.sixes++;
    inn.sixes++;
  }

  const bowl = (inn.bowl[b.bowler] ??= { legal: 0, runs: 0, wickets: 0 });
  bowl.runs += bowlerRuns(b);
  if (b.legal) bowl.legal++;
  if (bowlerGetsWicket(b)) bowl.wickets++;

  inn.runs += b.total;
  if (b.legal) inn.legal++;
  if (b.wicket) {
    const out = batStat(inn, b.wicket.playerOut);
    out.out = true;
    out.how = b.wicket.kind;
    if (countsAsWicket(b)) inn.wickets++;
  }
  s.lastBowler = b.bowler;

  if (b.inn === 0) {
    if (inn.wickets >= 10 || inn.legal >= BALLS_PER_INNINGS) {
      inn.done = true;
      s.innings[1].target = inn.runs + 1;
    }
  } else {
    const target = inn.target ?? s.innings[0].runs + 1;
    if (inn.runs >= target || inn.wickets >= 10 || inn.legal >= BALLS_PER_INNINGS) {
      inn.done = true;
      s.done = true;
      s.winner = inn.runs >= target ? inn.team : inn.runs === target - 1 ? null : inn.bowlingTeam;
    }
  }
}

/** Point the state at whoever faces the next recorded ball. */
function setUpcoming(s: MatchState, next: Ball | undefined) {
  if (!next) {
    s.striker = s.nonStriker = s.bowler = null;
    return;
  }
  s.striker = next.batter;
  s.nonStriker = next.nonStriker;
  s.bowler = next.bowler;
  if (next.inn !== s.inn || s.idx === 0) {
    // innings break: the scorecard hasn't started but the new innings is "current"
    s.inn = next.inn;
    s.lastBowler = null;
  }
}

/** The recorded match, stepped one ball at a time. */
export class Replay {
  readonly meta: MatchMeta;
  readonly balls: Ball[];

  constructor(data: MatchData) {
    this.meta = data.meta;
    this.balls = data.balls;
  }

  start(): MatchState {
    const s = initialState(this.meta);
    setUpcoming(s, this.balls[0]);
    return s;
  }

  /** New state after the next ball, or null when the match is over. */
  next(s: MatchState): { state: MatchState; ball: Ball } | null {
    const ball = this.balls[s.idx];
    if (!ball) return null;
    const state = cloneState(s);
    applyBallMut(state, ball);
    if (ball.inn === 0 && this.balls[state.idx]?.inn === 1) {
      // Cricsheet ends an innings by running out of balls; make sure it is closed
      state.innings[0].done = true;
      state.innings[1].target = state.innings[0].runs + 1;
    }
    setUpcoming(state, this.balls[state.idx]);
    return { state, ball };
  }

  stateAt(idx: number): MatchState {
    let s = this.start();
    while (s.idx < idx) {
      const n = this.next(s);
      if (!n) break;
      s = n.state;
    }
    return s;
  }
}

// ---- small helpers used by the UI, the reader and the simulator ----

export const oversText = (legal: number) => `${Math.floor(legal / 6)}.${legal % 6}`;

/** 1-based over number the next ball belongs to */
export const currentOverNumber = (s: MatchState) => Math.min(OVERS, Math.floor(s.innings[s.inn].legal / 6) + 1);

export function chase(s: MatchState) {
  const inn = s.innings[1];
  if (s.inn !== 1 || inn.target == null) return null;
  return { need: Math.max(0, inn.target - inn.runs), balls: BALLS_PER_INNINGS - inn.legal, target: inn.target };
}
