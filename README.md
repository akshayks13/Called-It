# Called It

**The third umpire for your match group chat.**

<p align="center">
  <img src="assets/called-it-logo.png" alt="Called It: the third umpire for your match group chat" width="260">
</p>

Live demo: https://calledit-live.vercel.app

Fans don't just watch a match, they call it: "Bumrah gets him this over", "200 pakka". Those calls vanish in the group chat and nobody keeps score. Called It lets you chat the way you already do, in English or Hinglish. An AI third umpire spots the predictions hidden in the banter, turns each one into a precise, checkable call, rates how bold it is, settles it ball by ball, and posts the receipt: "Called it!" or a roast. The umpire answers in the fan's own language, so a Hinglish call gets a "Bola tha!" stamp. No money, no prizes. The stake is being right in front of your friends.

The demo replays a real match ball by ball as if it were live (ICC Men's T20 World Cup Final 2024, India v South Africa), so it works whenever you open it.

## Run it

```bash
npm install
cp .env.example .env.local   # add your GEMINI_API_KEY
npm run dev                  # http://localhost:3000
```

Without a key the app still works: messages are read by the built-in rules instead of the AI.

## How it works

The language model handles language. Code handles facts and maths.

| Part | Done by | Where |
|---|---|---|
| Is this message a prediction? What exactly is being claimed? | Gemini, constrained to a JSON schema | `lib/ai/prompt.ts`, `lib/ai/read.ts` |
| Was the call right? | Pure function over the scorecard | `lib/claims/settle.ts` |
| How bold was it? | 2,000 simulated finishes from that exact ball | `lib/sim/simulate.ts` |
| Points and the board | Code | `lib/room/scoring.ts`, `lib/room/room.ts` |
| Pundit Card | Stats in code, wording by Gemini | `lib/room/stats.ts`, `app/api/report` |

**Obvious guesses earn nothing.** A call that is 85% or more likely when made is a "no-ball": not recorded, no points. Rarer calls pay more (Safe +10, Fair +40, Bold +120, Outrageous +250, Miracle +500). A wrong call costs 20. At most 3 open calls per person.

**The simulator** learns its ball-outcome rates from 415 men's T20 internationals between full-member teams (2019 to the day before the replayed match), plus each player's own T20I record before that date. Nothing from the replayed match is used. See `scripts/build-rates.ts`.

**Living inside a small AI quota.** Only the user's own messages can reach the AI, and only if a cheap filter thinks they might contain a prediction. If Gemini refuses, an optional second provider (Groq) is tried, then a rule-based reader. Ball events, settlement, scoring and the demo friends never use the AI.

**Demo friends.** Rahul, Priya and Kabir are scripted (`lib/room/friends.ts`). Their calls go through the same rating and settlement as yours.

## Checks

```bash
npm test             # 33 tests: replay matches the real scorecard, settlement, simulator, reader, a full match in the room
npm run eval:rules   # 32 sample messages through the rule-based reader
npm run eval:reader  # the same 32 through the AI (uses about 25 AI requests)
```

## Rebuilding the data

```bash
npx tsx scripts/build-match.ts <cricsheet-match.json>   # -> data/match.json
npx tsx scripts/build-rates.ts <dir-of-cricsheet-t20s>  # -> data/rates.json
```

Ball-by-ball data: [Cricsheet](https://cricsheet.org).

## Known limits

- One match, replayed. The feed sits behind one class (`lib/match/replay.ts`) so a live provider could replace it.
- One real person per room. Friends joining by link is the next step.
- The simulator does not know who will bowl the next over, so "Bumrah wicket next over" is rated on the chance he bowls it.
- Request limits are kept in memory per server instance, so they slow abuse rather than stop it.
