"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CallOption } from "@/lib/ai/context";
import { oddsText } from "@/lib/room/scoring";
import { ballText, type Call, type Msg, type RoomSnapshot } from "@/lib/room/room";
import { FRIENDS } from "@/lib/room/friends";
import { PinIcon } from "./icons";
import Receipt from "./Receipt";
import { colorOf, signed, TIER_STYLE } from "./ui";

interface Props {
  snap: RoomSnapshot;
  canRetract: (call: Call) => boolean;
  onRetract: (callId: string) => void;
  onPick: (umpireMsgId: string, option: CallOption) => void;
}

const BALL_TONE = {
  wicket: "text-miss font-semibold",
  six: "text-amber font-semibold",
  four: "text-sky-300 font-semibold",
  extra: "text-muted",
  dot: "text-faint",
  run: "text-muted",
} as const;

function BallLine({ m }: { m: Extract<Msg, { t: "ball" }> }) {
  const b = ballText(m.ball);
  const big = b.tone === "wicket" || b.tone === "six" || b.tone === "four";
  return (
    <div className={`flex items-baseline justify-center gap-2 font-mono text-[11px] ${big ? "py-1" : "py-px"}`}>
      <span className="text-faint tabular-nums">{b.label}</span>
      <span className="text-faint">{b.who}</span>
      <span className={BALL_TONE[b.tone]}>{b.what}</span>
    </div>
  );
}

function CallTag({ call, mine, retractable, onRetract }: { call: Call; mine: boolean; retractable: boolean; onRetract: () => void }) {
  const settled = call.status === "hit" || call.status === "miss";
  const hit = call.status === "hit";
  return (
    <div className={`mt-1 max-w-full ${mine ? "ml-auto" : ""}`}>
      <div
        className={`inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border px-2 py-1 text-[11px] leading-tight ${
          settled ? (hit ? "border-hit/50 bg-hit/10" : "border-miss/40 bg-miss/10") : "border-amber/40 bg-amber/5"
        }`}
      >
        <span className={`inline-flex items-center gap-1 font-semibold tracking-wide ${settled ? (hit ? "text-hit" : "text-miss") : "text-amber"}`}>
          {settled ? (hit ? "✓ RIGHT" : "✗ WRONG") : (<><PinIcon size={11} /> NOTED</>)}
        </span>
        <span className="text-fg">{call.desc}</span>
        {settled ? (
          <span className={`font-mono font-semibold ${hit ? "text-hit" : "text-miss"}`}>{signed(call.settled?.points ?? 0)}</span>
        ) : (
          <span className={`rounded border px-1 font-medium ${TIER_STYLE[call.tier]}`} title={oddsText(call.p)}>
            {call.tierLabel} +{call.win}
          </span>
        )}
      </div>
      {mine && !settled && (
        <div className="mt-0.5 flex justify-end gap-2 text-[10px] text-faint">
          <span>
            {oddsText(call.p)}
            {call.source ? ` · read by ${call.source === "rules" ? "backup rules" : "AI"}` : ""}
          </span>
          {retractable && (
            <button type="button" onClick={onRetract} className="underline underline-offset-2 hover:text-fg">
              not what I meant
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Bubble({ m, snap, call, retractable, onRetract }: { m: Extract<Msg, { t: "chat" }>; snap: RoomSnapshot; call?: Call; retractable: boolean; onRetract: () => void }) {
  const mine = m.by === "you";
  const name = mine ? snap.userName : (FRIENDS.find((f) => f.id === m.by)?.name ?? m.by);
  return (
    <div className={`rise flex flex-col my-1.5 ${mine ? "items-end" : "items-start"}`}>
      <div className={`max-w-[84%] rounded-2xl px-3 py-1.5 ${mine ? "bg-mine rounded-br-md" : "bg-raised rounded-bl-md"}`}>
        {!mine && (
          <p className="text-[11px] font-semibold leading-tight" style={{ color: colorOf(m.by) }}>
            {name}
          </p>
        )}
        <p className="text-[14.5px] leading-snug break-words">{m.text}</p>
      </div>
      {m.reading && <p className="mt-0.5 text-[10px] italic text-faint">third umpire is checking&hellip;</p>}
      {call && call.status !== "void" && <CallTag call={call} mine={mine} retractable={retractable} onRetract={onRetract} />}
    </div>
  );
}

function UmpireNote({ m, onPick }: { m: Extract<Msg, { t: "umpire" }>; onPick: (o: CallOption) => void }) {
  return (
    <div className="rise my-2 mx-auto max-w-[92%] rounded-xl border border-amber/40 bg-panel px-3 py-2">
      <p className="text-[10px] font-semibold tracking-[0.14em] text-amber">THIRD UMPIRE{m.tone === "noball" ? " · NO-BALL" : ""}</p>
      <p className="mt-0.5 text-[13.5px] leading-snug">{m.text}</p>
      {m.options && m.options.length > 0 && !m.used && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {m.options.map((o) => (
            <button
              key={o.text}
              type="button"
              onClick={() => onPick(o)}
              className="rounded-full border border-amber/60 px-3 py-1 text-[12.5px] text-amber hover:bg-amber/10"
            >
              {o.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChatThread({ snap, canRetract, onRetract, onPick }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [unseen, setUnseen] = useState(false);
  const count = snap.messages.length;

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    if (stick.current) el.scrollTop = el.scrollHeight;
    else setUnseen(true);
  }, [count]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onScroll = () => {
      stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      if (stick.current) setUnseen(false);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const toBottom = () => {
    const el = box.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  return (
    <div className="relative flex-1 min-h-0">
      <div ref={box} className="h-full overflow-y-auto px-3 py-2" aria-live="polite">
        {snap.messages.map((m) => {
          switch (m.t) {
            case "ball":
              return <BallLine key={m.id} m={m} />;
            case "over":
              return (
                <div key={m.id} className="my-2 flex items-center gap-2 text-[11px] text-muted">
                  <span className="h-px flex-1 bg-line" />
                  <span className="font-mono">{m.text}</span>
                  <span className="h-px flex-1 bg-line" />
                </div>
              );
            case "info":
              return (
                <p key={m.id} className="my-2 text-center text-[11.5px] text-muted">
                  {m.text}
                </p>
              );
            case "chat": {
              const call = m.callId ? snap.calls[m.callId] : undefined;
              return <Bubble key={m.id} m={m} snap={snap} call={call} retractable={!!call && canRetract(call)} onRetract={() => m.callId && onRetract(m.callId)} />;
            }
            case "umpire":
              return <UmpireNote key={m.id} m={m} onPick={(o) => onPick(m.id, o)} />;
            case "receipt": {
              const call = snap.calls[m.callId];
              if (!call) return null;
              const name = call.by === "you" ? snap.userName : (FRIENDS.find((f) => f.id === call.by)?.name ?? call.by);
              return <Receipt key={m.id} call={call} name={name} mine={call.by === "you"} />;
            }
          }
        })}
      </div>
      {unseen && (
        <button
          type="button"
          onClick={toBottom}
          className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-amber px-3 py-1 text-[12px] font-semibold text-ink shadow-lg"
        >
          New messages &darr;
        </button>
      )}
    </div>
  );
}
