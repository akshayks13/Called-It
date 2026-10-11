import { short, teamShort } from "../match/players";
import type { Claim } from "./schema";

const ord = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

function windowText(c: Claim): string {
  const w = c.window;
  switch (w.type) {
    case "over": return ` in the ${ord(w.over ?? 0)} over`;
    case "by_over": return ` by the end of the ${ord(w.over ?? 0)} over`;
    case "balls": return w.balls === 1 ? " off the next ball" : ` in the next ${w.balls} balls`;
    case "innings": return c.basis === "window" && c.metric !== "batter_out" ? " from here" : "";
    default: return "";
  }
}

function amount(c: Claim, one: string, many: string): string {
  const more = c.basis === "window" && c.window.type !== "over" && c.window.type !== "balls" ? " more" : "";
  if (c.op === "gte") return c.value === 1 ? `at least 1${more} ${one}` : `${c.value}+${more} ${many}`;
  if (c.op === "lte" || c.value === 0) return c.value === 0 ? `no${more} ${many}` : `${c.value} or fewer${more} ${many}`;
  return `exactly ${c.value}${more} ${c.value === 1 ? one : many}`;
}

/** One plain sentence that says exactly what will be checked. */
export function describeClaim(c: Claim): string {
  const who = c.player ? short(c.player) : c.team ? teamShort(c.team) : "";
  const win = windowText(c);
  switch (c.metric) {
    case "match_winner": return `${teamShort(c.team ?? "")} to win`;
    case "batter_out": return c.value >= 1 ? `${who} dismissed${win || " this innings"}` : `${who} not out${win || " at the end of the innings"}`;
    case "batter_runs": return `${who} ${amount(c, "run", "runs")}${win}`;
    case "batter_fours": return `${who} ${amount(c, "four", "fours")}${win}`;
    case "batter_sixes": return `${who} ${amount(c, "six", "sixes")}${win}`;
    case "batter_boundaries": return `${who} ${amount(c, "boundary", "boundaries")}${win}`;
    case "bowler_wickets": return `${who} ${amount(c, "wicket", "wickets")}${win}`;
    case "bowler_runs_conceded": return `${who} concedes ${amount(c, "run", "runs")}${win}`;
    case "innings_runs":
      return c.basis === "total" ? `${who} ${amount(c, "run", "runs")}${win || " total"}` : `${amount(c, "run", "runs")}${win}`;
    case "innings_wickets":
      if (c.basis === "total" && c.op !== "lte" && c.value >= 10) return `${who} all out${win}`;
      return c.basis === "total" ? `${who} ${amount(c, "wicket", "wickets")} down${win}` : `${amount(c, "wicket", "wickets")}${win}`;
    case "innings_fours": return `${amount(c, "four", "fours")}${win}${c.basis === "total" ? ` (${who})` : ""}`;
    case "innings_sixes": return `${amount(c, "six", "sixes")}${win}${c.basis === "total" ? ` (${who})` : ""}`;
    case "innings_boundaries": return `${amount(c, "boundary", "boundaries")}${win}${c.basis === "total" ? ` (${who})` : ""}`;
  }
}
