import type { TierId } from "@/lib/room/scoring";
import type { Who } from "@/lib/room/room";
import { FRIENDS } from "@/lib/room/friends";

export const TIER_STYLE: Record<TierId, string> = {
  obvious: "text-faint border-line",
  safe: "text-slate-300 border-slate-500/50",
  fair: "text-sky-300 border-sky-400/50",
  bold: "text-amber border-amber/60",
  outrageous: "text-orange-300 border-orange-400/60",
  miracle: "text-fuchsia-300 border-fuchsia-400/60",
};

export const colorOf = (who: Who) => (who === "you" ? "#35d07f" : (FRIENDS.find((f) => f.id === who)?.color ?? "#8b99a9"));

export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");
