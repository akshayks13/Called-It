"use client";

import { teamShort } from "@/lib/match/players";
import type { RoomSnapshot } from "@/lib/room/room";
import { oddsText } from "@/lib/room/scoring";
import type { PunditStats, Verdict } from "@/lib/room/stats";
import { CloseIcon, ShareIcon } from "./icons";
import { shareText } from "./Receipt";
import { signed } from "./ui";
import Dialog from "./Dialog";

interface Props {
  snap: RoomSnapshot;
  stats: PunditStats;
  verdict: Verdict;
  writtenByAi: boolean;
  onClose: () => void;
  onAgain: () => void;
}

export default function PunditCard({ snap, stats, verdict, writtenByAi, onClose, onAgain }: Props) {
  const rank = snap.board.findIndex((r) => r.who === "you") + 1;
  const lean = stats.lean.filter((l) => l.n > 0);
  const share = () =>
    shareText(
      [
        `🧾 My Called It pundit card: ${verdict.title}`,
        `${stats.hits} of ${stats.made} calls right, ${signed(stats.points)} points, #${rank} of ${snap.board.length}.`,
        stats.boldestHit ? `Best call: "${stats.boldestHit.text}" (${oddsText(stats.boldestHit.p)})` : "",
        window.location.origin,
      ]
        .filter(Boolean)
        .join("\n"),
    );

  return (
    <Dialog label="Your pundit card" onClose={onClose} className="open:grid place-items-center p-4">
      <div className="rise w-full max-w-[380px]">
        <div className="receipt px-5 pt-5 pb-5 text-[12.5px]">
          <div className="flex items-start justify-between">
            <p className="text-[10px] tracking-[0.14em] text-paper-muted">THIRD UMPIRE &middot; PUNDIT CARD</p>
            <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 -mt-1 p-1 text-paper-muted hover:text-paper-ink">
              <CloseIcon size={16} />
            </button>
          </div>
          <p className="mt-2 text-paper-muted">{snap.userName}, tonight you were</p>
          <p className="font-display text-[34px] leading-none mt-1 break-words uppercase">{verdict.title}</p>
          <p className="mt-2.5 font-sans text-[14px] leading-snug">{verdict.verdict}</p>
          {writtenByAi && <p className="mt-1 text-[10px] text-paper-muted">written by AI from your calls</p>}

          <div className="receipt-rule my-3" />
          <dl className="grid grid-cols-4 gap-2 text-center">
            {[
              ["CALLS", String(stats.made)],
              ["RIGHT", String(stats.hits)],
              ["POINTS", signed(stats.points)],
              ["RANK", `#${rank}`],
            ].map(([k, v]) => (
              <div key={k}>
                <dd className="text-[19px] font-semibold leading-none">{v}</dd>
                <dt className="mt-1 text-[9.5px] tracking-wider text-paper-muted">{k}</dt>
              </div>
            ))}
          </dl>

          {(stats.boldestHit || stats.worstMiss) && <div className="receipt-rule my-3" />}
          {stats.boldestHit && (
            <p className="leading-snug">
              <span className="text-paper-muted">BEST CALL </span>
              <span className="font-sans font-semibold">&ldquo;{stats.boldestHit.text}&rdquo;</span>
              <span className="text-paper-muted"> ({oddsText(stats.boldestHit.p)})</span>
            </p>
          )}
          {stats.worstMiss && (
            <p className="mt-1.5 leading-snug">
              <span className="text-paper-muted">WORST CALL </span>
              <span className="font-sans font-semibold">&ldquo;{stats.worstMiss.text}&rdquo;</span>
              <span className="text-paper-muted"> ({oddsText(stats.worstMiss.p)})</span>
            </p>
          )}
          {lean.length > 0 && (
            <p className="mt-1.5 leading-snug text-paper-muted">
              BACKED{" "}
              {lean.map((l, i) => (
                <span key={l.team} className="text-paper-ink">
                  {i > 0 ? ", " : ""}
                  {teamShort(l.team)} {l.n}x ({l.hits} right)
                </span>
              ))}
            </p>
          )}

          <div className="receipt-rule my-3" />
          <ol className="space-y-0.5">
            {snap.board.map((r, i) => (
              <li key={r.who} className={`flex justify-between ${r.who === "you" ? "font-semibold" : ""}`}>
                <span>
                  {i + 1}. {r.name}
                </span>
                <span>{signed(r.points)}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[10.5px] text-paper-muted">{snap.meta.result.text}. No money changed hands. Only reputations.</p>

          <div className="mt-4 flex gap-2 font-sans">
            <button type="button" onClick={share} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-paper-ink px-3 py-2 text-[13px] font-semibold text-paper">
              <ShareIcon size={14} /> Share
            </button>
            <button type="button" onClick={onAgain} className="flex-1 rounded-md border border-paper-ink/50 px-3 py-2 text-[13px] font-semibold">
              Watch again
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
