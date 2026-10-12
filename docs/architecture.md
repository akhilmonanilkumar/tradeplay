# Architecture

## Overview

```
Browser (PWA)
  │  HTTPS
  ▼
Vercel  ──or──  Docker (Caddy → Next.js standalone)
  │  proxy.ts: IP allowlist + per-request CSP nonce
  │  Next.js 16 App Router — all pages are client components
  │
  │  supabase-js (publishable key + user JWT)
  ▼
Supabase (Mumbai, ap-south-1) — project `trade-journal` (ref drdpzpaeuvelbsdxhndw)
  ├─ Auth: magic-link email, single owner enforced by DB trigger
  ├─ Postgres: accounts · setups · trades · payouts · reviews · day_plans  (RLS on all)
  └─ Storage: private `screenshots` bucket (images ≤5 MB, per-user folder RLS)
```

The browser talks to Supabase directly; Postgres row-level security is the authorisation layer.
The Next.js server serves the app shell, applies security headers, (optionally) blocks non-allowlisted IPs, and
runs three thin route handlers that act **as the signed-in user** (JWT verified, RLS applies):

| Route | Purpose |
|---|---|
| `POST /api/ai`, `GET /api/ai` | The coach: one agent, any provider (`lib/ai/*`) — see [ai-coach.md](ai-coach.md) |
| `POST /api/ai/transcribe` | Speech-to-text fallback for browsers without the Web Speech API |
| `GET /api/market` | BTC/gold prices (Kraken → CoinGecko), RSS headlines, Forex Factory weekly calendar — cached 2–15 min |

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript strict | Free on Vercel, standalone output for Docker |
| Styling | Tailwind 4 + CSS variables, Geist fonts, dark default + light/system via cookie | No UI library, small bundle |
| AI | Provider adapters (Anthropic, OpenAI, Gemini, any OpenAI-compatible) | Model-agnostic single coach |
| Charts | Hand-written SVG components (`components/Charts.tsx`) | Interactive (hover, click-to-drill) without a chart dependency |
| Data | Supabase Postgres + Auth + Storage | Free tier, RLS, magic links |
| Hosting | Vercel (Hobby) or any Docker host | Atomic deploys / rolling updates |
| CI/CD | GitHub Actions + Vercel Git integration + GHCR | See [deployment.md](deployment.md) |

## Source map

```
app/
  layout.tsx            Root layout (headers → dynamic → CSP nonce; theme cookie; Geist; OG/icons)
  page.tsx              Today — quote, snapshot, actions, check-in, AI outlook, guardrail cards,
                        economic week, markets & news, open positions, lessons
  plan/page.tsx         Pre-market plan per account per day (sessions, news, voice)
  new/page.tsx          New trade — A+ gate, sizing, guardrails, mental state, coach check, voice
  trades/page.tsx       Trade log, filters, CSV export, deep links (?open=, ?status=)
  analytics/page.tsx    Insights — Overview/Calendar/Performance/Patterns/Emotions/Tools tabs
  coach/page.tsx        Chat, threads, memory, knowledgebase, lessons
  review/page.tsx       Weekly recap + reflection (coach draft, voice)
  accounts/page.tsx     Account rules, risk ladder, equity sync, payouts, delete/close, setups
  login/page.tsx        Magic-link sign-in
  api/ai/route.ts       Coach tasks (chat, brief, outlook, precheck, manage, analyze, parse, review)
  api/ai/transcribe/    Speech-to-text fallback
  api/market/route.ts   Prices, headlines, economic calendar
  api/health/route.ts   Liveness probe for Docker / load balancers
components/
  Shell.tsx             Auth gate, data loading, sidebar/bottom nav, theme, ⌘K, reminders
  TodayWidgets.tsx      Quote, Snapshot, Actions, Check-in, Outlook, Don't-repeat
  Market.tsx            Markets & news panel, weekly economic calendar with risk windows
  InsightsTabs.tsx      Calendar, Performance, Patterns, Emotions, Tools tabs
  TradeModal.tsx        Close / edit trade, tags, screenshots, emotion tracker, diagnosis
  TradeInsight.tsx      EmotionTimeline, TradeDiagnosis (win/loss causes → lessons, in-trade help)
  Voice.tsx             Mic button (Web Speech API → server STT fallback)
  coach-ui.tsx          Safe markdown, proposed-action chips
  CommandPalette.tsx    ⌘K navigation, actions, trade search, ask-coach
  Reminders.tsx         Bell + system notifications
  Charts.tsx            LineChart, HBars, VBars, Histogram, Heatmap, PnlCalendar, Scatter, Bands, Ring
  Brand.tsx · ui.tsx    Logo; Card, Stat, Badge, Meter, Segmented, Check, Field, Chips, Modal, …
lib/
  calc.ts               Trading maths — sizing, account state, risk ladder, guardrails,
                        sessions (DST-aware, per-plan + custom IST window), discipline, stats
  analysis.ts           Trade diagnosis, recurring causes, lessons matching, drawdown, rolling,
                        streaks, patterns, emotions, what-if, Monte Carlo, dictation parser
  nudges.ts · events.ts Reminders/nudges; economic-event risk windows
  quotes.ts             Quote of the day + playbook principle
  coach.ts              Client: authed fetch, askCoach, apply proposed actions
  ai/                   Server: providers (adapters), agent (prompts), context, auth, playbook
  market.ts             Server: prices, RSS, calendar fetchers
  *.test.ts             Unit tests (node --test), run in CI and inside the Docker build
  types.ts              Row types + constants
  supabase.ts           Browser client
proxy.ts                IP allowlist + nonce CSP (Next 16 "proxy" = middleware)
next.config.mjs         Static security headers, standalone output
supabase/schema.sql     Full database definition (tables, RLS, storage, owner lock, seed)
Dockerfile, docker-compose.yml, deploy/Caddyfile, scripts/rolling-deploy.sh
.github/workflows/      ci.yml (test/build/docker smoke), release.yml (GHCR + optional VPS rollout)
docs/                   This documentation
```

## Data flow

1. `Shell` waits for a Supabase session; no session → `/login`.
2. On sign-in it loads **all** rows for the user in parallel (accounts, setups, trades ≤5000, payouts, reviews, day_plans ≤400) into React context. A single trader's data is small, so every screen computes from memory — instant filtering and drill-downs.
3. Writes go straight to Supabase, then `refresh()` reloads.
4. Derived numbers that must be consistent everywhere are **generated columns in Postgres**: `rr_planned`, `net_pnl`, `r_multiple`, `gate_score`.
5. Time-dependent state (equity, daily stop, tier, window, news block) is computed client-side in `lib/calc.ts` from the account's rules and trade history.

## Key calculations (`lib/calc.ts`)

| Function | What it does |
|---|---|
| `positionSize` | `risk ÷ (contract_size × (|entry−SL| + entry × fee_rate))` — fees included, so a stop-out loses exactly the risk |
| `dayStart` | Most recent daily reset instant using the account's `day_reset_utc` (Breakout 00:30 UTC) |
| `accountState` | Equity, start-of-day balance, floors, risk tier, loss-streak cut, slots left, every blocking reason |
| `tierFor` | First ladder tier where equity ≥ `min_equity` |
| `sessionAt` / `windowOpen` | Q-zones defined in New York time (London 02–05, NY 07–10, Asia 20–24) so US DST is automatic; today's plan can choose any mix of sessions or a custom IST window, else the account default |
| `diagnoseTrade` | Rule-engine post-mortem: gate gaps, R:R, oversize, override, bias, window, news, revenge, overtrading, stop slip, cut winner, tags → verdict + lesson |
| `monteCarlo` | Resamples your R outcomes, compounding risk, personal day stop, firm daily/overall breach → pass/breach odds and bands |
| `newsBlock` | Blocks ±15 min around news times saved in today's plan (IST) |
| `disciplineScore` | Last 100 trades: 30% gate 8/8 · 25% risk ≤ plan · 25% no override · 20% no mistakes |
| `stats` / `groupStats` | Win rate, expectancy, profit factor, max DD in R, A+ rate, per-group breakdowns |
