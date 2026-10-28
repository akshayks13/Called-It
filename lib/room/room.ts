/**
 * The chat room: one live match, four people, an umpire. Plain TypeScript with
 * no React or network in it, so the whole evening can be run in a test.
 */
import type { CallOption, ReadContext, ReadResult, ReadSource } from "../ai/context";
import { buildContext, isReadResult } from "../ai/context";
import { readWithRules } from "../ai/fallbackParser";
import { describeClaim } from "../claims/describe";
import { type Claim, sameClaim } from "../claims/schema";
import { invalidReason, type Progress, startProgress, stepProgress } from "../claims/settle";
import { short, teamShort } from "../match/players";
import { chase, oversText, Replay } from "../match/replay";
import type { Ball, MatchData, MatchMeta, MatchState } from "../match/types";
import { estimate, hashSeed, mulberry32 } from "../sim/simulate";
import { FRIENDS, type FriendId, reactionFor, SCRIPT } from "./friends";
import { MAX_OPEN_CALLS, MISS_PENALTY, oddsText, type TierId, tierFor } from "./scoring";

export type Who = "you" | FriendId;

export type Msg =
  | { id: string; t: "ball"; ball: Ball; score: string }
  | { id: string; t: "over"; text: string }
  | { id: string; t: "info"; text: string }
  | { id: string; t: "chat"; by: Who; text: string; at: string; callId?: string; reading?: boolean }
  | { id: string; t: "umpire"; text: string; tone: "nudge" | "noball" | "sorry"; options?: CallOption[]; used?: boolean }
  | { id: string; t: "receipt"; callId: string };

export interface Call {
  id: string;
  by: Who;
  /** the message exactly as it was typed */
  text: string;
  claim: Claim;
  /** the checkable version, in plain words */
  desc: string;
  said: { idx: number; over: string; score: string };
  p: number;
  tier: TierId;
  tierLabel: string;
  win: number;
  status: "open" | "hit" | "miss" | "void";
  progress: Progress;
  ifRight?: string;
  ifWrong?: string;
  settled?: { idx: number; over: string; points: number; line: string };
  /** balls bowled when the umpire noted it; undo is allowed until the next ball */
  notedIdx: number;
  /** what read the message: an AI model, or the built-in rules */
  source?: ReadSource;
}

export interface Standing {
  who: Who;
  name: string;
  points: number;
  hits: number;
  misses: number;
  open: number;
}

export interface RoomSnapshot {
  meta: MatchMeta;
  state: MatchState;
  idx: number;
  totalBalls: number;
  messages: Msg[];
  calls: Record<string, Call>;
  board: Standing[];
  thisOver: Ball[];
  finished: boolean;
  userName: string;
  pendingReads: number;
}

const HIT_LINES = ["Called it. Frame this one.", "Bola tha. Hua bhi.", "Checked upstairs: spot on.", "That one goes straight on the fridge."];
const MISS_LINES = ["Checked upstairs. Not even close.", "The scoreboard respectfully disagrees.", "Bola tha... galat bola tha.", "Wrong call. Long walk back to the pavilion."];

const scoreText = (s: MatchState, inn = s.inn) => {
  const i = s.innings[inn];
  return `${teamShort(i.team)} ${i.runs}/${i.wickets} (${oversText(i.legal)})`;
};

export type AddCallResult =
  | { ok: true; call: Call }
  | { ok: false; why: "invalid" | "noball" | "limit" | "duplicate"; text: string };

type RoomEvent = { at: number } & (
  | { t: "say"; text: string }
  | { t: "heard"; msgId: string; lockIdx: number; result: ReadResult; source?: ReadSource }
  | { t: "pick"; msgId: string; option: number }
  | { t: "retract"; callId: string }
);

const SESSION_VERSION = 1;
export const SESSION_KEY = "calledit:session:v1";

export class Room {
  readonly meta: MatchMeta;
  private readonly balls: Ball[];
  /** states[i] = the match after i balls */
  private readonly states: MatchState[] = [];
  private idx = 0;
  private messages: Msg[] = [];
  private calls = new Map<string, Call>();
  private seq = 0;
  private listeners = new Set<() => void>();
  private snap!: RoomSnapshot;
  private userName: string;
  /** balls bowled when the user joined; the board only counts receipts after this */
  private joinIdx = 0;
  private pendingReads = new Map<string, number>();
  private events: RoomEvent[] = [];

  constructor(data: MatchData, opts: { userName: string; startIdx?: number }) {
    const replay = new Replay(data);
    this.meta = data.meta;
    this.balls = data.balls;
    this.userName = opts.userName;

    let s = replay.start();
    this.states.push(s);
    for (let n = replay.next(s); n; n = replay.next(s)) {
      s = n.state;
      this.states.push(s);
    }

    this.runScript();
    const start = Math.max(0, Math.min(opts.startIdx ?? 0, this.balls.length));
    while (this.idx < start) this.advance();
    this.joinIdx = start;
    if (start > 0) {
      // joined late: show only the recent chat, like opening a busy group.
      // Old receipts are dropped because the board starts counting from now.
      this.messages = this.messages.filter((m) => m.t !== "receipt").slice(-14);
      this.messages.unshift({ id: this.id(), t: "info", text: `You joined at ${scoreText(this.state)}. Earlier chat is hidden.` });
    }
    this.messages.push({
      id: this.id(),
      t: "umpire",
      tone: "nudge",
      text: `Welcome, ${this.userName}. I'm listening. Say what you think happens next, in your own words, and I'll keep the receipt.`,
    });
    this.publish();
  }

  // ---- reading the room ----

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.snap;

  /** Store user actions, never trusted scores. Restoring replays the engine. */
  save(): string {
    return JSON.stringify({ version: SESSION_VERSION, match: `${this.meta.date}:${this.meta.title}`, name: this.userName, startIdx: this.joinIdx, idx: this.idx, events: this.events });
  }

  static restore(data: MatchData, raw: string): Room | null {
    if (raw.length > 1_000_000) return null;
    try {
      const saved = JSON.parse(raw);
      const index = (n: unknown) => Number.isInteger(n) && Number(n) >= 0 && Number(n) <= data.balls.length;
      if (!saved || saved.version !== SESSION_VERSION || saved.match !== `${data.meta.date}:${data.meta.title}` ||
          typeof saved.name !== "string" || saved.name.length > 18 || !index(saved.startIdx) || !index(saved.idx) ||
          saved.idx < saved.startIdx || !Array.isArray(saved.events) || saved.events.length > 2000) return null;
      const room = new Room(data, { userName: saved.name, startIdx: saved.startIdx });
      for (const event of saved.events) {
        if (!event || !index(event.at) || event.at < room.idx || event.at > saved.idx) return null;
        while (room.idx < event.at) room.tick();
        if (event.t === "say" && typeof event.text === "string" && event.text.length <= 200 && !room.state.done) {
          room.say(event.text);
        } else if (event.t === "heard" && typeof event.msgId === "string" && index(event.lockIdx) &&
                   room.pendingReads.get(event.msgId) === event.lockIdx && isReadResult(event.result) &&
                   (event.source === undefined || ["rules", "gemini", "groq"].includes(event.source))) {
          room.heard(event.msgId, event.lockIdx, event.result, event.source);
        } else if (event.t === "pick" && typeof event.msgId === "string" && Number.isInteger(event.option)) {
          const msg = room.messages.find((m) => m.id === event.msgId);
          const option = msg?.t === "umpire" ? msg.options?.[event.option] : undefined;
          if (!option || msg?.t !== "umpire" || msg.used) return null;
          room.pickOption(event.msgId, option);
        } else if (event.t === "retract" && typeof event.callId === "string") {
          const call = room.calls.get(event.callId);
          if (!call || !room.canRetract(call)) return null;
          room.retract(event.callId);
        } else return null;
      }
      while (room.idx < saved.idx) room.tick();
      // A refresh cancels network requests. Recover their original time with
      // rules, so calls are neither lost nor judged using a later scorecard.
      for (const [id, lockIdx] of [...room.pendingReads]) {
        const msg = room.messages.find((m) => m.id === id);
        if (msg?.t === "chat") room.heard(id, lockIdx, readWithRules(msg.text, buildContext(room.meta, room.states[lockIdx])), "rules");
      }
      return room;
    } catch {
      return null;
    }
  }

  get state(): MatchState {
    return this.states[this.idx];
  }
  context(): ReadContext {
    return buildContext(this.meta, this.state);
  }
  nameOf(who: Who): string {
    return who === "you" ? this.userName : (FRIENDS.find((f) => f.id === who)?.name ?? who);
  }

  // ---- the match moving forward ----

  /** Bowl the next ball. Returns false when the match is over. */
  tick(): boolean {
    if (this.idx >= this.balls.length) return false;
    this.advance();
    this.publish();
    return this.idx < this.balls.length;
  }

  private advance() {
    const ball = this.balls[this.idx];
    this.idx++;
    const s = this.state;
    const inn = s.innings[ball.inn];
    this.messages.push({ id: this.id(), t: "ball", ball, score: scoreText(s, ball.inn) });

    for (const call of this.calls.values()) {
      if (call.status !== "open") continue;
      if (stepProgress(call.claim, call.progress, s, ball) !== "pending") this.settle(call, this.idx);
    }

    const react = reactionFor(ball, inn.team, mulberry32(hashSeed(`react${ball.i}`))());
    if (react) this.chat(react.by, react.text);

    if (ball.legal && inn.legal % 6 === 0 && !inn.done) {
      const over = this.balls.filter((b) => b.inn === ball.inn && b.over === ball.over);
      const runs = over.reduce((a, b) => a + b.total, 0);
      const c = chase(s);
      this.messages.push({
        id: this.id(),
        t: "over",
        text: `Over ${ball.over + 1}: ${runs} runs${c ? ` \u00b7 need ${c.need} off ${c.balls}` : ` \u00b7 ${scoreText(s, ball.inn)}`}`,
      });
    }
    if (ball.inn === 0 && inn.done) {
      this.messages.push({ id: this.id(), t: "info", text: `Innings break. ${this.meta.teams[1]} need ${inn.runs + 1} to win.` });
    }
    if (s.done) this.messages.push({ id: this.id(), t: "info", text: `Match over. ${this.meta.result.text}.` });

    this.runScript();
  }

  private runScript() {
    for (const line of SCRIPT) {
      if (line.at !== this.idx) continue;
      const msgId = this.chat(line.by, line.text);
      if (line.claim) {
        const r = this.addCall(line.by, line.text, line.claim, this.idx, { ifRight: line.ifRight, ifWrong: line.ifWrong });
        if (r.ok) this.tag(msgId, r.call.id);
      }
    }
  }

  // ---- calls ----

  /**
   * Record a call as made when `lockIdx` balls had been bowled. If balls have
   * been bowled since (the reader took a moment), they are replayed so the call
   * is judged from the moment it was said.
   */
  addCall(by: Who, text: string, claim: Claim, lockIdx: number, lines: { ifRight?: string; ifWrong?: string } = {}): AddCallResult {
    if (!Number.isInteger(lockIdx) || lockIdx < 0 || lockIdx > this.idx) {
      return { ok: false, why: "invalid", text: "That call has no valid match time." };
    }
    const at = this.states[lockIdx];
    const desc = describeClaim(claim);
    const bad = invalidReason(claim, this.meta, at);
    if (bad) return { ok: false, why: "invalid", text: bad };

    const progress = startProgress(claim, this.meta, at);
    if (progress.status === "hit") return { ok: false, why: "invalid", text: `"${desc}" has already happened.` };
    if (progress.status === "miss") return { ok: false, why: "invalid", text: `"${desc}" can't happen any more.` };

    // Use the timeline at submission, including calls that settled while the
    // reader was working. Otherwise identical late replies score repeatedly.
    const mine = [...this.calls.values()].filter((c) =>
      c.by === by && c.status !== "void" && (c.settled?.idx ?? Infinity) > lockIdx,
    );
    if (mine.some((c) => sameClaim(c.claim, claim))) return { ok: false, why: "duplicate", text: "Already noted. One receipt per call." };
    if (by === "you" && mine.length >= MAX_OPEN_CALLS) {
      return { ok: false, why: "limit", text: `You have ${MAX_OPEN_CALLS} calls open. Wait for one to settle.` };
    }

    // the user's own call gets the full simulation; scripted friends a lighter one
    const { p } = estimate(claim, this.meta, at, { runs: by === "you" ? 2000 : 1000 });
    const tier = tierFor(p);
    if (tier.id === "obvious") {
      return { ok: false, why: "noball", text: `No-ball. "${desc}" is ${oddsText(p)}. Too obvious to count.` };
    }

    const call: Call = {
      id: this.id(),
      by,
      text,
      claim,
      desc,
      said: { idx: lockIdx, over: oversText(at.innings[at.inn].legal), score: scoreText(at) },
      p,
      tier: tier.id,
      tierLabel: tier.label,
      win: tier.win,
      status: "open",
      progress,
      ifRight: lines.ifRight,
      ifWrong: lines.ifWrong,
      notedIdx: this.idx,
    };
    this.calls.set(call.id, call);
    for (let i = lockIdx; i < this.idx && call.status === "open"; i++) {
      if (stepProgress(claim, progress, this.states[i + 1], this.balls[i]) !== "pending") this.settle(call, i + 1);
    }
    return { ok: true, call };
  }

  private settle(call: Call, idx: number) {
    const hit = call.progress.status === "hit";
    const s = this.states[idx];
    const pool = hit ? HIT_LINES : MISS_LINES;
    call.status = hit ? "hit" : "miss";
    call.settled = {
      idx,
      over: oversText(s.innings[this.balls[idx - 1]?.inn ?? s.inn].legal),
      points: hit ? call.win : -MISS_PENALTY,
      line: (hit ? call.ifRight : call.ifWrong) ?? pool[hashSeed(call.id + call.text) % pool.length],
    };
    this.messages.push({ id: this.id(), t: "receipt", callId: call.id });
  }

  // ---- the user talking ----

  /** Post the user's message. The caller then asks the reader and reports back with `heard`. */
  say(text: string): { msgId: string; lockIdx: number; ctx: ReadContext } {
    text = text.trim().slice(0, 200);
    this.events.push({ at: this.idx, t: "say", text });
    const msgId = this.chat("you", text, true);
    this.pendingReads.set(msgId, this.idx);
    this.publish();
    return { msgId, lockIdx: this.idx, ctx: this.context() };
  }

  /** The reader's verdict on a message posted with `say`. */
  heard(msgId: string, lockIdx: number, result: ReadResult, source?: ReadSource) {
    // A request is consumed once, and only at the time recorded by say().
    if (this.pendingReads.get(msgId) !== lockIdx) return;
    this.pendingReads.delete(msgId);
    this.events.push({ at: this.idx, t: "heard", msgId, lockIdx, result, source });
    const msg = this.messages.find((m) => m.id === msgId);
    if (msg?.t === "chat") msg.reading = false;
    const text = msg?.t === "chat" ? msg.text : "";

    if (result.kind === "call") {
      const r = this.addCall("you", text, result.claim, lockIdx, { ifRight: result.ifRight, ifWrong: result.ifWrong });
      if (r.ok) {
        r.call.source = source;
        this.tag(msgId, r.call.id);
      }
      else this.messages.push({ id: this.id(), t: "umpire", tone: r.why === "noball" ? "noball" : "sorry", text: r.text });
    } else if (result.kind === "vague") {
      const now = this.state;
      const options = result.options.filter(
        (o) => !invalidReason(o.claim, this.meta, now) && startProgress(o.claim, this.meta, now).status === "pending",
      );
      // nothing checkable left to offer (e.g. the batter is already out): treat it as banter
      if (options.length) this.messages.push({ id: this.id(), t: "umpire", tone: "nudge", text: result.nudge, options });
    }
    this.publish();
  }

  /** The user tapped one of the umpire's concrete versions. */
  pickOption(umpireMsgId: string, option: CallOption) {
    const m = this.messages.find((x) => x.id === umpireMsgId);
    if (this.state.done || m?.t !== "umpire" || m.used || !m.options?.some((o) => o.text === option.text && sameClaim(o.claim, option.claim))) return;
    m.used = true;
    this.events.push({ at: this.idx, t: "pick", msgId: umpireMsgId, option: m.options!.findIndex((o) => o.text === option.text && sameClaim(o.claim, option.claim)) });
    const msgId = this.chat("you", option.text);
    const r = this.addCall("you", option.text, option.claim, this.idx);
    if (r.ok) this.tag(msgId, r.call.id);
    else this.messages.push({ id: this.id(), t: "umpire", tone: r.why === "noball" ? "noball" : "sorry", text: r.text });
    this.publish();
  }

  /** "Not what I meant": allowed until the next ball is bowled. */
  canRetract(call: Call): boolean {
    return call.by === "you" && call.status === "open" && call.notedIdx === this.idx;
  }
  retract(callId: string) {
    const call = this.calls.get(callId);
    if (!call || !this.canRetract(call)) return;
    call.status = "void";
    this.events.push({ at: this.idx, t: "retract", callId });
    for (const m of this.messages) if (m.t === "chat" && m.callId === callId) delete m.callId;
    this.publish();
  }

  // ---- internals ----

  private id() {
    return `m${++this.seq}`;
  }

  private chat(by: Who, text: string, reading = false): string {
    const s = this.state;
    const id = this.id();
    this.messages.push({ id, t: "chat", by, text, at: oversText(s.innings[s.inn].legal), ...(reading ? { reading } : {}) });
    return id;
  }

  private tag(msgId: string, callId: string) {
    const m = this.messages.find((x) => x.id === msgId);
    if (m?.t === "chat") m.callId = callId;
  }

  board(): Standing[] {
    const rows: Standing[] = (["you", ...FRIENDS.map((f) => f.id)] as Who[]).map((who) => ({
      who,
      name: this.nameOf(who),
      points: 0,
      hits: 0,
      misses: 0,
      open: 0,
    }));
    for (const c of this.calls.values()) {
      const row = rows.find((r) => r.who === c.by);
      if (!row) continue;
      if (c.status === "open") row.open++;
      if (!c.settled || c.settled.idx <= this.joinIdx) continue;
      if (c.status === "hit") row.hits++;
      if (c.status === "miss") row.misses++;
      row.points += c.settled.points;
    }
    return rows.sort((a, b) => b.points - a.points || b.hits - a.hits);
  }

  allCalls(): Call[] {
    return [...this.calls.values()];
  }
  /** calls that count on the board: settled since the user joined */
  countedCalls(who: Who, calls = this.allCalls()): Call[] {
    return calls.filter((c) => c.by === who && c.settled && c.settled.idx > this.joinIdx);
  }

  private publish() {
    const s = this.state;
    const last = this.balls[this.idx - 1];
    const thisOver =
      last && !(last.legal && s.innings[last.inn].legal % 6 === 0) && last.inn === s.inn
        ? this.balls.slice(0, this.idx).filter((b) => b.inn === last.inn && b.over === last.over)
        : [];
    this.snap = {
      meta: this.meta,
      state: s,
      idx: this.idx,
      totalBalls: this.balls.length,
      messages: this.messages.map((m) => ({ ...m })),
      calls: Object.fromEntries([...this.calls].map(([k, c]) => [k, { ...c }])),
      board: this.board(),
      thisOver,
      finished: this.idx >= this.balls.length,
      userName: this.userName,
      pendingReads: this.pendingReads.size,
    };
    for (const fn of this.listeners) fn();
  }
}

/** Short text for a ball line in the chat: "15.4 Axar to Klaasen: SIX" */
export function ballText(b: Ball): { label: string; who: string; what: string; tone: "wicket" | "six" | "four" | "extra" | "dot" | "run" } {
  const who = `${short(b.bowler)} to ${short(b.batter)}`;
  if (b.wicket) {
    const f = b.wicket.fielders.map(short).join(", ");
    const how =
      b.wicket.kind === "caught" ? `caught${f ? ` by ${f}` : ""}` : b.wicket.kind === "run out" ? `run out${f ? ` (${f})` : ""}` : b.wicket.kind;
    return { label: b.label, who, what: `OUT! ${short(b.wicket.playerOut)} ${how}`, tone: "wicket" };
  }
  if (b.six) return { label: b.label, who, what: "SIX", tone: "six" };
  if (b.four) return { label: b.label, who, what: "FOUR", tone: "four" };
  if (b.wide) return { label: b.label, who, what: b.total > 1 ? `${b.total} wides` : "wide", tone: "extra" };
  if (b.noball) return { label: b.label, who, what: `no-ball${b.total > 1 ? ` + ${b.total - 1}` : ""}`, tone: "extra" };
  if (b.legbye || b.bye) return { label: b.label, who, what: `${b.total} ${b.legbye ? "leg bye" : "bye"}${b.total > 1 ? "s" : ""}`, tone: "extra" };
  if (b.total === 0) return { label: b.label, who, what: "no run", tone: "dot" };
  return { label: b.label, who, what: `${b.total} run${b.total > 1 ? "s" : ""}`, tone: "run" };
}
