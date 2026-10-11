import { short, teamShort } from "@/lib/match/players";
import { chase, oversText } from "@/lib/match/replay";
import type { Ball } from "@/lib/match/types";
import type { RoomSnapshot } from "@/lib/room/room";

function chip(b: Ball): { text: string; cls: string } {
  if (b.wicket) return { text: "W", cls: "bg-miss text-ink" };
  if (b.six) return { text: "6", cls: "bg-amber text-ink" };
  if (b.four) return { text: "4", cls: "bg-sky-400 text-ink" };
  if (b.wide) return { text: "wd", cls: "bg-raised text-muted" };
  if (b.noball) return { text: "nb", cls: "bg-raised text-muted" };
  if (b.total === 0) return { text: "•", cls: "bg-raised text-faint" };
  return { text: String(b.total), cls: "bg-raised text-fg" };
}

export default function Scoreboard({ snap }: { snap: RoomSnapshot }) {
  const s = snap.state;
  const inn = s.innings[s.inn];
  const c = chase(s);
  const first = s.innings[0];
  const bat = (id: string | null, onStrike: boolean) => {
    if (!id) return null;
    const b = inn.bat[id];
    return (
      <span className={onStrike ? "text-fg" : "text-muted"}>
        {short(id)}
        {onStrike ? "*" : ""} <span className="font-mono">{b ? `${b.runs} (${b.balls})` : "0 (0)"}</span>
      </span>
    );
  };
  const bowl = s.bowler ? inn.bowl[s.bowler] : undefined;

  return (
    <div className="px-3 pb-2.5">
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-sm font-semibold text-muted">{teamShort(inn.team)}</span>
          <span className="font-mono text-amber text-[30px] leading-none font-semibold tabular-nums">
            {inn.runs}/{inn.wickets}
          </span>
          <span className="font-mono text-sm text-muted tabular-nums">({oversText(inn.legal)})</span>
        </div>
        <div className="text-right text-[13px] leading-tight shrink-0">
          {s.done ? (
            <span className="text-hit font-semibold">{snap.meta.result.text}</span>
          ) : c ? (
            <>
              <span className="font-semibold">
                Need {c.need} off {c.balls}
              </span>
              <span className="block text-[11px] text-muted">Target {c.target}</span>
            </>
          ) : (
            <span className="text-muted">1st innings</span>
          )}
        </div>
      </div>

      {!s.done && (
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[12px]">
          <div className="flex gap-3 min-w-0 truncate">
            {bat(s.striker, true)}
            {bat(s.nonStriker, false)}
          </div>
          {s.bowler && (
            <span className="text-muted shrink-0">
              {short(s.bowler)} <span className="font-mono">{bowl ? `${bowl.wickets}/${bowl.runs}` : "0/0"}</span>
            </span>
          )}
        </div>
      )}

      <div className="mt-1.5 flex items-center gap-1 h-5">
        {s.inn === 1 && <span className="text-[11px] text-faint mr-1 font-mono">{teamShort(first.team)} {first.runs}/{first.wickets}</span>}
        {snap.thisOver.length > 0 && <span className="text-[10px] uppercase tracking-wider text-faint mr-0.5">This over</span>}
        {snap.thisOver.map((b) => {
          const k = chip(b);
          return (
            <span key={b.i} className={`inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-[10px] font-mono font-semibold ${k.cls}`}>
              {k.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}
