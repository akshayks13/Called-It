/**
 * Best-effort request limits, kept in memory. On serverless hosting each
 * instance has its own copy, so this slows abuse rather than preventing it;
 * the hard ceiling is the provider's own quota.
 */
const WINDOW_MS = 60_000;
const perIp = new Map<string, { n: number; resetAt: number; day: number; dayResetAt: number }>();

const num = (v: string | undefined, fallback: number) => (v && Number.isFinite(Number(v)) ? Number(v) : fallback);
const PER_MINUTE = num(process.env.AI_PER_MINUTE, 12);
const PER_DAY = num(process.env.AI_PER_DAY_PER_VISITOR, 60);

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

/** True if this visitor may use an AI request right now. Counts the request. */
export function allowAi(ip: string, now = Date.now()): boolean {
  if (perIp.size > 5000) perIp.clear();
  let e = perIp.get(ip);
  if (!e) perIp.set(ip, (e = { n: 0, resetAt: now + WINDOW_MS, day: 0, dayResetAt: now + 86_400_000 }));
  if (now > e.resetAt) {
    e.n = 0;
    e.resetAt = now + WINDOW_MS;
  }
  if (now > e.dayResetAt) {
    e.day = 0;
    e.dayResetAt = now + 86_400_000;
  }
  if (e.n >= PER_MINUTE || e.day >= PER_DAY) return false;
  e.n++;
  e.day++;
  return true;
}
