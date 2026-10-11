import match from "@/data/match.json";
import type { ReadContext } from "@/lib/ai/context";
import { looksLikeCall } from "@/lib/ai/fallbackParser";
import { allowAi, clientIp } from "@/lib/ai/limits";
import { readMessage } from "@/lib/ai/read";
import { PLAYERS } from "@/lib/match/players";

const TEAMS = match.meta.teams as [string, string];
const player = (v: unknown) => (typeof v === "string" && PLAYERS[v] ? v : null);
const int = (v: unknown, lo: number, hi: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : fallback;

/** Rebuild the context from trusted values so nothing free-form from the client reaches the prompt. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cleanContext(c: any): ReadContext | null {
  if (!c || typeof c !== "object") return null;
  const battingTeam = TEAMS.find((t) => t === c.battingTeam);
  if (!battingTeam) return null;
  const bowlingTeam = TEAMS.find((t) => t !== battingTeam) as string;
  const atCrease: Record<string, string> = {};
  for (const [k, v] of Object.entries(c.atCrease ?? {})) {
    if (player(k) && typeof v === "string" && /^\d{1,3} \(\d{1,3}\)$/.test(v)) atCrease[k] = v;
  }
  const innings = c.innings === 2 ? 2 : 1;
  const ctx: ReadContext = {
    teams: TEAMS,
    innings,
    battingTeam,
    bowlingTeam,
    score: typeof c.score === "string" && /^[A-Za-z ]{2,20} \d{1,3}\/\d{1,2} \(\d{1,2}\.\d ov\)$/.test(c.score) ? c.score : "",
    over: int(c.over, 1, 20, 1),
    ballsIntoOver: int(c.ballsIntoOver, 0, 5, 0),
    striker: player(c.striker),
    nonStriker: player(c.nonStriker),
    bowler: player(c.bowler),
    atCrease,
  };
  if (innings === 2) {
    ctx.target = int(c.target, 1, 400, 0);
    ctx.need = int(c.need, 0, 400, 0);
    ctx.ballsLeft = int(c.ballsLeft, 0, 120, 0);
  }
  return ctx;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 200) : "";
  const ctx = cleanContext(body?.ctx);
  if (!text || !ctx) return Response.json({ error: "bad request" }, { status: 400 });

  // banter never reaches the AI, so it doesn't count against anyone's allowance
  const wantsAi = body?.noAi !== true && looksLikeCall(text, ctx);
  const outcome = await readMessage(text, ctx, { allowAi: wantsAi && allowAi(clientIp(req)) });
  return Response.json(outcome);
}
