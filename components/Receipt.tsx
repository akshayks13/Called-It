"use client";

import { oddsText } from "@/lib/room/scoring";
import type { Call } from "@/lib/room/room";
import { ShareIcon } from "./icons";
import { signed, stampFor } from "./ui";

export function receiptShareText(call: Call, url: string): string {
  const hit = call.status === "hit";
  return [
    hit ? `\uD83E\uDDFE ${stampFor(call.text, true)}` : "\uD83E\uDDFE Third umpire receipt",
    `I said "${call.text}" at ${call.said.score}.`,
    `Checked: ${call.desc} ${hit ? "✅" : "❌"} (${oddsText(call.p)})`,
    `${signed(call.settled?.points ?? 0)} bragging rights.`,
    url,
  ].join("\n");
}

export async function shareText(text: string) {
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return;
    }
  } catch {
    return; // the user closed the share sheet
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
}

/** The paper slip the third umpire posts when a call is settled. */
export default function Receipt({ call, name, mine }: { call: Call; name: string; mine: boolean }) {
  if (!call.settled) return null;
  const hit = call.status === "hit";
  return (
    <div className={`rise mx-auto my-2 w-full ${mine ? "max-w-[340px]" : "max-w-[310px]"}`}>
      <div className={`receipt px-4 text-[12px] leading-snug shadow-lg ${mine ? "py-4" : "py-3.5"}`}>
        <div className="flex justify-between text-[10px] tracking-[0.14em] text-paper-muted">
          <span>THIRD UMPIRE</span>
          <span>{call.settled.over} OV</span>
        </div>

        <p className="mt-2 text-paper-muted">
          {mine ? "You" : name} said at {call.said.score}:
        </p>
        <p className={`mt-0.5 font-sans font-semibold leading-snug ${mine ? "text-[14px]" : "text-[13px]"}`}>&ldquo;{call.text}&rdquo;</p>

        <div className="receipt-rule my-2.5" />
        {mine ? (
          <dl className="grid grid-cols-[62px_1fr] gap-y-1">
            <dt className="text-paper-muted">CHECKED</dt>
            <dd>{call.desc}</dd>
            <dt className="text-paper-muted">RATED</dt>
            <dd>
              {call.tierLabel} ({oddsText(call.p)})
            </dd>
          </dl>
        ) : (
          <p>
            {call.desc} <span className="text-paper-muted">&middot; {call.tierLabel}</span>
          </p>
        )}
        <div className="receipt-rule my-2.5" />

        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="font-sans italic text-[13px] leading-snug">{call.settled.line}</p>
            <p className="mt-1.5 text-[13px] font-semibold">POINTS {signed(call.settled.points)}</p>
          </div>
          <span className={`stamp thump shrink-0 ${mine ? "text-[26px]" : "text-[19px]"} ${hit ? "stamp-hit" : "stamp-miss"}`}>
            {stampFor(call.text, hit)}
          </span>
        </div>

        {mine && (
          <button
            type="button"
            onClick={() => shareText(receiptShareText(call, window.location.origin))}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-paper-ink/40 px-2.5 py-1.5 font-sans text-[12px] font-medium hover:bg-paper-ink/5"
          >
            <ShareIcon size={14} /> Share receipt
          </button>
        )}
      </div>
    </div>
  );
}
