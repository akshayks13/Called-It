"use client";

import { useEffect, useRef, useState } from "react";
import { PlayIcon } from "./icons";
import Brand from "./Brand";

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
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <header className="flex items-center justify-between border-b border-line/70 py-5 sm:py-6">
          <Brand />
          <div className="flex items-center gap-8">
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-muted sm:block">For the armchair experts.</span>
            <a href="#how-it-works" className="text-xs text-fg underline-offset-4 hover:text-amber hover:underline">How to play <span aria-hidden="true">↗</span></a>
          </div>
        </header>

        <main>
          <div className="grid items-start gap-10 py-9 sm:py-12 lg:grid-cols-[1.15fr_1fr] lg:gap-16 lg:py-14">
            <section aria-labelledby="welcome-title">
              <p className="flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-amber" /> The cricket prediction clubhouse
              </p>
              <h1 id="welcome-title" className="mt-6 font-display text-[clamp(44px,13.8vw,72px)] leading-[0.98] tracking-[-0.015em] lg:text-[clamp(64px,6vw,84px)]">
                BIG CALLS.<br />SMALL MARGINS.<br /><span className="text-amber">REAL RECEIPTS.</span>
              </h1>
              <p className="mt-6 max-w-[400px] text-[15px] leading-relaxed text-muted">
                Everyone&apos;s an expert. Until it&apos;s on record. Replay a classic, call the next twist, and let the scoreboard do the talking.
              </p>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-fg">
                <span><span className="mr-1.5 text-hit" aria-hidden="true">✓</span>Free to play</span>
                <span><span className="mr-1.5 text-hit" aria-hidden="true">✓</span>No account needed</span>
                <span><span className="mr-1.5 text-hit" aria-hidden="true">✓</span>English + Hinglish</span>
              </div>

              <div className="relative mt-10 hidden min-h-[205px] max-w-[460px] items-center justify-between gap-4 overflow-hidden border-t border-line pt-6 sm:flex">
                <span className="pitch-lines" aria-hidden="true" />
                <div className="relative z-10 max-w-[170px]">
                  <p className="font-display text-[32px] leading-none">“BOLA THA.”</p>
                  <p className="mt-3 text-xs leading-relaxed text-muted">The group chat forgets.<br />The receipt doesn&apos;t.</p>
                </div>
                <div className="demo-receipt receipt relative z-10 mr-5 w-[205px] shrink-0 px-5 py-5" aria-label="Example receipt: wicket this over, called it, plus 120 points">
                  <p className="flex justify-between text-[8px] tracking-wider"><span>CALLED IT / RECEIPT</span><span>№ 018</span></p>
                  <div className="receipt-rule my-3" />
                  <p className="text-[12px] font-semibold">Wicket this over.</p>
                  <div className="mt-3 flex items-center justify-between"><span className="stamp stamp-hit text-[19px]">CALLED IT</span><span className="text-[19px] font-bold">+120</span></div>
                  <p className="mt-4 text-[8px] tracking-wide">ILLUSTRATIVE RECEIPT · BRAGGING RIGHTS ONLY</p>
                </div>
              </div>
            </section>

            <section aria-labelledby="play-title" className="match-ticket overflow-hidden rounded-xl border border-line">
              <div className="relative overflow-hidden border-b border-dashed border-line px-5 py-6 sm:px-6">
                <span aria-hidden="true" className="pointer-events-none absolute -right-2 bottom-0 font-display text-[100px] leading-none text-fg/[0.025]">2024</span>
                <div className="flex items-center justify-between gap-3 text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
                  <span className="whitespace-nowrap font-mono">Match file / 001</span>
                  <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-amber/30 px-2.5 py-1 text-amber"><span className="h-1 w-1 rounded-full bg-amber" />Solo replay</span>
                </div>
                <div className="relative mt-5 flex items-center gap-4 font-display text-[42px] leading-none sm:text-[48px]">
                  <span>IND<span className="mt-2 block font-sans text-[10px] font-medium tracking-wide text-muted">INDIA</span></span>
                  <span className="font-mono text-[13px] text-faint">vs</span>
                  <span>SA<span className="mt-2 block font-sans text-[10px] font-medium tracking-wide text-muted">SOUTH AFRICA</span></span>
                  <span className="ml-auto hidden rotate-[-8deg] border-2 border-amber/60 px-2 py-1 font-mono text-[10px] tracking-widest text-amber min-[360px]:block">THE FINAL</span>
                </div>
                <p className="mt-5 font-mono text-[10px] text-muted">T20 WORLD CUP · 29 JUN 2024 · BARBADOS</p>
              </div>

              <form className="px-5 py-5 sm:px-6" onSubmit={(event) => { event.preventDefault(); join(); }}>
                <h2 id="play-title" className="font-display text-[26px] tracking-wide">YOUR CALL STARTS HERE.</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted">Step into the chase or play it from ball one.</p>

                <div className="mt-5">
                  <label htmlFor="name" className="text-xs font-medium text-fg">Your name in the chat</label>
                  <input id="name" ref={nameInput} maxLength={18} placeholder="What should we call you?" autoComplete="given-name"
                    className="mt-2 w-full rounded-lg border border-line bg-ink px-3 py-3 text-base outline-none placeholder:text-faint focus:border-amber" />
                </div>

                <fieldset className="mt-5">
                  <legend className="text-xs font-medium text-fg">Choose a starting point</legend>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {START_POINTS.map((point, index) => (
                      <button key={point.idx} type="button" onClick={() => setStartIdx(point.idx)} aria-pressed={startIdx === point.idx}
                        className={`moment-option relative rounded-md border px-3 py-3 text-left ${startIdx === point.idx ? "border-amber/70 bg-amber/8" : "border-line hover:border-faint hover:bg-raised/40"}`}>
                        <span className="mb-2 flex items-center justify-between font-mono text-[9px] tracking-wide text-faint"><span>0{index + 1} / JUMP IN</span><span className={startIdx === point.idx ? "text-amber" : "text-faint"} aria-hidden="true">{startIdx === point.idx ? "●" : "○"}</span></span>
                        <span className="block text-[12.5px] font-medium leading-snug">{point.label}</span>
                        <span className="mt-1 block text-[10px] leading-relaxed text-muted">{point.sub}</span>
                        <span className="mt-2 block font-mono text-[10px] text-faint">{point.time}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>

                <button type="submit" disabled={busy}
                  className="mt-5 flex w-full items-center justify-between gap-2 rounded-md bg-amber px-5 py-4 text-sm font-bold text-ink hover:brightness-110 active:translate-y-px disabled:opacity-60">
                  {busy ? "Opening your match…" : <>Start playing <PlayIcon size={16} /></>}
                </button>
                <p className="mt-3 text-center text-[10px] leading-relaxed text-muted">You + 3 scripted bots. One scoreboard. No money.</p>
              </form>
            </section>
          </div>

          <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-5 border-t border-line py-8 sm:py-10">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 id="how-title" className="font-display text-[24px] tracking-wide">TALK IS CHEAP. PUT IT ON RECORD.</h2>
              <span className="hidden font-mono text-[10px] uppercase tracking-[0.15em] text-faint sm:block">The rules of the clubhouse</span>
            </div>
            <ol className="grid gap-6 sm:grid-cols-3 sm:gap-8">
              {STEPS.map((step) => (
                <li key={step.n}>
                  <p className="flex items-center gap-3 font-mono text-[11px] text-amber"><span className="grid h-8 w-8 place-items-center rounded-full border border-line">{step.n}</span><span className="font-sans text-sm font-semibold text-fg">{step.title}</span></p>
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
