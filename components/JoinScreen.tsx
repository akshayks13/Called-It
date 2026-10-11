"use client";

import { useEffect, useRef, useState } from "react";

export const START_POINTS = [
  { idx: 200, label: "The chase heats up", sub: "SA 101/3, need 76 off 48" },
  { idx: 220, label: "30 needed off 30", sub: "SA 147/4, Klaasen on 49" },
  { idx: 244, label: "The last over", sub: "SA need 16 off 6" },
  { idx: 0, label: "From ball one", sub: "India bat first" },
];

const STEPS = [
  { n: "1", title: "Just chat", body: "Type or speak the way you do in your match group. English or Hinglish." },
  { n: "2", title: "The umpire catches your calls", body: "“Klaasen agle over mein out pakka” becomes a precise, checkable call, rated by how bold it is." },
  { n: "3", title: "Receipts, ball by ball", body: "Right? “Bola Tha!” and the points. Wrong? A roast, on the record. No money, only bragging rights." },
];

export default function JoinScreen({ onJoin, busy }: { onJoin: (name: string, startIdx: number) => void; busy: boolean }) {
  const nameInput = useRef<HTMLInputElement>(null);
  const [startIdx, setStartIdx] = useState(START_POINTS[0].idx);

  // prefill the name from the last visit (after hydration, so server and client HTML match)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("bolatha:name");
      if (saved && nameInput.current && !nameInput.current.value) nameInput.current.value = saved;
    } catch {}
  }, []);

  const join = () => {
    const clean = (nameInput.current?.value ?? "").trim().slice(0, 18) || "You";
    try {
      localStorage.setItem("bolatha:name", clean);
    } catch {}
    onJoin(clean, startIdx);
  };

  return (
    <div className="min-h-dvh flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-[440px]">
        <p className="text-[11px] tracking-[0.2em] text-muted uppercase">Third umpire for your match group chat</p>
        <h1 className="font-display text-amber text-[64px] leading-[0.95] mt-2">BOLA THA!</h1>
        <p className="mt-3 text-[17px] leading-snug text-fg">
          Every fan calls the match. Nobody keeps score. <span className="text-muted">Until now.</span>
        </p>

        <ol className="mt-6 space-y-3">
          {STEPS.map((s) => (
            <li key={s.n} className="flex gap-3">
              <span className="font-mono text-amber text-sm mt-0.5 w-4 shrink-0">{s.n}</span>
              <div>
                <p className="text-sm font-semibold">{s.title}</p>
                <p className="text-sm text-muted leading-snug">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-7 rounded-xl border border-line bg-panel p-4">
          <label htmlFor="name" className="text-xs text-muted">Your name in the chat</label>
          <input
            id="name"
            ref={nameInput}
            onKeyDown={(e) => e.key === "Enter" && join()}
            maxLength={18}
            placeholder="e.g. Akshay"
            autoComplete="given-name"
            className="mt-1 w-full rounded-lg bg-ink border border-line px-3 py-2.5 text-base outline-none focus:border-amber"
          />

          <p className="mt-4 text-xs text-muted">Join the match at</p>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {START_POINTS.map((p) => (
              <button
                key={p.idx}
                type="button"
                onClick={() => setStartIdx(p.idx)}
                aria-pressed={startIdx === p.idx}
                className={`text-left rounded-lg border px-3 py-2 transition-colors ${startIdx === p.idx ? "border-amber bg-amber/10" : "border-line hover:border-faint"}`}
              >
                <span className="block text-sm font-medium">{p.label}</span>
                <span className="block text-[11px] text-muted font-mono mt-0.5">{p.sub}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={join}
            disabled={busy}
            className="mt-4 w-full rounded-lg bg-amber text-ink font-semibold py-3 text-base hover:brightness-110 active:brightness-95 disabled:opacity-60"
          >
            {busy ? "Opening the chat…" : "Join the chat"}
          </button>
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-faint">
          This is a replay of a real match, played back ball by ball as if live: ICC Men&apos;s T20 World Cup Final, India v South Africa,
          29 June 2024. Ball-by-ball data from Cricsheet. Rahul, Priya and Kabir are scripted demo friends, not real people.
        </p>
      </div>
    </div>
  );
}
