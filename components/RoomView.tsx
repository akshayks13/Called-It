"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import match from "@/data/match.json";
import type { CallOption } from "@/lib/ai/context";
import { buildContext, isReadResult } from "@/lib/ai/context";
import { looksLikeCall, readWithRules, suggestCalls } from "@/lib/ai/fallbackParser";
import type { ReadOutcome } from "@/lib/ai/read";
import type { MatchData } from "@/lib/match/types";
import { Room, SESSION_KEY } from "@/lib/room/room";
import { favours, fallbackVerdict, punditStats, type Verdict } from "@/lib/room/stats";
import { teamShort } from "@/lib/match/players";
import { HowScoring, OpenCalls, Standings } from "./Board";
import ChatThread from "./ChatThread";
import Composer from "./Composer";
import { CloseIcon, NextIcon, PauseIcon, PlayIcon, TrophyIcon } from "./icons";
import PunditCard from "./PunditCard";
import Scoreboard from "./Scoreboard";
import { signed } from "./ui";
import Dialog from "./Dialog";

const DATA = match as unknown as MatchData;

/** milliseconds between balls */
const SPEEDS = [
  { id: "slow", label: "0.5×", ms: 9000 },
  { id: "normal", label: "1×", ms: 5000 },
  { id: "fast", label: "3×", ms: 1700 },
] as const;

/** AI reads one visitor may use per session before the built-in rules take over */
const SESSION_AI_READS = 30;

interface Props {
  room: Room;
  resumed?: boolean;
  aiEnabled?: boolean;
  onLeave: () => void;
}

export default function RoomView({ room, resumed = false, aiEnabled = false, onLeave }: Props) {
  const snap = useSyncExternalStore(room.subscribe, room.getSnapshot, room.getSnapshot);
  const name = snap.userName;
  const [playing, setPlaying] = useState(!resumed);
  const [speed, setSpeed] = useState(1);
  const [sheet, setSheet] = useState(false);
  const [aiVerdict, setAiVerdict] = useState<Verdict | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  const aiReads = useRef(0);
  const requests = useRef(new Set<AbortController>());

  useEffect(() => {
    const active = requests.current;
    return () => { for (const request of active) request.abort(); };
  }, []);

  useEffect(() => {
    try { sessionStorage.setItem(SESSION_KEY, room.save()); } catch {}
  }, [room, snap]);

  // the match clock
  useEffect(() => {
    if (!playing || snap.finished) return;
    const t = setTimeout(() => room.tick(), SPEEDS[speed].ms);
    return () => clearTimeout(t);
  }, [room, playing, speed, snap.idx, snap.finished]);

  const send = useCallback(
    async (text: string) => {
      if (room.getSnapshot().finished) return;
      const { msgId, lockIdx, ctx } = room.say(text);
      if (!aiEnabled || !looksLikeCall(text, ctx) || aiReads.current >= SESSION_AI_READS) {
        room.heard(msgId, lockIdx, readWithRules(text, ctx), "rules");
        return;
      }
      let outcome: ReadOutcome;
      const controller = new AbortController();
      requests.current.add(controller);
      const timeout = setTimeout(() => controller.abort(), 15_000);
      // Reserve attempts before awaiting so concurrent sends share the quota.
      aiReads.current++;
      try {
        const res = await fetch("/api/read-message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, ctx }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        outcome = await res.json();
        if (!isReadResult(outcome?.result) || !["rules", "gemini", "groq"].includes(outcome.source)) throw new Error("bad response");
      } catch {
        // offline or server trouble: the built-in rules keep the chat working
        outcome = { result: readWithRules(text, ctx), source: "rules" };
      } finally {
        clearTimeout(timeout);
        requests.current.delete(controller);
      }
      room.heard(msgId, lockIdx, outcome.result, outcome.source);
    },
    [room, aiEnabled],
  );

  // end of match: the pundit card. Stats come from code; the AI only writes the blurb.
  const stats = useMemo(
    () => (snap.finished && snap.pendingReads === 0 ? punditStats(room.countedCalls("you", Object.values(snap.calls)), DATA.meta.teams) : null),
    [room, snap.calls, snap.finished, snap.pendingReads],
  );
  useEffect(() => {
    if (!stats) return;
    const open = setTimeout(() => setCardOpen(true), 2200);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let active = true;
    if (aiEnabled && stats.made > 0) {
      const board = room.board();
      fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          name,
          result: DATA.meta.result.text,
          rank: board.findIndex((r) => r.who === "you") + 1,
          of: board.length,
          points: stats.points,
          calls: room.countedCalls("you").map((c) => ({
            said: c.text,
            desc: c.desc,
            when: c.said.score,
            tier: c.tierLabel,
            result: c.status,
            backed: teamShort(favours(c.claim, DATA.meta.teams) ?? ""),
          })),
        }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (active && j?.verdict?.title && j?.verdict?.verdict) setAiVerdict(j.verdict);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
      clearTimeout(open);
      clearTimeout(timeout);
      controller.abort();
    };
  }, [stats, room, name, aiEnabled]);
  const card = stats ? { stats, verdict: aiVerdict ?? fallbackVerdict(stats), ai: !!aiVerdict } : null;

  const suggestions = useMemo(() => (snap.finished ? [] : suggestCalls(buildContext(snap.meta, snap.state))), [snap.meta, snap.state, snap.finished]);
  const calls = useMemo(() => Object.values(snap.calls), [snap.calls]);
  const me = snap.board.find((r) => r.who === "you");
  const rank = snap.board.findIndex((r) => r.who === "you") + 1;
  const onPick = useCallback((id: string, o: CallOption) => room.pickOption(id, o), [room]);

  const panels = (
    <>
      <Standings snap={snap} />
      <OpenCalls calls={calls} />
      <HowScoring />
    </>
  );

  return (
    <div className="flex h-dvh justify-center">
      <main className="flex h-dvh w-full flex-col border-line lg:max-w-[480px] lg:border-x">
        <header className="border-b border-line bg-panel">
          <div className="flex items-center gap-2 px-3 pt-2 pb-1.5">
            <span className="font-display text-amber text-[19px] leading-none whitespace-nowrap">CALLED IT</span>
            <span className="hidden min-[400px]:inline rounded border border-line px-1.5 py-px text-[9.5px] font-semibold tracking-wider text-muted" title="A real match, replayed ball by ball">
              REPLAY
            </span>
            <span className="flex-1" />
            {!snap.finished && (
              <div className="flex items-center rounded-full border border-line">
                <button type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause the match" : "Resume the match"} className="grid h-8 w-8 place-items-center text-muted hover:text-fg">
                  {playing ? <PauseIcon size={15} /> : <PlayIcon size={14} />}
                </button>
                <button
                  type="button"
                  onClick={() => setSpeed((v) => (v + 1) % SPEEDS.length)}
                  aria-label={`Replay speed ${SPEEDS[speed].label}. Tap to change`}
                  className="h-8 px-1.5 font-mono text-[12px] text-muted hover:text-fg"
                >
                  {SPEEDS[speed].label}
                </button>
                <button type="button" onClick={() => room.tick()} aria-label="Bowl the next ball now" className="grid h-8 w-8 place-items-center text-muted hover:text-fg">
                  <NextIcon size={15} />
                </button>
              </div>
            )}
            {snap.finished && card && (
              <button type="button" onClick={() => setCardOpen(true)} className="whitespace-nowrap rounded-full bg-amber px-3 py-1.5 text-[12px] font-semibold text-ink">
                Pundit card
              </button>
            )}
            <button
              type="button"
              onClick={() => setSheet(true)}
              aria-label="Open the board"
              className="flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-line px-2.5 text-[12px] text-muted hover:text-fg lg:hidden"
            >
              <TrophyIcon size={14} />
              <span className="font-mono max-[360px]:hidden">
                #{rank} {signed(me?.points ?? 0)}
              </span>
            </button>
            <button type="button" onClick={onLeave} aria-label="Leave the chat" className="grid h-8 w-8 place-items-center text-faint hover:text-fg">
              <CloseIcon size={16} />
            </button>
          </div>
          <Scoreboard snap={snap} />
          <p className="px-3 pb-1.5 text-[10px] text-muted">Solo replay · 3 bot opponents{resumed && !playing && !snap.finished ? " · Restored and paused" : ""}</p>
          {snap.finished && snap.pendingReads > 0 && <p role="status" className="px-3 pb-2 text-xs text-amber">Checking your last calls before the Pundit Card…</p>}
        </header>

        <ChatThread snap={snap} canRetract={(c) => room.canRetract(c)} onRetract={(id) => room.retract(id)} onPick={onPick} />
        <Composer suggestions={suggestions} disabled={snap.finished} onSend={send} />
      </main>

      <aside className="hidden h-dvh w-[380px] shrink-0 flex-col gap-6 overflow-y-auto px-6 py-5 lg:flex">
        {panels}
        <p className="text-[11px] leading-relaxed text-faint">
          Replay of the {DATA.meta.event} {DATA.meta.stage}, {DATA.meta.title}, {DATA.meta.date}. Data: {DATA.meta.source}. Rahul, Priya and Kabir are
          scripted bot opponents. Your calls and progress are saved in this tab.
        </p>
      </aside>

      {sheet && (
        <Dialog label="Match board" onClose={() => setSheet(false)} className="open:flex flex-col justify-end lg:hidden">
          <div className="rise max-h-[85dvh] space-y-6 overflow-y-auto rounded-t-2xl border-t border-line bg-ink px-4 pt-3 pb-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="mx-auto h-1 w-10 rounded-full bg-line" />
              <button type="button" onClick={() => setSheet(false)} aria-label="Close" className="absolute right-3 p-1 text-muted">
                <CloseIcon size={16} />
              </button>
            </div>
            {panels}
          </div>
        </Dialog>
      )}

      {card && cardOpen && (
        <PunditCard snap={snap} stats={card.stats} verdict={card.verdict} writtenByAi={card.ai} onClose={() => setCardOpen(false)} onAgain={onLeave} />
      )}
    </div>
  );
}
