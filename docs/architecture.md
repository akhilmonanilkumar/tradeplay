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

There is **no custom backend**. The browser talks to Supabase directly; Postgres row-level security
is the authorisation layer. The Next.js server only serves the app shell, applies security headers,
and (optionally) blocks non-allowlisted IPs.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript strict | Free on Vercel, standalone output for Docker |
| Styling | Tailwind 3 + CSS variables (dark-first, light fallback) | No UI library, small bundle |
| Charts | Hand-written SVG components (`components/Charts.tsx`) | Interactive (hover, click-to-drill) without a chart dependency |
| Data | Supabase Postgres + Auth + Storage | Free tier, RLS, magic links |
| Hosting | Vercel (Hobby) or any Docker host | Atomic deploys / rolling updates |
| CI/CD | GitHub Actions + Vercel Git integration + GHCR | See [deployment.md](deployment.md) |

## Source map

```
app/
  layout.tsx            Root layout (reads headers → dynamic → CSP nonce applies), PWA metadata
  page.tsx              Today — per-account guardrail cards, open positions, discipline, rule breaks
  plan/page.tsx         Pre-market plan per account per day (checklist, bias, news times)
  new/page.tsx          New trade — A+ gate, sizing, guardrails, override-with-reason
  trades/page.tsx       Trade log, filters, CSV export
  analytics/page.tsx    Insights dashboard — KPIs, curve, drill-down breakdowns, heatmap, calendar
  review/page.tsx       Weekly recap + reflection
  accounts/page.tsx     Account rules, risk ladder, payouts, setups
  login/page.tsx        Magic-link sign-in
  api/health/route.ts   Liveness probe for Docker / load balancers
components/
  Shell.tsx             Auth gate, data loading (single fetch of all tables), nav, onboarding seed
  TradeModal.tsx        Close / edit trade, tags, screenshots (signed URLs), delete
  Charts.tsx            LineChart, HBars, Histogram, Heatmap, PnlCalendar, Ring
  ui.tsx                Card, Stat, Badge, Meter, Segmented, Check, Field, Chips, Modal, …
lib/
  calc.ts               All trading maths — sizing, R:R, account state, risk ladder, guardrails,
                        sessions (DST-aware), discipline score, stats, formatting
  calc.test.ts          Unit tests (node --test), run in CI and inside the Docker build
  types.ts              Row types + constants (gate checks, pre-market checklist, tags)
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
| `sessionAt` / `windowOpen` | Q-zones defined in New York time (London 02–05, NY 07–10, Asia 20–24) so US DST is automatic |
| `newsBlock` | Blocks ±15 min around news times saved in today's plan (IST) |
| `disciplineScore` | Last 100 trades: 30% gate 8/8 · 25% risk ≤ plan · 25% no override · 20% no mistakes |
| `stats` / `groupStats` | Win rate, expectancy, profit factor, max DD in R, A+ rate, per-group breakdowns |
