import { ProviderError } from "./gemini";

const BASE = "https://api.groq.com/openai/v1";
let model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
let modelChecked = false;

export const groqConfigured = () => !!process.env.GROQ_API_KEY;

const headers = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` });

/** Model names change; if ours is gone, pick a current general-purpose one. */
async function pickAvailableModel(): Promise<void> {
  modelChecked = true;
  const res = await fetch(`${BASE}/models`, { headers: headers(), signal: AbortSignal.timeout(5000) });
  if (!res.ok) return;
  const ids: string[] = ((await res.json()).data ?? []).map((m: { id: string }) => m.id);
  const chat = ids.filter((id) => !/whisper|tts|guard|embed|speech|vision/i.test(id));
  model = chat.find((id) => /70b|versatile/i.test(id)) ?? chat.find((id) => /llama/i.test(id)) ?? chat[0] ?? model;
}

/** Backup provider (OpenAI-compatible API). Used only when Gemini refuses. */
export async function groqGenerate(system: string, user: string, shapeHint: string, timeoutMs = 7000): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: headers(),
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 700,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `${system}\n\n${shapeHint}` },
          { role: "user", content: user },
        ],
      }),
    });
    if (res.ok) {
      const text = (await res.json()).choices?.[0]?.message?.content;
      if (!text) throw new ProviderError("groq: empty response", 502);
      return text;
    }
    if ((res.status === 404 || res.status === 400) && !modelChecked) {
      await pickAvailableModel();
      continue;
    }
    throw new ProviderError(`groq ${model}: ${res.status} ${(await res.text()).slice(0, 200)}`, res.status);
  }
  throw new ProviderError("groq: no usable model", 404);
}
