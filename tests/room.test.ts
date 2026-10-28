import { describe, expect, it } from "vitest";
import data from "../data/match.json";
import { readWithRules } from "../lib/ai/fallbackParser";
import type { MatchData } from "../lib/match/types";
import { SCRIPT } from "../lib/room/friends";
import { Room } from "../lib/room/room";

const match = data as unknown as MatchData;

describe("the room, start to finish", () => {
  it("every scripted friend call is accepted and settled by the end", () => {
    const room = new Room(match, { userName: "Test" });
    while (room.tick());
    const calls = room.allCalls();
    expect(calls.length).toBe(SCRIPT.filter((l) => l.claim).length);
    expect(calls.every((c) => c.status === "hit" || c.status === "miss")).toBe(true);
    // a call is always made before the ball that settles it
    expect(calls.every((c) => (c.settled?.idx ?? 0) > c.said.idx)).toBe(true);
    expect(room.getSnapshot().finished).toBe(true);
  });

  it("a user call is noted, settled and scored", () => {
    const room = new Room(match, { userName: "Test", startIdx: 220 }); // SA need 30 off 30
    const said = room.say("India jeetega");
    room.heard(said.msgId, said.lockIdx, readWithRules("India jeetega", said.ctx));
    const mine = room.allCalls().filter((c) => c.by === "you");
    expect(mine).toHaveLength(1);
    expect(mine[0].desc).toBe("IND to win");
    expect(["bold", "outrageous", "miracle"]).toContain(mine[0].tier);
    while (room.tick());
    const me = room.board().find((r) => r.who === "you");
    expect(me?.hits).toBe(1);
    expect(me?.points).toBe(mine[0].win);
  });

  it("judges a call from the moment it was said, even if the reader is slow", () => {
    const room = new Room(match, { userName: "Test", startIdx: 226 });
    const said = room.say("wicket next ball");
    room.tick(); // Klaasen is out while the reader is still thinking
    room.tick();
    room.heard(said.msgId, said.lockIdx, readWithRules("wicket next ball", said.ctx));
    const call = room.allCalls().find((c) => c.by === "you");
    expect(call?.status).toBe("hit");
    expect(call?.settled?.idx).toBe(227);
  });

  it("turns away obvious calls, duplicates and a fourth open call", () => {
    const room = new Room(match, { userName: "Test", startIdx: 200 });
    const send = (text: string) => {
      const said = room.say(text);
      room.heard(said.msgId, said.lockIdx, readWithRules(text, said.ctx));
    };
    const umpire = () => room.getSnapshot().messages.filter((m) => m.t === "umpire").map((m) => (m.t === "umpire" ? m.text : ""));
    const open = () => room.allCalls().filter((c) => c.by === "you" && c.status === "open").length;

    send("1 run this over");
    expect(open()).toBe(0);
    expect(umpire().at(-1)).toMatch(/No-ball/);

    send("India jeetega");
    send("India jeetega");
    expect(open()).toBe(1);
    expect(umpire().at(-1)).toMatch(/Already noted/);

    send("SA 200 pakka");
    send("Klaasen 80");
    expect(open()).toBe(3);
    send("Miller 50");
    expect(open()).toBe(3);
    expect(umpire().at(-1)).toMatch(/calls open/);
  });

  it("lets the user take back a misread call until the next ball", () => {
    const room = new Room(match, { userName: "Test", startIdx: 200 });
    const said = room.say("India jeetega");
    room.heard(said.msgId, said.lockIdx, readWithRules("India jeetega", said.ctx));
    const call = room.allCalls().find((c) => c.by === "you")!;
    expect(room.canRetract(call)).toBe(true);
    room.tick();
    expect(room.canRetract(call)).toBe(false);
  });

  it("joining late starts everyone's board from zero", () => {
    const room = new Room(match, { userName: "Test", startIdx: 200 });
    expect(room.board().every((r) => r.points === 0)).toBe(true);
    expect(room.getSnapshot().messages.some((m) => m.t === "receipt")).toBe(false);
  });

  it("scores one receipt when duplicate responses arrive after a wicket", () => {
    const room = new Room(match, { userName: "Test", startIdx: 226 });
    const messages = Array.from({ length: 5 }, () => room.say("wicket next ball"));
    room.tick();
    for (const m of messages.reverse()) room.heard(m.msgId, m.lockIdx, readWithRules("wicket next ball", m.ctx));
    const mine = room.countedCalls("you");
    expect(mine).toHaveLength(1);
    expect(room.board().find((r) => r.who === "you")?.points).toBe(mine[0].win);
    expect(room.getSnapshot().pendingReads).toBe(0);
  });

  it("consumes a message response once and requires its original timestamp", () => {
    const room = new Room(match, { userName: "Test", startIdx: 226 });
    const m = room.say("wicket next ball");
    const result = readWithRules("wicket next ball", m.ctx);
    room.heard(m.msgId, m.lockIdx - 1, result);
    expect(room.getSnapshot().pendingReads).toBe(1);
    room.tick();
    room.heard(m.msgId, m.lockIdx, result);
    const count = room.getSnapshot().messages.length;
    room.heard(m.msgId, m.lockIdx, result);
    expect(room.getSnapshot().messages).toHaveLength(count);
    expect(room.countedCalls("you")).toHaveLength(1);
  });

  it("applies the three-call limit at submission even when responses arrive after settlement", () => {
    const room = new Room(match, { userName: "Test", startIdx: 220 });
    const texts = ["India jeetega", "SA 200 pakka", "Klaasen 80", "Miller 50"];
    const messages = texts.map((text) => ({ text, ...room.say(text) }));
    while (room.tick());
    for (const m of messages) room.heard(m.msgId, m.lockIdx, readWithRules(m.text, m.ctx));
    expect(room.countedCalls("you")).toHaveLength(3);
  });

  it("keeps the final snapshot pending until the last read has settled", () => {
    const room = new Room(match, { userName: "Test", startIdx: 244 });
    const m = room.say("India jeetega");
    while (room.tick());
    expect(room.getSnapshot()).toMatchObject({ finished: true, pendingReads: 1 });
    room.heard(m.msgId, m.lockIdx, readWithRules("India jeetega", m.ctx));
    expect(room.getSnapshot()).toMatchObject({ finished: true, pendingReads: 0 });
    expect(room.countedCalls("you")).toHaveLength(1);
  });

  it("restores the match, conversation and scores by replaying saved actions", () => {
    const room = new Room(match, { userName: "Test", startIdx: 220 });
    const m = room.say("India jeetega");
    room.heard(m.msgId, m.lockIdx, readWithRules("India jeetega", m.ctx), "rules");
    room.tick();
    room.tick();
    const restored = Room.restore(match, room.save());
    expect(restored?.getSnapshot()).toEqual(room.getSnapshot());
    while (room.tick());
    while (restored?.tick());
    expect(restored?.board()).toEqual(room.board());
  });

  it("recovers an interrupted read from its original match state after refresh", () => {
    const room = new Room(match, { userName: "Test", startIdx: 226 });
    room.say("wicket next ball");
    room.tick();
    const restored = Room.restore(match, room.save())!;
    expect(restored.getSnapshot().pendingReads).toBe(0);
    expect(restored.countedCalls("you")[0]).toMatchObject({ status: "hit", said: { idx: 226 }, settled: { idx: 227 } });
    expect(Room.restore(match, restored.save())?.board()).toEqual(restored.board());
  });

  it("rejects corrupt and incompatible saved sessions", () => {
    for (const raw of ["not json", "null", "{}", '{"version":99}', "x".repeat(1_000_001)]) expect(Room.restore(match, raw)).toBeNull();
    const room = new Room(match, { userName: "Test", startIdx: 220 });
    const saved = JSON.parse(room.save());
    expect(Room.restore(match, JSON.stringify({ ...saved, idx: 9999 }))).toBeNull();
    expect(Room.restore(match, JSON.stringify({ ...saved, events: [{ at: 220, t: "heard", result: null }] }))).toBeNull();
  });

  it("restores option choices and retractions, and ignores repeated option clicks", () => {
    const room = new Room(match, { userName: "Test", startIdx: 223 });
    const m = room.say("wicket aayega pakka");
    room.heard(m.msgId, m.lockIdx, readWithRules("wicket aayega pakka", m.ctx));
    const note = room.getSnapshot().messages.find((m) => m.t === "umpire" && m.options?.length);
    if (note?.t !== "umpire" || !note.options) throw new Error("Expected options");
    room.pickOption(note.id, note.options[1]);
    const call = room.allCalls().find((c) => c.by === "you")!;
    expect(call).toBeDefined();
    room.retract(call.id);
    room.pickOption(note.id, note.options[1]);
    expect(room.allCalls().filter((c) => c.by === "you")).toHaveLength(1);
    expect(Room.restore(match, room.save())?.getSnapshot()).toEqual(room.getSnapshot());
  });

  it("allows a new next-ball call after an earlier one has settled", () => {
    const room = new Room(match, { userName: "Test", startIdx: 226 });
    const send = () => {
      const m = room.say("wicket next ball");
      room.heard(m.msgId, m.lockIdx, readWithRules("wicket next ball", m.ctx));
    };
    send();
    room.tick();
    send();
    expect(room.allCalls().filter((c) => c.by === "you")).toHaveLength(2);
  });
});
