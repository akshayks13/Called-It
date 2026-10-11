"use client";

import { useState } from "react";
import JoinScreen from "./JoinScreen";
import RoomView from "./RoomView";

interface Session {
  key: number;
  name: string;
  startIdx: number;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);

  if (!session) {
    return (
      <JoinScreen
        busy={busy}
        onJoin={(name, startIdx) => {
          // setting up the room replays the match so far; let "Opening..." paint first
          setBusy(true);
          setTimeout(() => {
            setSession({ key: Date.now(), name, startIdx });
            setBusy(false);
          }, 30);
        }}
      />
    );
  }
  return <RoomView key={session.key} name={session.name} startIdx={session.startIdx} onLeave={() => setSession(null)} />;
}
