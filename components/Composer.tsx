"use client";

import { useEffect, useRef, useState } from "react";
import { MicIcon, SendIcon } from "./icons";

// Chrome and Safari ship speech recognition under a prefix and without types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const speechCtor = (): any => (typeof window === "undefined" ? null : ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null));

interface Props {
  suggestions: string[];
  disabled: boolean;
  onSend: (text: string) => void;
}

export default function Composer({ suggestions, disabled, onSend }: Props) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  // safe to read the browser here: the room only ever mounts after a click, never on the server
  const [canSpeak] = useState(() => !!speechCtor());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rec = useRef<any>(null);

  useEffect(() => () => rec.current?.abort?.(), []);

  const send = (value = text) => {
    const clean = value.trim();
    if (!clean || disabled) return;
    onSend(clean.slice(0, 200));
    setText("");
  };

  const toggleMic = () => {
    if (listening) {
      rec.current?.stop?.();
      return;
    }
    const Ctor = speechCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "en-IN";
    r.interimResults = true;
    r.maxAlternatives = 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      let heard = "";
      for (const res of e.results) heard += res[0].transcript;
      setText(heard);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    try { r.start(); } catch { setListening(false); }
  };

  return (
    <div className="border-t border-line bg-panel px-3 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))]">
      {!disabled && (
        <div className="no-scrollbar -mx-3 mb-2 flex gap-1.5 overflow-x-auto px-3">
          <span className="shrink-0 self-center text-[10px] uppercase tracking-wider text-faint">Try</span>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              className="shrink-0 rounded-full border border-line bg-raised px-3 py-1 text-[12.5px] text-muted hover:border-faint hover:text-fg"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
          maxLength={200}
          enterKeyHint="send"
          autoComplete="off"
          aria-label="Message"
          placeholder={disabled ? "Match over" : listening ? "Listening…" : "Say it like you would in the group…"}
          className="min-w-0 flex-1 rounded-full border border-line bg-ink px-4 py-2.5 text-[15px] outline-none placeholder:text-faint focus:border-amber disabled:opacity-50"
        />
        {canSpeak && !disabled && (
          <button
            type="button"
            onClick={toggleMic}
            aria-label={listening ? "Stop listening" : "Speak your message"}
            aria-pressed={listening}
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border ${listening ? "border-miss bg-miss/20 text-miss" : "border-line text-muted hover:text-fg"}`}
          >
            <MicIcon />
          </button>
        )}
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          aria-label="Send"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber text-ink disabled:opacity-40"
        >
          <SendIcon />
        </button>
      </form>
    </div>
  );
}
