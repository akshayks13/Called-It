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
});
