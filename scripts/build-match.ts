/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Cricsheet match JSON -> data/match.json (trimmed, flat list of balls).
 * Usage: npx tsx scripts/build-match.ts <path-to-cricsheet-match.json>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Ball, InnIdx, MatchData } from "../lib/match/types";

const src = process.argv[2];
if (!src) {
  console.error("usage: build-match.ts <cricsheet-match.json>");
  process.exit(1);
}

const raw: any = JSON.parse(readFileSync(src, "utf8"));
const info = raw.info;

const balls: Ball[] = [];
raw.innings.slice(0, 2).forEach((inn: any, innIdx: number) => {
  for (const over of inn.overs) {
    let legalInOver = 0;
    for (const d of over.deliveries) {
      const ex = d.extras ?? {};
      const wide = ex.wides ?? 0;
      const noball = ex.noballs ?? 0;
      const legal = !wide && !noball;
      const boundary = !d.runs.non_boundary;
      const w = d.wickets?.[0];
      balls.push({
        i: balls.length,
        inn: innIdx as InnIdx,
        over: over.over,
        label: `${over.over}.${legalInOver + 1}`,
        batter: d.batter,
        bowler: d.bowler,
        nonStriker: d.non_striker,
        runsBat: d.runs.batter,
        total: d.runs.total,
        wide,
        noball,
        bye: ex.byes ?? 0,
        legbye: ex.legbyes ?? 0,
        legal,
        four: boundary && d.runs.batter === 4,
        six: boundary && d.runs.batter === 6,
        ...(w
          ? {
              wicket: {
                playerOut: w.player_out,
                kind: w.kind,
                fielders: (w.fielders ?? []).map((f: any) => f.name).filter(Boolean),
              },
            }
          : {}),
      });
      if (legal) legalInOver++;
    }
  }
});

const teams: [string, string] = [raw.innings[0].team, raw.innings[1].team];
const by = info.outcome?.by ?? {};
const margin = by.runs ? `${by.runs} runs` : by.wickets ? `${by.wickets} wickets` : "";
const winner: string | null = info.outcome?.winner ?? null;

const data: MatchData = {
  meta: {
    title: `${teams[0]} v ${teams[1]}`,
    event: info.event?.name ?? "",
    stage: info.event?.stage ?? "",
    date: info.dates[0],
    venue: info.venue,
    teams,
    squads: info.players,
    result: {
      winner,
      text: winner ? `${winner} won by ${margin}` : (info.outcome?.result ?? "no result"),
    },
    source: "Cricsheet (cricsheet.org)",
  },
  balls,
};

const out = resolve(__dirname, "../data/match.json");
writeFileSync(out, JSON.stringify(data));
console.log(`wrote ${out}: ${balls.length} balls, ${data.meta.title}, ${data.meta.result.text}`);
