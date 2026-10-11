/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Learns the simulator's ball-outcome rates from Cricsheet men's T20Is.
 * Only matches before the replayed match are used, so nothing leaks from it.
 *
 * Usage: npx tsx scripts/build-rates.ts <dir-of-cricsheet-t20-json> [cutoff-date]
 * Writes data/rates.json.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { PLAYERS } from "../lib/match/players";

const dir = process.argv[2];
const cutoff = process.argv[3] ?? "2024-06-29";
const since = "2019-01-01";
if (!dir) {
  console.error("usage: build-rates.ts <dir> [cutoff-date]");
  process.exit(1);
}

const FULL_MEMBERS = new Set([
  "Afghanistan", "Australia", "Bangladesh", "England", "India", "Ireland",
  "New Zealand", "Pakistan", "South Africa", "Sri Lanka", "West Indies", "Zimbabwe",
]);
const NOT_BOWLERS = new Set(["run out", "retired hurt", "retired out", "retired not out", "obstructing the field", "timed out"]);
const phaseOf = (over: number) => (over < 6 ? "pp" : over < 15 ? "mid" : "death");
const OUTCOMES = ["0", "1", "2", "3", "4", "6", "W"] as const;

type Tally = Record<string, number>;
const phases: Record<string, Tally> = { pp: {}, mid: {}, death: {} };
const deliveries: Record<string, { all: number; extra: number }> = { pp: { all: 0, extra: 0 }, mid: { all: 0, extra: 0 }, death: { all: 0, extra: 0 } };
const global = { legal: 0, boundaries: 0, outs: 0, bowlRuns: 0, bowlWkts: 0 };
const bat: Record<string, { balls: number; boundaries: number; outs: number }> = {};
const bowl: Record<string, { balls: number; runs: number; wkts: number }> = {};
let matches = 0;

for (const f of readdirSync(dir)) {
  if (!f.endsWith(".json")) continue;
  const m: any = JSON.parse(readFileSync(join(dir, f), "utf8"));
  const date: string = m.info.dates[0];
  if (date >= cutoff) continue;
  const topTier = m.info.teams.every((t: string) => FULL_MEMBERS.has(t)) && date >= since;
  if (topTier) matches++;

  for (const inn of (m.innings ?? []).slice(0, 2)) {
    for (const over of inn.overs ?? []) {
      const ph = phaseOf(over.over);
      for (const d of over.deliveries) {
        const ex = d.extras ?? {};
        const legal = !ex.wides && !ex.noballs;
        const w = d.wickets?.[0];
        const boundary = !d.runs.non_boundary && (d.runs.batter === 4 || d.runs.batter === 6);

        // league-wide rates: recent matches between full members only
        if (topTier) {
          deliveries[ph].all++;
          if (!legal) deliveries[ph].extra++;
          else {
            const key = w ? "W" : String(Math.min(6, d.runs.total === 5 ? 4 : d.runs.total));
            phases[ph][key] = (phases[ph][key] ?? 0) + 1;
            global.legal++;
            if (boundary) global.boundaries++;
            if (w) global.outs++;
            global.bowlRuns += d.runs.total - (ex.byes ?? 0) - (ex.legbyes ?? 0);
            if (w && !NOT_BOWLERS.has(w.kind)) global.bowlWkts++;
          }
        }

        // player form: every T20I they played before the cutoff
        if (PLAYERS[d.batter] && !ex.wides) {
          const b = (bat[d.batter] ??= { balls: 0, boundaries: 0, outs: 0 });
          b.balls++;
          if (boundary) b.boundaries++;
        }
        if (w && PLAYERS[w.player_out]) (bat[w.player_out] ??= { balls: 0, boundaries: 0, outs: 0 }).outs++;
        if (PLAYERS[d.bowler]) {
          const b = (bowl[d.bowler] ??= { balls: 0, runs: 0, wkts: 0 });
          if (legal) b.balls++;
          b.runs += d.runs.total - (ex.byes ?? 0) - (ex.legbyes ?? 0);
          if (w && !NOT_BOWLERS.has(w.kind)) b.wkts++;
        }
      }
    }
  }
}

const round = (n: number) => Math.round(n * 10000) / 10000;
const phaseRates: Record<string, Record<string, number>> = {};
for (const ph of Object.keys(phases)) {
  const total = OUTCOMES.reduce((a, k) => a + (phases[ph][k] ?? 0), 0);
  phaseRates[ph] = Object.fromEntries(OUTCOMES.map((k) => [k, round((phases[ph][k] ?? 0) / total)]));
  phaseRates[ph].extra = round(deliveries[ph].extra / deliveries[ph].all);
}

const gBoundary = global.boundaries / global.legal;
const gOut = global.outs / global.legal;
const gEcon = global.bowlRuns / global.legal;
const gWkt = global.bowlWkts / global.legal;

// Shrink each player's rate toward a prior so a small sample can't run wild.
// Specialist bowlers get a tail-ender prior when they bat.
const shrink = (hits: number, n: number, priorRate: number, k: number) => (hits + priorRate * k) / (n + k);
const batters: Record<string, { boundary: number; out: number; balls: number }> = {};
const bowlers: Record<string, { econ: number; wkt: number; balls: number }> = {};
for (const id of Object.keys(PLAYERS)) {
  const tail = PLAYERS[id].role === "bowl";
  const b = bat[id] ?? { balls: 0, boundaries: 0, outs: 0 };
  batters[id] = {
    boundary: round(shrink(b.boundaries, b.balls, gBoundary * (tail ? 0.55 : 1), 150) / gBoundary),
    out: round(shrink(b.outs, b.balls, gOut * (tail ? 1.8 : 1), 250) / gOut),
    balls: b.balls,
  };
  const w = bowl[id];
  if (w) {
    bowlers[id] = {
      econ: round(shrink(w.runs, w.balls, gEcon, 200) / gEcon),
      wkt: round(shrink(w.wkts, w.balls, gWkt, 300) / gWkt),
      balls: w.balls,
    };
  }
}

const out = resolve(__dirname, "../data/rates.json");
writeFileSync(
  out,
  JSON.stringify(
    {
      note: `Learned from ${matches} men's T20Is between full members, ${since} to ${cutoff} (exclusive). Player factors use each player's T20Is before ${cutoff}. Source: Cricsheet.`,
      matches,
      phases: phaseRates,
      batters,
      bowlers,
    },
    null,
    1,
  ),
);
console.log(`wrote ${out} from ${matches} matches`);
console.log(phaseRates);
console.log({ gBoundary: round(gBoundary), gOut: round(gOut), gEcon: round(gEcon * 6), gWkt: round(gWkt) });
console.log(batters);
console.log(bowlers);
