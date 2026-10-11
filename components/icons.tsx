const base = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
type P = { size?: number; className?: string };
const svg = (p: P) => ({ ...base, width: p.size ?? 18, height: p.size ?? 18, className: p.className, "aria-hidden": true });

export const SendIcon = (p: P) => (<svg {...svg(p)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
export const MicIcon = (p: P) => (<svg {...svg(p)}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>);
export const PauseIcon = (p: P) => (<svg {...svg(p)}><path d="M9 5v14M15 5v14" /></svg>);
export const PlayIcon = (p: P) => (<svg {...svg(p)}><path d="M7 5l12 7-12 7z" fill="currentColor" /></svg>);
export const NextIcon = (p: P) => (<svg {...svg(p)}><path d="M5 5l9 7-9 7z" fill="currentColor" /><path d="M18 5v14" /></svg>);
export const TrophyIcon = (p: P) => (<svg {...svg(p)}><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8" /></svg>);
export const CloseIcon = (p: P) => (<svg {...svg(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>);
export const ShareIcon = (p: P) => (<svg {...svg(p)}><path d="M12 15V4M8 8l4-4 4 4M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></svg>);
export const PinIcon = (p: P) => (<svg {...svg(p)}><path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v7" /></svg>);
