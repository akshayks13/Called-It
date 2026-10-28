import { allowAi, clientIp } from "@/lib/ai/limits";
import { askAi } from "@/lib/ai/read";
import { isRecord, readJson } from "@/lib/http";

const SYSTEM = `You are the Third Umpire in a friends' group chat that kept a record of every prediction a fan made during a T20 cricket match. Write that fan's end-of-match "Pundit Card".

Return JSON with:
- "title": a 2 to 4 word nickname that fits how they called the match (e.g. "The Death-Overs Oracle", "Heart Over Head").
- "verdict": 2 or 3 short sentences. Be specific: mention their best or worst call by what it was, and any pattern you can see (always backing one team, bold or cautious, good on bowlers, bad on batters). Warm, cheeky, never mean. Plain English with a touch of Hinglish if their own messages used it. No profanity, nothing about money or betting. At most 60 words.

Only use what is in the data. Do not invent calls or results.`;

const SCHEMA = {
  type: "OBJECT",
  properties: { title: { type: "STRING" }, verdict: { type: "STRING" } },
  required: ["title", "verdict"],
};
const HINT = `Reply with a single JSON object: {"title": string, "verdict": string}.`;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\r\n]+/g, " ").slice(0, max) : "");
const num = (v: unknown, fallback: number) => typeof v === "number" && Number.isFinite(v) ? Math.max(-100_000, Math.min(100_000, Math.round(v))) : fallback;

export async function POST(req: Request) {
  const body = await readJson(req);
  if (!isRecord(body) || !Array.isArray(body.calls) || body.calls.length > 100 || !body.calls.every((c) =>
    isRecord(c) && ["said", "desc", "when", "tier", "backed"].every((key) => typeof c[key] === "string") &&
    (c.result === "hit" || c.result === "miss"),
  )) return Response.json({ error: "bad request" }, { status: 400 });
  if (body.calls.length === 0) return Response.json({ verdict: null });
  if (!allowAi(clientIp(req))) return Response.json({ verdict: null });

  const calls = (body.calls as Record<string, unknown>[]).slice(0, 15).map((c) => ({
    said: str(c.said, 200),
    checked_as: str(c.desc, 120),
    when: str(c.when, 30),
    rated: str(c.tier, 20),
    result: c.result === "hit" ? "right" : "wrong",
    backed: str(c.backed, 20),
  }));
  const user = JSON.stringify({
    fan: str(body.name, 30) || "Fan",
    match_result: str(body.result, 80),
    final_rank: `${num(body.rank, 0)} of ${num(body.of, 4)}`,
    points: num(body.points, 0),
    calls,
  });

  const ai = await askAi(SYSTEM, user, SCHEMA, HINT, (raw) => {
    try {
      const j = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
      const title = str(j.title, 40);
      const verdict = str(j.verdict, 420);
      return title && verdict ? { title, verdict } : null;
    } catch {
      return null;
    }
  });
  return Response.json({ verdict: ai?.value ?? null, source: ai?.source ?? null });
}
