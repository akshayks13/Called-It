/**
 * Measures how well the reader understands real chat messages.
 *
 *   npx tsx --env-file=.env.local scripts/eval-reader.ts          # AI first, as in production
 *   npx tsx scripts/eval-reader.ts --rules                        # built-in rules only
 *
 * Each message has the outcome a careful human would expect. A "call" also
 * lists the sentence the umpire should check. Uses one AI request per message
 * that passes the banter filter, so mind the free quota.
 */
import data from "../data/match.json";
import { buildContext } from "../lib/ai/context";
import { readMessage } from "../lib/ai/read";
import { describeClaim } from "../lib/claims/describe";
import { Replay } from "../lib/match/replay";
import type { MatchData } from "../lib/match/types";

const match = data as unknown as MatchData;
// SA 149/4, three balls into the 16th over. Klaasen 51* and Miller batting, Bumrah bowling.
const ctx = buildContext(match.meta, new Replay(match).stateAt(223));

type Expect = "banter" | "vague" | string[]; // string[] = acceptable checked sentences for a call
const CASES: [string, Expect][] = [
  // plain banter: the umpire must stay silent
  ["what a shot yaar", "banter"],
  ["OUT!!! 🔥", "banter"],
  ["lol Rahul always panics", "banter"],
  ["kya bowling hai Bumrah ki", "banter"],
  ["that was a huge six", "banter"],
  ["bhai chai le aa", "banter"],
  ["who's watching at the office?", "banter"],
  ["Axar ne match hara diya", "banter"],
  ["Klaasen is batting like a beast", "banter"],
  ["I can't watch this", "banter"],
  // clear calls, English
  ["India will win this", ["IND to win"]],
  ["South Africa are winning this easily", ["SA to win"]],
  ["Klaasen gets out this over", ["Klaasen dismissed in the 16th over"]],
  ["wicket next ball, I can feel it", ["at least 1 wicket off the next ball"]],
  ["Bumrah will take a wicket in this over", ["Bumrah at least 1 wicket in the 16th over"]],
  ["Klaasen will make 80", ["Klaasen 80+ runs"]],
  ["Miller stays not out till the end", ["Miller not out at the end of the innings"]],
  ["SA won't cross 170", ["SA 170 or fewer runs total", "SA 169 or fewer runs total"]],
  ["there will be a six in the next over", ["at least 1 six in the 17th over"]],
  ["Hardik gets 2 wickets tonight", ["Hardik 2+ wickets"]],
  // clear calls, Hinglish
  ["India jeetega pakka", ["IND to win"]],
  ["SA harega aaj, likh ke le lo", ["IND to win"]],
  ["klaasen agle over mein out pakka", ["Klaasen dismissed in the 17th over"]],
  ["is over mein wicket girega", ["at least 1 wicket in the 16th over"]],
  ["agli ball pe chakka", ["at least 1 six off the next ball"]],
  ["boom is over mein wicket lega", ["Bumrah at least 1 wicket in the 16th over"]],
  ["SA 175 bhi nahi banayega", ["SA 174 or fewer runs total", "SA 175 or fewer runs total"]],
  ["Miller aaj 30 banayega", ["Miller 30+ runs"]],
  // vague: a prediction, but nothing to check yet
  ["India will play well from here", "vague"],
  ["wicket aayega pakka", "vague"],
  ["Klaasen will get out soon", "vague"],
  ["big over coming", "vague"],
];

// Written after the prompt and rules were tuned on the set above, and not used
// to adjust them. Run with --fresh for an honest read on new phrasings.
const FRESH: [string, Expect][] = [
  ["yeh over 15 run jayega", ["15+ runs in the 16th over"]],
  ["Bumrah isko is over mein nikal dega", ["Klaasen dismissed in the 16th over", "Miller dismissed in the 16th over", "Bumrah at least 1 wicket in the 16th over"]],
  ["mark my words, Miller hits two sixes before this ends", ["Miller 2+ more sixes from here", "Miller 2+ sixes"]],
  ["no way SA lose from here", ["SA to win"]],
  ["Proteas choke karenge, hamesha ki tarah", ["IND to win"]],
  ["next over mein do wicket", ["2+ wickets in the 17th over"]],
  ["Klaasen century maarega aaj", ["Klaasen 100+ runs"]],
  ["SA will get there with an over to spare", "vague"],
  ["Hardik is going to get hammered", "vague"],
  ["umpire ne galat diya tha woh", "banter"],
  ["Rohit ki captaincy bekaar hai", "banter"],
  ["arre yaar kya drop kiya", "banter"],
  ["anyone ordering food?", "banter"],
  ["dot ball next", ["no runs off the next ball"]],
];

const rulesOnly = process.argv.includes("--rules");
const cases = process.argv.includes("--fresh") ? FRESH : CASES;

async function main() {
  const bySource: Record<string, { n: number; ok: number }> = {};
  let ok = 0;
  let banterFlagged = 0;
  const banterTotal = cases.filter(([, e]) => e === "banter").length;

  for (const [text, expected] of cases) {
    const { result, source } = await readMessage(text, ctx, { allowAi: !rulesOnly });
    const got = result.kind === "call" ? describeClaim(result.claim) : result.kind;
    const pass = Array.isArray(expected) ? result.kind === "call" && expected.includes(got) : result.kind === expected;
    if (expected === "banter" && result.kind !== "banter") banterFlagged++;
    if (pass) ok++;
    const s = (bySource[source] ??= { n: 0, ok: 0 });
    s.n++;
    if (pass) s.ok++;
    console.log(`${pass ? "ok  " : "MISS"} [${source.padEnd(6)}] ${text.padEnd(46)} -> ${got}${pass ? "" : `   (expected ${Array.isArray(expected) ? expected[0] : expected})`}`);
    // stay under free-tier requests-per-minute limits
    if (!rulesOnly && source !== "rules") await new Promise((r) => setTimeout(r, 4500));
  }

  console.log(`\n${ok} of ${cases.length} read as expected.`);
  console.log(`Banter wrongly treated as a call or nudge: ${banterFlagged} of ${banterTotal}.`);
  for (const [source, s] of Object.entries(bySource)) console.log(`  handled by ${source}: ${s.ok} of ${s.n}`);
}

main();
