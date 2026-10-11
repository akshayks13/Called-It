import type { Claim } from "../claims/schema";
import type { ReadContext, ReadResult, ReadSource } from "./context";
import { looksLikeCall, readWithRules } from "./fallbackParser";
import { geminiConfigured, geminiGenerate } from "./gemini";
import { groqConfigured, groqGenerate } from "./groq";
import { JSON_SHAPE_HINT, parseModelOutput, RESPONSE_SCHEMA, systemPrompt, userPrompt } from "./prompt";

export interface ReadOutcome {
  result: ReadResult;
  source: ReadSource;
}

/**
 * Ask the configured AI providers in order for a JSON reply. Returns the first
 * reply that `parse` accepts, or null if none is configured or all fail.
 */
export async function askAi<T>(
  system: string,
  user: string,
  schema: object,
  shapeHint: string,
  parse: (raw: string) => T | null,
): Promise<{ value: T; source: "gemini" | "groq" } | null> {
  const providers: ["gemini" | "groq", boolean, () => Promise<string>][] = [
    ["gemini", geminiConfigured(), () => geminiGenerate(system, user, schema)],
    ["groq", groqConfigured(), () => groqGenerate(system, user, shapeHint)],
  ];
  for (const [source, configured, generate] of providers) {
    if (!configured) continue;
    try {
      const value = parse(await generate());
      if (value) return { value, source };
      console.warn(`[ai] ${source} returned unusable output`);
    } catch (e) {
      console.warn(`[ai] ${source} failed:`, e instanceof Error ? e.message : e);
    }
  }
  return null;
}

const COUNT_METRICS = new Set(["batter_fours", "batter_sixes", "batter_boundaries", "bowler_wickets", "innings_wickets", "innings_fours", "innings_sixes", "innings_boundaries"]);
const SAYS_A_NUMBER = /\d|\b(two|three|four|five|six|seven|eight|nine|ten|couple|few|double|brace|hat.?trick|do|teen|chaar|paanch|all ?out)\b/i;

/**
 * The model may not invent a count the fan never gave: "wicket next ball" is
 * one wicket, whatever the model says. Checked in code, not left to the prompt.
 */
function keepFaithful(result: ReadResult, text: string): ReadResult {
  const fix = (c: Claim): Claim => (COUNT_METRICS.has(c.metric) && c.op === "gte" && c.value > 1 && !SAYS_A_NUMBER.test(text) ? { ...c, value: 1 } : c);
  if (result.kind === "call") return { ...result, claim: fix(result.claim) };
  return result;
}

/**
 * Read one chat message. Order: free filter, Gemini, backup provider, rules.
 * It always returns something, so the chat never stalls on an AI failure.
 */
export async function readMessage(text: string, ctx: ReadContext, opts: { allowAi?: boolean } = {}): Promise<ReadOutcome> {
  if (!looksLikeCall(text, ctx)) return { result: { kind: "banter" }, source: "rules" };
  if (opts.allowAi !== false) {
    const ai = await askAi(systemPrompt(ctx.teams), userPrompt(text, ctx), RESPONSE_SCHEMA, JSON_SHAPE_HINT, (raw) => parseModelOutput(raw, ctx));
    if (ai) return { result: keepFaithful(ai.value, text), source: ai.source };
  }
  return { result: readWithRules(text, ctx), source: "rules" };
}
