"use client";

import { useEffect, useState } from "react";
import match from "@/data/match.json";
import type { MatchData } from "@/lib/match/types";
import { Room, SESSION_KEY } from "@/lib/room/room";
import JoinScreen from "./JoinScreen";
import RoomView from "./RoomView";

interface Session {
  key: number;
  room: Room;
  resumed: boolean;
}

const DATA = match as unknown as MatchData;

export default function App({ aiEnabled = false }: { aiEnabled?: boolean }) {
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = sessionStorage.getItem(SESSION_KEY);
        const room = saved ? Room.restore(DATA, saved) : null;
        if (room) setSession({ key: Date.now(), room, resumed: true });
        else sessionStorage.removeItem(SESSION_KEY);
      } catch {}
      setReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  if (!session) {
    return (
      <JoinScreen
        busy={busy || !ready}
        onJoin={(name, startIdx) => {
          // setting up the room replays the match so far; let "Opening..." paint first
          setBusy(true);
          setTimeout(() => {
            setSession({ key: Date.now(), room: new Room(DATA, { userName: name, startIdx }), resumed: false });
            setBusy(false);
          }, 30);
        }}
      />
    );
  }
  return <RoomView key={session.key} room={session.room} aiEnabled={aiEnabled} resumed={session.resumed} onLeave={() => {
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
    setSession(null);
  }} />;
}
