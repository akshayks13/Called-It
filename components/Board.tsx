import type { Call, RoomSnapshot } from "@/lib/room/room";
import { measured } from "@/lib/claims/settle";
import { FRIENDS } from "@/lib/room/friends";
import { MAX_OPEN_CALLS, MISS_PENALTY, TIERS } from "@/lib/room/scoring";
import { colorOf, signed, TIER_STYLE } from "./ui";

export function Standings({ snap }: { snap: RoomSnapshot }) {
  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Bragging rights</h2>
        <span className="text-[11px] text-faint">since you joined</span>
      </div>
      <ol className="mt-2 space-y-1.5">
        {snap.board.map((r, i) => {
          const me = r.who === "you";
          const blurb = FRIENDS.find((f) => f.id === r.who)?.blurb;
          return (
            <li key={r.who} className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${me ? "border-hit/50 bg-hit/5" : "border-line bg-panel"}`}>
              <span className="w-4 font-mono text-sm text-faint">{i + 1}</span>
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colorOf(r.who) }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {r.name}
                  {me && <span className="ml-1.5 text-[10px] font-normal text-hit">you</span>}
                  {!me && <span className="ml-1.5 text-[10px] font-normal text-faint">bot</span>}
                </p>
                <p className="truncate text-[11px] text-muted">
                  {r.hits} right, {r.misses} wrong{r.open ? `, ${r.open} open` : ""}
                  {blurb && r.hits + r.misses + r.open === 0 ? ` · ${blurb}` : ""}
                </p>
              </div>
              <span className={`font-mono text-base font-semibold tabular-nums ${r.points > 0 ? "text-hit" : r.points < 0 ? "text-miss" : "text-muted"}`}>
                {signed(r.points)}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-[11px] text-faint">No money, no prizes. The only stake is being right in front of your friends.</p>
    </section>
  );
}

export function OpenCalls({ calls }: { calls: Call[] }) {
  const open = calls.filter((c) => c.by === "you" && c.status === "open");
  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Your open calls</h2>
        <span className="text-[11px] text-faint">
          {open.length} of {MAX_OPEN_CALLS}
        </span>
      </div>
      {open.length === 0 ? (
        <p className="mt-2 rounded-lg border border-dashed border-line px-3 py-3 text-[12.5px] text-muted">
          Nothing on record yet. Say what you think happens next, in your own words.
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {open.map((c) => (
            <li key={c.id} className="rounded-lg border border-line bg-panel px-3 py-2">
              <p className="text-[13px] leading-snug">{c.desc}</p>
              <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                <span className={`rounded border px-1 ${TIER_STYLE[c.tier]}`}>
                  {c.tierLabel} +{c.win}
                </span>
                {c.claim.basis === "total" && c.claim.metric !== "match_winner" && <span>now on {measured(c.progress)}</span>}
                <span className="truncate italic">&ldquo;{c.text}&rdquo;</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function HowScoring() {
  return (
    <section>
      <h2 className="text-sm font-semibold">How calls are scored</h2>
      <p className="mt-1 text-[12.5px] leading-snug text-muted">
        The moment you make a call, the rest of the innings is simulated 2,000 times from that exact ball. The rarer your call comes true, the
        more it is worth. A wrong call costs {MISS_PENALTY}.
      </p>
      <p className="mt-2 text-[11px] text-faint">Chance of coming true, and what it pays</p>
      <ul className="mt-1 grid grid-cols-2 gap-1.5 text-[11.5px]">
        {TIERS.map((t, i) => (
          <li key={t.id} className={`flex items-center justify-between rounded border px-2 py-1 ${TIER_STYLE[t.id]}`}>
            <span>{t.label}</span>
            <span className="font-mono text-[10.5px] opacity-80">
              {i === 0
                ? `${Math.round(t.minP * 100)}%+`
                : i === TIERS.length - 1
                  ? `under ${Math.round(TIERS[i - 1].minP * 100)}%`
                  : `${Math.round(t.minP * 100)}\u2013${Math.round(TIERS[i - 1].minP * 100)}%`}
              <span className="ml-2 font-semibold">{t.win ? `+${t.win}` : "0"}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11.5px] leading-snug text-faint">
        The AI only reads your sentence. Whether you were right is decided by the scorecard, never by the AI.
      </p>
    </section>
  );
}
