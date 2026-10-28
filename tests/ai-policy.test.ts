import { afterEach, describe, expect, it, vi } from "vitest";
import { geminiConfigured, geminiGenerate } from "../lib/ai/gemini";
import { groqConfigured, groqGenerate } from "../lib/ai/groq";
import { askAi } from "../lib/ai/read";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("free-by-default AI policy", () => {
  it.each([undefined, "false", "", "TRUE"])("does not use saved keys without explicit opt-in: %s", async (flag) => {
    vi.stubEnv("AI_ENABLED", flag);
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GROQ_API_KEY", "test-key");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(geminiConfigured()).toBe(false);
    expect(groqConfigured()).toBe(false);
    expect(await askAi("test", "test", {}, "test", () => null)).toBeNull();
    await expect(geminiGenerate("test", "test", {})).rejects.toThrow("disabled");
    await expect(groqGenerate("test", "test", "test")).rejects.toThrow("disabled");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("requires both an explicit flag and a provider key", () => {
    vi.stubEnv("AI_ENABLED", "true");
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("GROQ_API_KEY", "");
    expect(geminiConfigured()).toBe(false);
    expect(groqConfigured()).toBe(false);
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    expect(geminiConfigured()).toBe(true);
    expect(groqConfigured()).toBe(false);
  });
});
