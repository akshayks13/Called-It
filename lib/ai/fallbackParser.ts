/**
 * Rule-based reader. Two jobs:
 *  1. looksLikeCall(): a cheap filter so plain banter never costs an AI request.
 *  2. readWithRules(): understands the common ways fans phrase a call, in
 *     English and Hinglish, so the app keeps working when the AI is unavailable.
 * It is deliberately conservative: when unsure it says "banter".
 */
import { PLAYERS, TEAM_ALIASES, short, teamShort } from "../match/players";
import type { Claim, ClaimWindow } from "../claims/schema";
import { normalizeClaim } from "../claims/schema";
import type { CallOption, ReadContext, ReadResult } from "./context";

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100, century: 100,
  ek: 1, do: 2, teen: 3, chaar: 4, paanch: 5, panch: 5, das: 10, dus: 10, bees: 20, pachaas: 50, sau: 100,
};

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const has = (t: string, re: RegExp) => re.test(t);

function clean(text: string): string {
  return ` ${text.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9+.\s]/g, " ").replace(/\s+/g, " ").trim()} `;
}

function findPlayers(t: string): string[] {
  const found: { id: string; at: number }[] = [];
  let rest = t;
  const entries = Object.entries(PLAYERS)
    .flatMap(([id, p]) => p.aliases.map((a) => ({ id, a })))
    .sort((x, y) => y.a.length - x.a.length);
  for (const { id, a } of entries) {
    const m = new RegExp(`\\s${esc(a)}(s|ne|ko|ka|ki)?\\s`).exec(rest);
    if (m && !found.some((f) => f.id === id)) {
      found.push({ id, at: m.index });
      rest = rest.replace(m[0], " ".repeat(m[0].length));
    }
  }
  return found.sort((x, y) => x.at - y.at).map((f) => f.id);
}

function findTeams(t: string, teams: string[]): string[] {
  const found: { team: string; at: number }[] = [];
  for (const team of teams) {
    for (const a of TEAM_ALIASES[team] ?? [team.toLowerCase()]) {
      const m = new RegExp(`\\s${esc(a)}(s|ne|ko|ka|ki)?\\s`).exec(t);
      if (m) {
        found.push({ team, at: m.index });
        break;
      }
    }
  }
  return found.sort((x, y) => x.at - y.at).map((f) => f.team);
}

// Words that usually mean a prediction is being made
const STRONG =
  /\s(wickets?|wkts?|out|six|sixes|sixer|fours?|chauka|chakka|chhakka|boundary|boundaries|win|wins|won|winning|losing|jeet\w*|jit\w*|haar\w*|harega|haregi|lose|loses|pakka|all ?out|maiden|chase\w*|defend\w*|fifty|century|hundred|choke\w*|hat ?trick|duck|not out|big over|bada over|dot|dots)\s/;
// Words that only matter next to a number ("15 runs this over")
const WEAK = /\s(overs?|balls?|gend|runs?|total|score|powerplay|plus)\s/;
// Signs the sentence is about what happens next, not what just happened
const FUTURE =
  /\s(will|wont|won t|gonna|going to|ll|hoga|hogi|honge|next|agl[aie]|agle|abhi|sure|surely|definitely|guarantee\w*|bet|calling|mark my words|likh\w*|this over|is over|iss over|this ball|is ball|by|before|till|\w{2,}(ega|egi|enge|unga|oge))\s/;

/**
 * Could this message contain a prediction at all? If not it is banter and never
 * reaches the AI, which is what keeps the app inside a small free quota.
 */
export function looksLikeCall(text: string, ctx: ReadContext): boolean {
  const t = clean(text);
  const words = t.trim().split(" ").filter(Boolean);
  if (words.length === 0 || t.trim().length < 3) return false;

  const digit = /\d/.test(t);
  const strong = STRONG.test(t);
  const future = FUTURE.test(t);
  const named = findPlayers(t).length > 0 || findTeams(t, ctx.teams).length > 0;
  if (/\s(big|bada) over (coming|aayega|hoga)\s/.test(t)) return true;

  // "that was a huge six", "kya shot tha": talking about what already happened
  if (!future && !digit && /\s(was|were|what a|that was|did|just|tha|thi)\s/.test(t)) return false;
  // "OUT!!", "what a six": a reaction to the last ball, not a call
  if (words.length <= 3 && !digit && !future && !(named && strong)) return false;
  if (strong) return true;
  if (digit && (named || future || WEAK.test(t))) return true;
  return named && future;
}

function numbers(t: string): number[] {
  const out: number[] = [];
  for (const m of t.matchAll(/\s(\d{1,3})(?=\+|\s|st|nd|rd|th)/g)) out.push(Number(m[1]));
  return out;
}

/** Work out which stretch of play the message is about, and strip it from the text. */
function findWindow(t: string, ctx: ReadContext): { window?: ClaimWindow; rest: string } {
  let m: RegExpExecArray | null;
  const cut = (mm: RegExpExecArray) => t.replace(mm[0], " ");

  if ((m = /\s(ball|delivery|gend)\snext\s/.exec(t))) return { window: { type: "balls", balls: 1 }, rest: cut(m) };
  if ((m = /\s(next|agl[aie]|agle)\s(\d+)\s(balls?|deliver\w+|gend\w*)\s/.exec(t))) return { window: { type: "balls", balls: Number(m[2]) }, rest: cut(m) };
  if ((m = /\s(next|agl[aie]|agle|is|iss|this|ye|yeh|isi)\s(ball|delivery|gend)\s/.exec(t))) return { window: { type: "balls", balls: 1 }, rest: cut(m) };
  if ((m = /\s(next|agl[aie]|agle|within|in|andar)\s(\d+|two|three|do|teen)\s(overs?)(\s(mein|me|ke andar))?\s/.exec(t))) {
    const n = Number(m[2]) || NUMBER_WORDS[m[2]] || 2;
    return { window: { type: "by_over", over: Math.min(20, ctx.over + n - 1) }, rest: cut(m) };
  }
  if ((m = /\s(last|final|aakhri|akhri|20th)\sover(\smein|\sme)?\s/.exec(t))) return { window: { type: "over", over: 20 }, rest: cut(m) };
  if ((m = /\s(next|agl[aie]|agle)\sover(\smein|\sme)?\s/.exec(t))) {
    return { window: { type: "over", over: Math.min(20, ctx.ballsIntoOver === 0 ? ctx.over : ctx.over + 1) }, rest: cut(m) };
  }
  if ((m = /\s(this|is|iss|isi|current|ye|yeh)\sover(\smein|\sme)?\s/.exec(t))) return { window: { type: "over", over: ctx.over }, rest: cut(m) };
  if ((m = /\s(by|after|till|until|before)\s(\d{1,2})\s?(overs?|ov)\s/.exec(t))) return { window: { type: "by_over", over: Number(m[2]) }, rest: cut(m) };
  if ((m = /\s(\d{1,2})\s?overs?\s(tak|mein|me)\s/.exec(t))) return { window: { type: "by_over", over: Number(m[1]) }, rest: cut(m) };
  if ((m = /\s(\d{1,2})(st|nd|rd|th)\sover(\smein|\sme)?\s/.exec(t))) return { window: { type: "over", over: Number(m[1]) }, rest: cut(m) };
  if ((m = /\sover\s(\d{1,2})(\smein|\sme)?\s/.exec(t))) return { window: { type: "over", over: Number(m[1]) }, rest: cut(m) };
  if ((m = /\s(in the\s)?power ?play(\smein|\sme)?\s/.exec(t))) return { window: { type: "by_over", over: 6 }, rest: cut(m) };
  if ((m = /\s(before this ends|till the end|by the end|this innings)\s/.exec(t))) return { window: { type: "innings" }, rest: cut(m) };
  return { rest: t };
}

const NEGATIVE = /\s(not|wont|won t|cant|cannot|no|never|nahi|nahin|nhi|nai|under|below|less than|se kam|fewer)\s/;
const WIN = /\s(win|wins|winning|won|jeet\w*|jit\w*|chase kar\w*|chase ho\w*|chases?|defend\w*|lift\w*|champions?)\s/;
const LOSE = /\s(lose|loses|losing|lost|haar\w*|harega|haregi|har gaya|choke\w*|bottle\w*|gaya|gayi|finished|khatam)\s/;
const OUT = /\s(out|gone|wicket|dismissed|departs?|udega|bowled|caught|lbw|stumped|niklega|nikal dega)\s/;
const WICKET = /\s(wickets?|wkts?|strike|strikes|breakthrough|girega|giregi)\s/;
const SIX = /\s(six|sixes|sixer|sixers|chakka|chhakka|chakke|maximum)\s/;
const FOUR = /\s(four|fours|chauka|chauke)\s/;
const BOUNDARY = /\s(boundary|boundaries)\s/;

const option = (text: string, claim: Claim): CallOption => ({ text, claim: normalizeClaim(claim) });

/** Best effort at reading a message without AI. */
export function readWithRules(text: string, ctx: ReadContext): ReadResult {
  const t0 = clean(text);
  if (!looksLikeCall(text, ctx)) return { kind: "banter" };

  const { window, rest } = findWindow(t0, ctx);
  let t = rest;
  for (const [w, n] of Object.entries(NUMBER_WORDS)) {
    // "six"/"four" are shots, not counts, unless followed by a unit
    if (w === "six" || w === "four") continue;
    t = t.replace(new RegExp(`\\s${w}\\s`, "g"), ` ${n} `);
  }
  t = t.replace(/\shalf 100\s/, " 50 ");

  const players = findPlayers(t);
  const teams = findTeams(t, ctx.teams);
  const nums = numbers(t);
  const negative = has(t, NEGATIVE);
  const other = (team: string) => (team === ctx.teams[0] ? ctx.teams[1] : ctx.teams[0]);
  const call = (claim: Claim): ReadResult => ({ kind: "call", claim: normalizeClaim(claim) });
  const overNow: ClaimWindow = { type: "over", over: ctx.over };

  // --- who wins ---
  if (teams.length && (has(t, WIN) || has(t, LOSE)) && !players.length) {
    const team = teams[0];
    const wins = has(t, WIN) ? !negative : negative;
    return call({ metric: "match_winner", team: wins ? team : other(team), op: "eq", value: 1, window: { type: "match" }, basis: "total" });
  }

  // --- a named player ---
  if (players.length) {
    const id = players[0];
    const info = PLAYERS[id];
    const batting = info.team === ctx.battingTeam;
    const small = nums.find((n) => n >= 1 && n <= 6);

    if (!batting && info.bowls && window && ctx.striker && has(t, /\s(isko|him|he)\s/) && has(t, /\s(nikal dega|dismiss\w*|out|gone)\s/)) {
      return call({ metric: "batter_out", player: ctx.striker, op: "eq", value: 1, window, basis: "window" });
    }

    if (has(t, /\s(hammered|smashed|expensive)\s/)) {
      return {
        kind: "vague",
        nudge: "How many runs? Give the umpire a number to check.",
        options: [option(`${info.short} concedes 12 this over`, { metric: "bowler_runs_conceded", player: id, op: "gte", value: 12, window: window ?? overNow, basis: "window" })],
      };
    }

    if (!batting && info.bowls && (has(t, WICKET) || has(t, OUT) || has(t, /\s(lega|legi|le ga|hat ?trick)\s/))) {
      const n = has(t, /\shat ?trick\s/) ? 3 : (small ?? 1);
      if (window) return call({ metric: "bowler_wickets", player: id, op: negative ? "eq" : "gte", value: negative ? 0 : n, window, basis: "window" });
      // "Bumrah wicket lega" while he is bowling means this over; "2 wickets" is a bigger claim than one over
      if (ctx.bowler === id && n === 1) return call({ metric: "bowler_wickets", player: id, op: negative ? "eq" : "gte", value: negative ? 0 : n, window: overNow, basis: "window" });
      // "takes a wicket" means one more from here; "gets 3 tonight" means his final figures
      return call({ metric: "bowler_wickets", player: id, op: negative ? "eq" : "gte", value: negative ? 0 : n, window: { type: "innings" }, basis: n === 1 ? "window" : "total" });
    }

    if (batting) {
      if (has(t, SIX) || has(t, FOUR) || has(t, BOUNDARY)) {
        const metric = has(t, SIX) ? "batter_sixes" : has(t, FOUR) ? "batter_fours" : "batter_boundaries";
        const n = small ?? 1;
        return call({ metric, player: id, op: negative ? "eq" : "gte", value: negative ? 0 : n, window: window ?? overNow, basis: "window" });
      }
      const target = nums.find((n) => n >= 10 && n <= 250);
      if (target != null && !has(t, /\s(not out|naabaad)\s/)) {
        const under = negative || has(t, /\s(se pehle|before|short of)\s/);
        return call({ metric: "batter_runs", player: id, op: under ? "lte" : "gte", value: under ? target - 1 : target, window: window ?? { type: "innings" }, basis: "total" });
      }
      if (has(t, /\s(not out|naabaad|finish\w*|khatam karega|end tak|till the end|stays?|tikega)\s/) || (has(t, OUT) && negative)) {
        return call({ metric: "batter_out", player: id, op: "eq", value: 0, window: window ?? { type: "innings" }, basis: "window" });
      }
      if (has(t, OUT)) {
        if (window) return call({ metric: "batter_out", player: id, op: "eq", value: 1, window, basis: "window" });
        const soon = Math.min(20, ctx.over + 1);
        return {
          kind: "vague",
          nudge: `By when? "${info.short} out" needs a deadline to be checked.`,
          options: [
            option(`${info.short} out this over`, { metric: "batter_out", player: id, op: "eq", value: 1, window: overNow, basis: "window" }),
            option(`${info.short} out by over ${soon}`, { metric: "batter_out", player: id, op: "eq", value: 1, window: { type: "by_over", over: soon }, basis: "window" }),
          ],
        };
      }
    }
    return { kind: "banter" };
  }

  // --- nobody named: the innings in progress ---
  const team = teams[0] ?? ctx.battingTeam;
  const small = nums.find((n) => n >= 1 && n <= 6);

  if (has(t, /\s(dot|dots|maiden)\s/)) {
    if (window || has(t, /\smaiden\s/)) return call({ metric: "innings_runs", team, op: "eq", value: 0, window: window ?? overNow, basis: "window" });
  }

  if (has(t, /\s(big over|bada over)\s/)) {
    return { kind: "vague", nudge: "How many runs make it a big over?", options: [12, 18].map((value) => option(`${value} runs this over`, { metric: "innings_runs", team, op: "gte", value, window: overNow, basis: "window" })) };
  }

  if (teams.length && has(t, /\s(with an over to spare|with \d+ (balls?|overs?) to spare)\s/)) {
    return { kind: "vague", nudge: "I can check the winner. Want to call that?", options: [option(`${teamShort(team)} to win`, { metric: "match_winner", team, op: "eq", value: 1, window: { type: "match" }, basis: "total" })] };
  }

  if (has(t, /\sall ?out\s/)) {
    return call({ metric: "innings_wickets", team, op: negative ? "lte" : "gte", value: negative ? 9 : 10, window: { type: "innings" }, basis: "total" });
  }
  if (has(t, SIX) || has(t, FOUR) || has(t, BOUNDARY)) {
    const metric = has(t, SIX) ? "innings_sixes" : has(t, FOUR) ? "innings_fours" : "innings_boundaries";
    const noun = has(t, SIX) ? "six" : has(t, FOUR) ? "four" : "boundary";
    if (window) return call({ metric, team: ctx.battingTeam, op: negative ? "eq" : "gte", value: negative ? 0 : (small ?? 1), window, basis: "window" });
    return {
      kind: "vague",
      nudge: `When? Give the ${noun} a deadline.`,
      options: [
        option(`${noun} next ball`, { metric, team: ctx.battingTeam, op: "gte", value: 1, window: { type: "balls", balls: 1 }, basis: "window" }),
        option(`${noun} this over`, { metric, team: ctx.battingTeam, op: "gte", value: 1, window: overNow, basis: "window" }),
      ],
    };
  }
  if (has(t, WICKET) || has(t, OUT)) {
    if (window) return call({ metric: "innings_wickets", team: ctx.battingTeam, op: negative ? "eq" : "gte", value: negative ? 0 : (small ?? 1), window, basis: "window" });
    return {
      kind: "vague",
      nudge: "When? A wicket needs a deadline to be checked.",
      options: [
        option("wicket this over", { metric: "innings_wickets", team: ctx.battingTeam, op: "gte", value: 1, window: overNow, basis: "window" }),
        option("wicket next ball", { metric: "innings_wickets", team: ctx.battingTeam, op: "gte", value: 1, window: { type: "balls", balls: 1 }, basis: "window" }),
      ],
    };
  }
  if (has(t, /\smaiden\s/)) {
    return call({ metric: "innings_runs", team: ctx.battingTeam, op: "eq", value: 0, window: window ?? overNow, basis: "window" });
  }

  // runs in a short window: "15 runs this over"
  const runsN = nums.find((n) => n >= 1 && n <= 300);
  if (runsN != null && window && (window.type === "over" || window.type === "balls")) {
    return call({ metric: "innings_runs", team: ctx.battingTeam, op: negative ? "lte" : "gte", value: negative ? runsN - 1 : runsN, window, basis: "window" });
  }
  // team total: "200 pakka", "SA 160 bhi nahi banayega", "India 100 by 12 overs"
  const total = nums.find((n) => n >= 40 && n <= 320);
  if (total != null) {
    return call({ metric: "innings_runs", team, op: negative ? "lte" : "gte", value: negative ? total - 1 : total, window: window ?? { type: "innings" }, basis: "total" });
  }

  if (teams.length && has(t, /\s(play well|khelega|accha|acha|strong|dominate\w*|on top|crush\w*|destroy\w*)\s/)) {
    return {
      kind: "vague",
      nudge: "Too vague for the third umpire. Pick something that can be checked:",
      options: [option(`${teamShort(team)} to win`, { metric: "match_winner", team, op: "eq", value: 1, window: { type: "match" }, basis: "total" })],
    };
  }
  return { kind: "banter" };
}

/** Two or three ready-made calls for the moment, shown as chips above the keyboard. */
export function suggestCalls(ctx: ReadContext): string[] {
  const out: string[] = [];
  if (ctx.striker) out.push(`${short(ctx.striker)} out this over`);
  if (ctx.bowler) out.push(`${short(ctx.bowler)} wicket this over`);
  out.push(ctx.over >= 16 ? "six next ball" : "12 runs this over");
  if (ctx.innings === 2) out.push(`${teamShort(ctx.bowlingTeam)} jeetega`);
  return out;
}
