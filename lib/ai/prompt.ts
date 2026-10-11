import { METRICS, OPS, WINDOW_TYPES, normalizeClaim, type Claim, type Metric, type Op, type WindowType } from "../claims/schema";
import { PLAYERS } from "../match/players";
import type { CallOption, ReadContext, ReadResult } from "./context";

/** Static part of the prompt: the job, the claim format, the language notes. */
export function systemPrompt(teams: string[]): string {
  const roster = teams
    .map((team) => {
      const lines = Object.entries(PLAYERS)
        .filter(([, p]) => p.team === team)
        .map(([id, p]) => `  "${id}" = ${p.full} (also: ${p.aliases.slice(0, 4).join(", ")})`);
      return `${team}:\n${lines.join("\n")}`;
    })
    .join("\n");

  return `You are the Third Umpire in a friends' group chat during a live T20 cricket match. Fans chat in English, Hindi or Hinglish. Your only job is to read ONE chat message and decide whether it contains a prediction about this match that can be checked against the ball-by-ball scorecard.

Return JSON only, with "kind" set to one of:
- "banter": not a checkable prediction. Reactions to something that already happened ("what a shot", "OUT!!", "Klaasen gaya"), greetings, jokes, questions, opinions about the past, anything not about this match. If you cannot tell whether a message is about the past or the future, choose banter. If it is clearly about what WILL happen in this match but cannot be checked, that is "vague", not banter.
- "call": a prediction about the future of this match that the scorecard can prove right or wrong. Fill "claim", "if_right", "if_wrong".
- "vague": clearly a prediction, but not checkable as said (no number, or an event with no deadline, e.g. "India will play well", "wicket aayega", "Klaasen will get out"). Fill "nudge" (one short friendly line asking them to pin it down) and exactly 2 "options", each a concrete version with its own "text" (short, in the fan's own style of language) and "claim".

Be faithful. Never make a call bolder or safer than what the fan said. Do not invent numbers or deadlines the fan did not give: that is what "vague" is for. A match result ("India jeetega") and totals or milestones ("200 pakka", "Kohli 50") need no deadline.

CLAIM FIELDS
metric:
  batter_runs, batter_fours, batter_sixes, batter_boundaries (fours+sixes): a batter's figures. Set "player".
  batter_out: value 1 = the batter gets dismissed in the window, value 0 = stays not out through it. Set "player".
  bowler_wickets, bowler_runs_conceded: a bowler's figures. Set "player".
  innings_runs, innings_wickets (wickets LOST by the batting side), innings_fours, innings_sixes, innings_boundaries: the batting side's figures. Set "team" to the BATTING team. Wickets taken by the bowling side are the batting team's innings_wickets.
  match_winner: set "team" to the team predicted to win. "X will lose / choke / harega" means the other team wins.
player: exactly one of the ids in the roster below, or "" if not about one player. Only set a player the fan actually named (by name or nickname, or clearly by "he"/"isko" about the batter on strike). "six next ball" with nobody named is innings_sixes, not a batter's.
team: exactly "${teams[0]}" or "${teams[1]}", or "".
op: "gte" (at least), "lte" (at most), "eq" (exactly). A bare number means at least that many ("15 runs this over", "1 run this over", "2 wickets" are all gte). Use "eq" only when the fan says exactly / only / sirf / bas, or for zero ("no boundary", "maiden").
value: the number. For "under 160" use lte 159. For "won't reach 50" use lte 49. If the fan names an event without a count ("wicket next ball", "six this over"), the value is 1 with op "gte".
window_type:
  "over": one specific over. Set window_over (1-based). For "this over" copy this_over from MATCH RIGHT NOW; for "next over" / "agle over" copy next_over exactly as given (between overs the two are the same number, because the over about to start is the "next" one). "last over" = 20.
  "balls": the next N legal balls from now. Set window_balls. "next ball" = 1.
  "by_over": from now until the end of over N. Set window_over. "in the next 2 overs" = this_over + 1; "in the next N overs" = this_over + N - 1. "by 12 overs" = 12. "in the powerplay" = 6.
  "innings": until the batting innings ends.
  "match": only for match_winner.
basis:
  "window": count only what happens inside the window from now (runs this over, a wicket next ball, "2 more wickets").
  "total": the figure on the scorecard when the window closes (Kohli 50, SA 170, "India 100 by 12 overs", "Bumrah finishes with 3").
Unused fields: "" for strings, 0 for numbers.

HINGLISH NOTES
agla/agle/agli = next. is/iss/yeh = this. "is over mein" = in this over, "agle over mein" = in the next over, "agli ball" = next ball: each of these IS a deadline, so "is over mein wicket girega" is a call, not vague. pakka = for sure. jeetega/jeetegi = will win. harega/haar jayega = will lose. lega = will take. marega/maarega = will hit. chakka/chhakka = six. chauka = four. banega/banayega = will score. nahi/nhi = not. tak = by/until. se pehle = before. se kam = fewer than. gaya = gone: about the past it is banter, but "SA jeet gaya" said while the match is still on is a prediction that SA win.
Nicknames: Boom = Bumrah, King/Virat = Kohli, Hitman = Rohit, SKY/Surya = Suryakumar, Bapu = Axar, Jaddu = Jadeja, QDK/Quinny = de Kock, KG = Rabada.

RECEIPT LINES (for "call" only)
if_right: what you will say if it comes true. if_wrong: what you will say if it does not. Each at most 80 characters, playful, in the fan's own language style (Hinglish if they wrote Hinglish). You are a cheeky but fair umpire. No profanity, no insults about people, nothing about money or betting.

ROSTER (use these exact ids)
${roster}`;
}

export function userPrompt(text: string, ctx: ReadContext): string {
  return `MATCH RIGHT NOW
${JSON.stringify({
    innings: ctx.innings,
    batting: ctx.battingTeam,
    bowling: ctx.bowlingTeam,
    score: ctx.score,
    // spelled out so the model never has to work out which over "next" means
    this_over: ctx.over,
    next_over: ctx.ballsIntoOver === 0 ? ctx.over : Math.min(20, ctx.over + 1),
    balls_into_this_over: ctx.ballsIntoOver,
    on_strike: ctx.striker,
    non_striker: ctx.nonStriker,
    bowler: ctx.bowler,
    batters: ctx.atCrease,
    ...(ctx.target ? { target: ctx.target, need: ctx.need, balls_left: ctx.ballsLeft } : {}),
  })}

CHAT MESSAGE
${JSON.stringify(text)}`;
}

const CLAIM_PROPS = {
  metric: { type: "STRING", enum: [...METRICS] },
  player: { type: "STRING" },
  team: { type: "STRING" },
  op: { type: "STRING", enum: [...OPS] },
  value: { type: "INTEGER" },
  window_type: { type: "STRING", enum: [...WINDOW_TYPES] },
  window_over: { type: "INTEGER" },
  window_balls: { type: "INTEGER" },
  basis: { type: "STRING", enum: ["total", "window"] },
};
const CLAIM_SCHEMA = {
  type: "OBJECT",
  properties: CLAIM_PROPS,
  required: ["metric", "player", "team", "op", "value", "window_type", "window_over", "window_balls", "basis"],
};

/** Response schema in the Gemini API's format */
export const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    kind: { type: "STRING", enum: ["banter", "call", "vague"] },
    claim: CLAIM_SCHEMA,
    if_right: { type: "STRING" },
    if_wrong: { type: "STRING" },
    nudge: { type: "STRING" },
    options: {
      type: "ARRAY",
      items: { type: "OBJECT", properties: { text: { type: "STRING" }, claim: CLAIM_SCHEMA }, required: ["text", "claim"] },
    },
  },
  required: ["kind"],
};

/** The same shape described in words, for providers without schema support */
export const JSON_SHAPE_HINT = `Reply with a single JSON object: {"kind": "banter"|"call"|"vague", "claim": {"metric","player","team","op","value","window_type","window_over","window_balls","basis"}, "if_right": string, "if_wrong": string, "nudge": string, "options": [{"text": string, "claim": {...}}]}. Include "claim", "if_right", "if_wrong" only for "call"; "nudge" and "options" only for "vague".`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toClaim(raw: any, ctx: ReadContext): Claim | null {
  if (!raw || typeof raw !== "object") return null;
  const metric = raw.metric as Metric;
  const op = raw.op as Op;
  const type = raw.window_type as WindowType;
  if (!METRICS.includes(metric) || !OPS.includes(op) || !WINDOW_TYPES.includes(type)) return null;
  const value = Number(raw.value);
  if (!Number.isFinite(value)) return null;

  const claim: Claim = {
    metric,
    op,
    value,
    window: { type, over: Number(raw.window_over) || undefined, balls: Number(raw.window_balls) || undefined },
    basis: raw.basis === "window" ? "window" : "total",
  };
  const needsPlayer = metric.startsWith("batter_") || metric.startsWith("bowler_");
  if (needsPlayer) {
    if (typeof raw.player !== "string" || !PLAYERS[raw.player]) return null;
    claim.player = raw.player;
  } else {
    const team = ctx.teams.find((t) => t === raw.team);
    if (metric === "match_winner" && !team) return null;
    claim.team = team ?? ctx.battingTeam;
  }
  return normalizeClaim(claim);
}

const line = (s: unknown, max: number) => (typeof s === "string" && s.trim() ? s.trim().slice(0, max) : undefined);

/** Turn a model's raw text into a ReadResult, or null if it is not usable. */
export function parseModelOutput(rawText: string, ctx: ReadContext): ReadResult | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let j: any;
  try {
    const start = rawText.indexOf("{");
    const end = rawText.lastIndexOf("}");
    j = JSON.parse(rawText.slice(start, end + 1));
  } catch {
    return null;
  }
  if (j.kind === "banter") return { kind: "banter" };
  if (j.kind === "call") {
    const claim = toClaim(j.claim, ctx);
    if (!claim) return null;
    return { kind: "call", claim, ifRight: line(j.if_right, 120), ifWrong: line(j.if_wrong, 120) };
  }
  if (j.kind === "vague") {
    const options: CallOption[] = [];
    for (const o of Array.isArray(j.options) ? j.options.slice(0, 3) : []) {
      const claim = toClaim(o?.claim, ctx);
      const text = line(o?.text, 60);
      if (claim && text) options.push({ text, claim });
    }
    return { kind: "vague", nudge: line(j.nudge, 160) ?? "Too vague to check. Can you pin it down?", options };
  }
  return null;
}
