"use client";

import { useEffect, useRef, useState } from "react";
import { PlayIcon, TrophyIcon } from "./icons";

export const START_POINTS = [
  { idx: 200, label: "The chase heats up", sub: "SA 101/3, need 76 off 48", time: "~4 min" },
  { idx: 220, label: "30 needed off 30", sub: "SA 147/4, Klaasen on 49", time: "~3 min" },
  { idx: 244, label: "The last over", sub: "SA need 16 off 6", time: "~1 min" },
  { idx: 0, label: "From ball one", sub: "India bat first", time: "~21 min" },
];

const STEPS = [
  { n: "01", title: "Make the call", body: "“Klaasen out this over.” Say what you think happens next, in English or Hinglish." },
  { n: "02", title: "Let the match decide", body: "The umpire turns your words into a checkable call. Every ball brings the verdict closer." },
  { n: "03", title: "Keep the receipt", body: "Earn points for being right, climb the board, and share the calls worth remembering." },
];

export default function JoinScreen({ onJoin, busy }: { onJoin: (name: string, startIdx: number) => void; busy: boolean }) {
  const nameInput = useRef<HTMLInputElement>(null);
  const [startIdx, setStartIdx] = useState(START_POINTS[0].idx);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("calledit:name");
      if (saved && nameInput.current && !nameInput.current.value) nameInput.current.value = saved;
    } catch {}
  }, []);

  const join = () => {
    if (busy) return;
    const clean = (nameInput.current?.value ?? "").trim().slice(0, 18) || "You";
    try { localStorage.setItem("calledit:name", clean); } catch {}
    onJoin(clean, startIdx);
  };

  return (
    <div className="home-shell min-h-dvh">
      <div className="mx-auto max-w-[1120px] px-5 sm:px-8">
        <header className="flex items-center justify-between border-b border-line/70 py-5">
          <span className="font-display text-[25px] leading-none tracking-wide text-amber">CALLED IT<span className="text-fg">.</span></span>
          <a href="#how-it-works" className="text-xs text-muted underline-offset-4 hover:text-fg hover:underline">How to play <span aria-hidden="true">↗</span></a>
        </header>

        <main>
          <div className="grid items-center gap-9 py-10 sm:py-14 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-16">
            <section aria-labelledby="welcome-title">
              <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-amber" /> Cricket. Calls. Bragging rights.
              </p>
              <h1 id="welcome-title" className="mt-5 font-display text-[clamp(48px,8vw,78px)] leading-[1.04] tracking-[-0.015em]">
                CALL THE MATCH.<br /><span className="text-amber">KEEP THE RECEIPT.</span>
              </h1>
              <p className="mt-5 max-w-[420px] text-[16px] leading-relaxed text-muted">
                You saw the wicket coming. You backed the comeback. Now put your cricket instincts on the record.
              </p>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-fg">
                <span><span className="mr-1.5 text-hit" aria-hidden="true">✓</span>Free to play</span>
                <span><span className="mr-1.5 text-hit" aria-hidden="true">✓</span>No account needed</span>
                <span><span className="mr-1.5 text-hit" aria-hidden="true">✓</span>English + Hinglish</span>
              </div>

              <div className="mt-8 hidden max-w-[350px] rounded-xl border border-line bg-panel/70 p-4 sm:block">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-muted">
                  <span>The group-chat energy</span><TrophyIcon size={14} className="text-amber" />
                </div>
                <p className="mt-3 text-[20px] font-medium">“Bola tha.” <span className="text-muted">Now prove it.</span></p>
                <p className="mt-2 text-xs leading-relaxed text-muted">Three bot opponents. One scoreboard. Every call on the record.</p>
              </div>
            </section>

            <section aria-labelledby="play-title" className="overflow-hidden rounded-2xl border border-line bg-panel shadow-[0_24px_80px_-32px_#000]">
              <div className="border-b border-line bg-raised/40 px-5 py-4 sm:px-6">
                <div className="flex items-center justify-between gap-3 text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
                  <span>Featured replay</span>
                  <span className="rounded border border-amber/30 bg-amber/10 px-2 py-1 text-amber">Solo mode</span>
                </div>
                <p className="mt-3 text-xl font-semibold tracking-tight">India <span className="mx-1 text-sm font-normal text-faint">vs</span> South Africa</p>
                <p className="mt-1 text-xs text-muted">T20 World Cup Final · 29 June 2024</p>
              </div>

              <form className="px-5 py-5 sm:px-6" onSubmit={(event) => { event.preventDefault(); join(); }}>
                <h2 id="play-title" className="text-lg font-semibold">Pick your moment.</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted">Step into the chase or play it from ball one.</p>

                <div className="mt-5">
                  <label htmlFor="name" className="text-xs font-medium text-fg">Your name in the chat</label>
                  <input id="name" ref={nameInput} maxLength={18} placeholder="What should we call you?" autoComplete="given-name"
                    className="mt-2 w-full rounded-lg border border-line bg-ink px-3 py-3 text-base outline-none placeholder:text-faint focus:border-amber" />
                </div>

                <fieldset className="mt-5">
                  <legend className="text-xs font-medium text-fg">Choose a starting point</legend>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {START_POINTS.map((point) => (
                      <button key={point.idx} type="button" onClick={() => setStartIdx(point.idx)} aria-pressed={startIdx === point.idx}
                        className={`relative rounded-lg border px-3 py-3 text-left transition-colors ${startIdx === point.idx ? "border-amber bg-amber/8" : "border-line hover:border-faint hover:bg-raised/40"}`}>
                        <span className="block text-[12.5px] font-medium leading-snug">{point.label}</span>
                        <span className="mt-1 block text-[10px] leading-relaxed text-muted">{point.sub}</span>
                        <span className="mt-2 block font-mono text-[10px] text-faint">{point.time}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>

                <button type="submit" disabled={busy}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-amber py-3.5 text-sm font-semibold text-ink transition hover:brightness-110 active:brightness-95 disabled:opacity-60">
                  {busy ? "Opening your match…" : <>Start playing <PlayIcon size={14} /></>}
                </button>
                <p className="mt-3 text-center text-[10px] leading-relaxed text-muted">Real match replay · 3 scripted bot opponents</p>
              </form>
            </section>
          </div>

          <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-5 border-t border-line py-8 sm:py-10">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 id="how-title" className="text-sm font-semibold">Big opinions. Actual receipts.</h2>
              <span className="text-[10px] uppercase tracking-[0.15em] text-faint">How to play</span>
            </div>
            <ol className="grid gap-6 sm:grid-cols-3 sm:gap-8">
              {STEPS.map((step) => (
                <li key={step.n}>
                  <p className="font-mono text-[11px] text-amber">{step.n}<span className="ml-3 font-sans text-sm font-semibold text-fg">{step.title}</span></p>
                  <p className="mt-2 text-xs leading-relaxed text-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </section>
        </main>

        <footer className="flex flex-col justify-between gap-3 border-t border-line py-5 text-[10px] leading-relaxed text-muted sm:flex-row sm:items-center">
          <p>For the love of the call. No money, no prizes.</p>
          <p>Match data: <a href="https://cricsheet.org/" className="underline underline-offset-2 hover:text-fg">Cricsheet</a> · <a href="https://opendatacommons.org/licenses/by/1-0/" className="underline underline-offset-2 hover:text-fg">ODC Attribution</a></p>
        </footer>
      </div>
    </div>
  );
}
