import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as report } from "../app/api/report/route";
import { POST as read } from "../app/api/read-message/route";
import { askAi, readMessage } from "../lib/ai/read";

vi.mock("@/lib/ai/read", () => ({ askAi: vi.fn().mockResolvedValue(null), readMessage: vi.fn().mockResolvedValue({ result: { kind: "banter" }, source: "rules" }) }));
vi.mock("@/lib/ai/limits", () => ({ allowAi: vi.fn(() => true), clientIp: () => "test" }));

const request = (body: unknown) => new Request("http://localhost/api/report", { method: "POST", body: JSON.stringify(body) });

describe("API validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([null, [], {}, { calls: [null] }, { calls: [42] }, { calls: [{}] }, { calls: Array(101).fill({}) }])("rejects malformed report payloads without calling AI: %j", async (body) => {
    expect((await report(request(body))).status).toBe(400);
    expect(askAi).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON and oversized streamed bodies", async () => {
    for (const body of ["{", JSON.stringify({ calls: [], padding: "x".repeat(40_000) })]) {
      expect((await report(new Request("http://localhost/api/report", { method: "POST", body }))).status).toBe(400);
    }
    expect(askAi).not.toHaveBeenCalled();
  });

  it("returns the fallback signal for empty reports without spending AI quota", async () => {
    expect(await (await report(request({ calls: [] }))).json()).toEqual({ verdict: null });
    expect(askAi).not.toHaveBeenCalled();
  });

  it("sanitizes valid reports and safely handles malformed numeric fields", async () => {
    const response = await report(request({ name: "Test", points: { toString: null }, calls: [{ said: "India jeetega", desc: "IND to win", when: "15.0", tier: "Bold", result: "hit", backed: "IND" }] }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ verdict: null, source: null });
    expect(askAi).toHaveBeenCalledOnce();
  });

  it.each([null, [], { text: "India wins", ctx: null }, { text: "India wins", ctx: { battingTeam: "Fake" } }])("rejects invalid message contexts: %j", async (body) => {
    expect((await read(request(body))).status).toBe(400);
    expect(readMessage).not.toHaveBeenCalled();
  });
});
