import type { Claim } from "../claims/schema";
import { PLAYERS, teamShort } from "../match/players";
import type { Call } from "./room";

/** Which team a call is "for", so we can show who a fan backs with their heart. */
export function favours(claim: Claim, teams: [string, string]): string | null {
  const other = (t: string) => (t === teams[0] ? teams[1] : teams[0]);
  const up = claim.op !== "lte" && !(claim.op === "eq" && claim.value === 0);
  if (claim.metric === "match_winner") return claim.team ?? null;
  if (claim.player) {
    const team = PLAYERS[claim.player]?.team;
    if (!team) return null;
    if (claim.metric === "batter_out") return claim.value >= 1 ? other(team) : team;
    if (claim.metric === "bowler_runs_conceded") return up ? other(team) : team;
    return up ? team : other(team);
  }
  if (!claim.team) return null;
  if (claim.metric === "innings_wickets") return up ? other(claim.team) : claim.team;
  return up ? claim.team : other(claim.team);
}

export interface PunditStats {
  made: number;
  hits: number;
  misses: number;
  points: number;
  accuracy: number;
  boldestHit?: Call;
  worstMiss?: Call;
  /** per team: calls that backed them, and how many were right */
  lean: { team: string; n: number; hits: number }[];
}

export function punditStats(calls: Call[], teams: [string, string]): PunditStats {
  const done = calls.filter((c) => c.status === "hit" || c.status === "miss");
  const hits = done.filter((c) => c.status === "hit");
  const misses = done.filter((c) => c.status === "miss");
  const lean = teams.map((team) => {
    const backed = done.filter((c) => favours(c.claim, teams) === team);
    return { team, n: backed.length, hits: backed.filter((c) => c.status === "hit").length };
  });
  return {
    made: done.length,
    hits: hits.length,
    misses: misses.length,
    points: done.reduce((a, c) => a + (c.settled?.points ?? 0), 0),
    accuracy: done.length ? hits.length / done.length : 0,
    boldestHit: [...hits].sort((a, b) => a.p - b.p)[0],
    worstMiss: [...misses].sort((a, b) => b.p - a.p)[0],
    lean,
  };
}

export interface Verdict {
  title: string;
  verdict: string;
}

/** Pundit Card text written by rules, used when the AI write-up is unavailable. */
export function fallbackVerdict(st: PunditStats): Verdict {
  if (st.made === 0) return { title: "The Silent Spectator", verdict: "No calls on record. The third umpire had nothing to review. Next match, say it out loud." };
  const heart = [...st.lean].sort((a, b) => b.n - a.n)[0];
  const heartLine =
    heart && heart.n >= 2
      ? ` You backed ${teamShort(heart.team)} ${heart.n} times and were right ${heart.hits === heart.n ? "every time" : `${heart.hits} time${heart.hits === 1 ? "" : "s"}`}.`
      : "";
  if (st.boldestHit && st.boldestHit.p < 0.15) {
    return { title: "The Oracle", verdict: `You said "${st.boldestHit.text}" when almost nobody would have, and it happened. That is a receipt worth framing.${heartLine}` };
  }
  if (st.accuracy >= 0.6) return { title: "The Sharp One", verdict: `${st.hits} of ${st.made} right. You read this match better than most commentators.${heartLine}` };
  if (st.accuracy <= 0.25 && st.made >= 3) return { title: "The Reverse Oracle", verdict: `${st.hits} of ${st.made} right. Your friends should hear your calls and do the opposite.${heartLine}` };
  return { title: "The Armchair Pundit", verdict: `${st.hits} of ${st.made} right, ${st.points} points. Loud, proud and occasionally correct.${heartLine}` };
}
