# Called It

**Call the match. Keep the receipt.**

A free cricket replay game for the opinions you usually leave in the group chat. Call the next wicket, back a comeback, and let the scoreboard settle it. English or Hinglish. Points and bragging rights. No money or prizes.

## Play

```bash
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000), choose a name and a starting point, then **Start playing**. No account, API key or paid subscription is required.

The current release is **solo replay mode**: India v South Africa, the 2024 men's T20 World Cup final, replayed ball by ball. Rahul, Priya and Kabir are scripted bot opponents. Every visitor has their own game; shared rooms are planned.

## What you can do

- Make predictions in English or Hinglish, with ready-made suggestions when you need an idea.
- See exactly what the umpire accepted and how bold the call is.
- Follow ball-by-ball verdicts, point changes and a running leaderboard.
- Pause, change replay speed, or step through a delivery.
- Refresh and continue from the same position in the same browser tab.
- Share a receipt or your final Pundit Card.

The built-in reader and card writer run without external AI. AI is an optional enhancement and is **off by default**, including when a provider key is already present. To explicitly enable it, copy `.env.example` to `.env.local`, set `AI_ENABLED=true`, and supply your own provider key. Check the provider's current terms and quota first; AI is not needed for the free experience. Leaving the flag false prevents provider requests on both the client path and the server.

Browser speech recognition, when available, is supplied by your browser and may use its own online service. Typing is always available.

## How it works

Next.js and React provide the interface. Pure TypeScript handles match replay, simulation, prediction settlement and points. The reader converts a message into a structured claim; the scorecard decides whether it is right. Optional AI only interprets language and writes receipt/card wording.

| Area | Source |
|---|---|
| Match replay and scorecard | `lib/match/` |
| Prediction schema and settlement | `lib/claims/` |
| Built-in reader and optional AI | `lib/ai/` |
| Seeded probability simulation | `lib/sim/` |
| Chat, calls, points and session recovery | `lib/room/` |
| Interface | `components/` |

User calls are rated using 2,000 simulated finishes from the moment they were made. Calls estimated at 85% or more are too obvious to score. Accepted hits earn between 10 and 500 points according to their tier; a miss costs 20. Each player can have three calls open.

The simulator uses historical men's T20I rates from before the replayed match. These are estimates for this replay, not a calibrated prediction service for every competition.

## Reliability

- Duplicate delayed responses cannot award the same call twice.
- Limits and outcomes are checked against the original match position.
- The final card waits for outstanding reads; slow AI requests fall back to the built-in reader after 15 seconds.
- Refresh recovery replays saved actions rather than trusting saved point totals. Leaving the match clears the tab's saved session.
- API request bodies are bounded and validated. Fonts are bundled locally, so builds do not fetch fonts from Google.

## Development checks

```bash
npm test
npm run lint
npx tsc --noEmit
npm run eval:rules
npm run eval:rules:fresh
npm run build
npm run test:e2e
```

Browser tests use a local production build and Google Chrome. They cover desktop/mobile play, refresh, delayed responses, request timeouts and keyboard focus. Test mode enables the optional reader request path with empty provider keys and mocked browser responses; no real AI requests are needed. For bundled Chromium, run `npx playwright install chromium`, then `PLAYWRIGHT_CHANNEL=chromium npm run test:e2e`.

## Roadmap

The next release should let a host create a private room, share a code, and play the replay with real friends. The [free-only product plan](docs/PRODUCT_PLAN.md) covers identity, server-owned scoring, realtime updates, quota limits, recovery, testing and a phased rollout. It is a plan, not a list of features already available.

The budget is **zero recurring spend**. The plan uses free hosting/database tiers within explicit limits, the built-in reader, existing replay data and provider subdomains. Paid AI, live sports feeds, subscriptions and expiring paid trials are not dependencies.

## Data and attribution

Ball-by-ball data is provided by [Cricsheet](https://cricsheet.org/) under the [Open Data Commons Attribution License 1.0](https://opendatacommons.org/licenses/by/1-0/). The match data is transformed into the application's replay format; historical deliveries are aggregated for simulation rates. Cricsheet does not endorse this application. See [third-party notices](THIRD_PARTY_NOTICES.md).

To rebuild from your own downloaded Cricsheet JSON:

```bash
npx tsx scripts/build-match.ts <cricsheet-match.json>
npx tsx scripts/build-rates.ts <directory-of-cricsheet-t20s>
```

Current limitations: one replay, fixed squads, three scripted bot opponents, and no shared multiplayer backend. Browser storage is local to the tab. Server request limits for optional AI are best-effort per instance.
