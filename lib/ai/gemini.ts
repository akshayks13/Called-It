export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const MODELS = (process.env.GEMINI_MODELS ?? "gemini-3.5-flash-lite,gemini-3.1-flash-lite")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

export const geminiConfigured = () => !!process.env.GEMINI_API_KEY;

async function call(model: string, system: string, user: string, schema: object | null, timeoutMs: number): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY as string },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 700,
        responseMimeType: "application/json",
        ...(schema ? { responseSchema: schema } : {}),
      },
    }),
  });
  if (!res.ok) throw new ProviderError(`gemini ${model}: ${res.status} ${(await res.text()).slice(0, 200)}`, res.status);
  const json = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const text = (json.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("");
  if (!text) throw new ProviderError(`gemini ${model}: empty response`, 502);
  return text;
}

/**
 * Ask Gemini, trying each configured model in turn. A model that rejects the
 * schema (400) is retried once with plain JSON mode.
 */
export async function geminiGenerate(system: string, user: string, schema: object, timeoutMs = 7000): Promise<string> {
  let last: unknown;
  for (const model of MODELS) {
    try {
      return await call(model, system, user, schema, timeoutMs);
    } catch (e) {
      last = e;
      if (e instanceof ProviderError && e.status === 400) {
        try {
          return await call(model, system, user, null, timeoutMs);
        } catch (e2) {
          last = e2;
        }
      }
      // 401/403: the key itself is wrong, no point trying other models
      if (e instanceof ProviderError && (e.status === 401 || e.status === 403)) break;
    }
  }
  throw last;
}
