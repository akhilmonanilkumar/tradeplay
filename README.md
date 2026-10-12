# Tradeplay — personal A+ trading journal

Single-user journal, guardrail engine and analytics dashboard for daytrading funded accounts —
**XAUUSD on FundedHive 25K** and **BTCUSDT.P on Breakout 5K funded**.

Next.js 16 · Supabase (Postgres, Auth, Storage) · Tailwind · Vercel or Docker · GitHub Actions

| Screen | What it does |
|---|---|
| **Today** | Per-account guardrail card: equity, drawdown buffer, daily stop, target progress, next-trade risk $, A+ slots left, session countdown, lock reasons · open positions · discipline score · today's rule breaks |
| **Plan** | Pre-market checklist per account/day — bias, HTF range, magnet, invalidation, POIs, **news times that block entries ±15 min** |
| **New** | 8-box A+ gate, auto R:R, fee-aware sizing, live guardrails, playbook + today's plan alongside; off-plan trades need a written reason |
| **Trades** | Filter/search log, close & review trades, mistakes/emotions, before/after screenshots (drop/paste), CSV export |
| **Insights** | Interactive dashboard: KPIs, R equity curve, auto-insights, click-to-drill breakdowns, weekday × session heatmap, R histogram, P&L calendar, cost of mistakes, per-gate-check edge |
| **Review** | Weekly recap with one computed focus + reflection |
| **Accounts** | Firm rules, personal limits, risk ladder, session window, daily reset, payouts, setups |

## Quick start

```bash
cp .env.example .env.local
npm install
npm run dev     # http://localhost:3000
npm test        # 14 unit tests: sizing, risk ladder, daily reset, guardrails, sessions, discipline
```

## Deploy
- **Vercel (default):** import the repo, set `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`, deploy, then set the Supabase Auth Site URL to your app URL. PRs get previews; `main` deploys atomically with instant rollback.
- **Docker:** `docker compose up -d` (app + Caddy with automatic HTTPS). Zero-downtime updates via `scripts/rolling-deploy.sh`, automated by the Release workflow.
- **CI/CD:** `ci.yml` tests, builds, audits and smoke-tests the container on every push/PR; `release.yml` publishes `ghcr.io/akhilmonanilkumar/tradeplay` and can roll it out to your server.

Full steps → [docs/deployment.md](docs/deployment.md)

## Security at a glance
Single-owner lock in the database · magic-link auth · RLS on every table & the screenshot bucket · `anon` revoked · nonce-based CSP + HSTS + frame denial · optional IP allowlist · non-root read-only container · audited dependencies. Details → [docs/security.md](docs/security.md)

## Documentation
| | |
|---|---|
| [Architecture](docs/architecture.md) | Stack, data flow, source map, calculations |
| [Security](docs/security.md) | Layers, secrets, IP allowlist, verified tests |
| [Deployment & CI/CD](docs/deployment.md) | Vercel, Docker, pipelines, rolling updates, rollback |
| [Data model](docs/data-model.md) | Tables, generated columns, functions, storage |
| [Accounts & risk](docs/accounts-and-risk.md) | Firm rules, ladders, sizing, guardrail logic |
| [Operations](docs/operations.md) | Daily workflow, backups, common tasks, troubleshooting |
| [Trading playbook](docs/trading-playbook.md) | The A+ rules the app enforces |

Database definition: [`supabase/schema.sql`](supabase/schema.sql)
