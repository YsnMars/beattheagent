# Beat the Agent

A small showcase of how effective an AI agent is at browser use. An agent did three everyday browser tasks on one clock; you try the same tasks and see how you compare:

1. **Shopping (SoundMarket):** buy the one pair of headphones that meets a budget, a minimum rating, and a delivery deadline.
2. **Calendar (Cadence):** reschedule a meeting so it fits every attendee's free time, their working hours, and the meeting's length.
3. **Spreadsheet (Gridly):** remove duplicates by the specified columns, keep the most recently updated row from each group, and sort what's left.

One timer runs across all three stages. Each stage is validated on submit, and you advance only when it passes. A rejected submission adds 15 s. At the end you see your time next to the agent's, stage by stage, and can watch a replay of exactly how the agent did it.

The opponent is **GPT-6.1 Sol** (`gpt-6.1-sol`) running on OpenAI's **Agents API with hosted-browser computer use**. It played the exact same seeded page in a real hosted browser. The page recorded its genuine clicks, inputs, submissions, and timings, and the API recorded its browser activity, screenshots, and token usage. Runs are **precomputed**, so public play is a static site that never calls the API.

## Quick start

```bash
npm install
npm run dev            # http://localhost:5173
```

The repo includes recorded agent runs in `public/runs/`. Without any runs, `#/` deals random unrecorded seeds and plays without an agent to compare against.

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production build to `dist/` (static; deploy anywhere) |
| `npm run serve` | Serve `dist/` at http://127.0.0.1:4173 |
| `npm test` | Unit tests: generator invariants on 300 seeds, validators, run-log replay, results |
| `npm run e2e` | Playwright: full human run on desktop and mobile viewports (dealing a challenge, penalty, validation, you-vs-agent summary, replay, reload-resume, give-up) |
| `npm run agent:run -- --seeds K7M2Q` | Record a genuine agent run (costs API money; see below) |

## Recording agent runs

### Prerequisites

- `OPENAI_API_KEY` in `.env`. The project's key must have access to the Agents API beta (`OpenAI-Beta: agents=v1`; the `openai` npm SDK ≥ 7.25 exposes it as `client.beta.agents`).
- [`cloudflared`](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) on your `PATH`, or set `CLOUDFLARED=/path/to/cloudflared`. No Cloudflare account is needed; the runner uses a free quick tunnel.

### Run

```bash
npm run agent:run -- --seeds K7M2Q,P4XW9      # specific seeds
npm run agent:run -- --count 3                # random seeds
npm run agent:run -- --seeds K7M2Q --effort low --model gpt-6-astra
npm run build                                 # publish: dist/ now includes the new runs
```

Options: `--model` (default `gpt-6.1-sol`), `--effort` (reasoning effort; omitted means the model default), `--timeout-min` (default 25), `--max-nudges` (default 2), `--feature <seed>`, `--skip-build`, `--public-url <url>` (use your own public URL instead of a quick tunnel), `--port`.

### How it works

```
┌──────────────── your machine ────────────────┐        ┌────────── OpenAI ──────────┐
│ scripts/run-agent.ts                          │  API   │ Agents API session          │
│   ├─ builds dist/                             │───────▶│  model: gpt-6.1-sol         │
│   ├─ scripts/server.ts: static + /api/trace   │        │  tools: [computer_use]      │
│   └─ cloudflared quick tunnel ◀───────────────┼─https──│  hosted browser (network    │
│        https://xyz.trycloudflare.com          │        │  restricted to tunnel host) │
└───────────────────────────────────────────────┘        └─────────────────────────────┘
```

1. **Why a tunnel:** the hosted browser runs separately from the session's sandbox and refuses `localhost` (verified: a sandbox-local server was blocked even with origin access approved). The game must be served at a public HTTPS origin during recording.
2. **Session:** `client.beta.agents.sessions.create` with `tools: [{ type: "computer_use", include_screenshots: true }]` and `environment: { type: "openai_hosted", desktop: { enabled: true }, network: { access: "restricted", allowed_domains: [<tunnel host>] } }`. The runner approves `browser_origin_access` **only** for the tunnel origin, denies every other origin, and cancels any sign-in request.
3. **Identical inputs:** the agent is sent to `/#/play/<seed>?rec=<token>`, the same page and seed humans get. Its instructions (shown verbatim on the replay page) only explain that it's a timed game on simulated apps and that it may click, order, and submit without asking. The rules and each stage's task come from the page itself.
4. **Genuine interaction log:** with `rec` set, the page logs every `pointerdown` (viewport coordinates plus the `data-trace` element and the relative offset within it), scroll, reducer action (typing, filters, cart, slot picks, sorts, dedupes), and submission verdict, then POSTs the log to `/api/trace` through the tunnel. The Agents API stream adds each `computer_use_call` (title, status, screenshot) and the agent's messages.
5. **Timing:** the agent's time is measured by the page, from its click on **Start challenge** to the final accepted submission, the same way a human's is. Sandbox boot time isn't counted, and neither is the time before it presses Start.
6. **Cost:** the runner polls turn `usage` (best-effort per the docs, sometimes `null`) and prices it at the model's standard rates, plus an estimate for the hosted environment at container rates. If usage isn't reported, cost shows as "Not reported" instead of being guessed. Cache-write charges aren't exposed by the usage fields.
7. **Nudges:** if the agent ends its turn before the page reports completion, the runner sends up to `--max-nudges` generic "continue" messages. These are counted in `run.json`.
8. **Output:** `public/runs/<seed>/run.json` (page log, API activity, usage, cost, prompt) plus `public/runs/<seed>/shots/*.jpg`, and a summary row in `public/runs/index.json`.

## Recorded runs (included)

Recorded 2026-09-30 with `gpt-6.1-sol` (default reasoning effort) through the pipeline above. None needed a nudge or had a rejected submission.

| Seed | Total | Shopping | Calendar | Spreadsheet | Page clicks | Browser calls | Tokens (in / cached / out) | Cost |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| K7M2Q | 29.0 s | 7.6 s | 7.5 s | 13.9 s | 14 | 18 | 585k / 529k / 1.3k | $0.209 |
| P4XW9 | 22.7 s | 6.6 s | 4.3 s | 11.8 s | 12 | 13 | 411k / 359k / 1.1k | $0.180 |
| H8RT3 | 24.9 s | 6.6 s | 4.3 s | 14.0 s | 14 | 12 | 345k / 298k / 1.1k | $0.165 |

Observed behavior: the hosted browser acts on page elements directly. Every recorded click lands at the exact center of its target, and `<select>` values are set without pointer events. It usually solves each stage on the first try. Sub-30-second runs are hard for humans to beat, but a practiced player can do it. The e2e "perfect play" bot finishes in about 18 s.

## Game design notes

- **Deterministic seeds** (`src/challenge/generate.ts`): a seed fixes the products, calendars, and sheet. Unit tests check on 300 seeds that exactly one product and exactly one meeting slot are valid, and that the sheet's expected result is unique. Traps include near-miss prices and ratings, off-by-one delivery dates, "Best seller" badges on disqualified items, email case differences, the same email under different companies, and sorting on the wrong key.
- **Event-sourced runs** (`src/game/run.ts`): all state, including the timer, current stage, and each app's UI, is folded from an append-only log. That gives:
  - **reload-resume** for humans (no resetting the clock by refreshing), and
  - **exact replays** of the agent: `#/replay/<seed>` re-renders the real game UI at the agent's viewport size (layout uses container queries, so it matches on any screen), moves a ghost cursor to each recorded click target, and shows the hosted-browser screenshots and API activity in sync.
- **Ghost race:** during play, the HUD shows where the recorded agent was at the same elapsed time.
- **Seeds stay behind the scenes:** `#/` deals a recorded seed at random, preferring ones this browser hasn't seen, and keeps it for the tab so a reload resumes the run. The seed isn't shown anywhere. `#/play/<seed>` still opens a specific challenge; the recorder and tests use it.
- **After a run:** you see your time next to the agent's, a one-line comparison, per-stage bars, and links to watch the agent's replay or try another challenge.
- **Mobile:** every stage adapts to phones (filter chips, single-day calendar with day tabs, horizontally scrolling sheet). The e2e suite runs the full flow on a Pixel 7 viewport.

## Deploying

`npm run build` produces a fully static `dist/` (hash routing, relative asset paths) that works on GitHub Pages, Netlify, Vercel, S3, or any folder on a CDN. Record runs before building, or rebuild after recording.

## Project layout

```
src/challenge/   seeded generators, validators, reference solver
src/game/        run log + derivation, reducers, recorder hook, agent-run loaders
src/stages/      Shopping, Calendar, Sheet apps
src/pages/       Home (deals a challenge), Play, Replay
scripts/         run-agent.ts (recorder), server.ts (static + trace collector)
tests/           vitest unit tests
e2e/             Playwright end-to-end tests
public/runs/     recorded agent runs (committed; served statically)
```

## References

- Agents API computer use: https://developers.openai.com/api/docs/guides/agents-api/tools/computer-use
- GPT-6.1 Sol model page: https://developers.openai.com/api/docs/models/gpt-6.1-sol
- Observability and usage: https://developers.openai.com/api/docs/guides/agents-api/observability
