# A+ TradePlay

A private trading journal, guardrail engine, analytics suite and AI coach for daytrading funded accounts:
- **XAUUSD** on FundedHive 25K
- **BTCUSDT.P** on Breakout 5K funded

Next.js 16 · Supabase (Postgres, Auth, Storage) · Tailwind 4 · any LLM provider · Vercel or Docker · GitHub Actions

Dark by default, with light and system themes (☾ in the sidebar, or ⌘K). It installs as a PWA, works on mobile, and has voice input everywhere you type a plan or journal entry.

| Screen | What it does |
|---|---|
| **Today** | The day's quote and A+ principle, then a P&L snapshot per account and combined (today/week/month), discipline, A+ rate, expectancy and streak. Below that: pending and overdue actions, a 30-second mental check-in, and the **AI outlook** for gold and BTC in our framework. Then guardrail cards per account, the **weekly economic calendar** with no-trade and caution windows, BTC and gold prices with headlines, open positions, and "don't repeat" lessons. |
| **Plan** | A pre-market checklist per account per day: bias, HTF range, magnet, invalidation and POIs. **Sessions to trade** can be London, New York, Asia, a custom IST window, or any mix. News times block entries ±15 min (one tap from the calendar). Dictate the whole plan by voice. |
| **New trade** | The 8-box A+ gate, auto R:R, fee-aware sizing and live guardrails. Also a pre-entry mental state (focus, confidence, patience, energy, stress plus feelings), a **coach check** (GO / WAIT / NO with a management plan), matching lessons, and voice dictation. |
| **Trades** | Log, filters and CSV export. Each trade has close/edit and screenshots, an **emotion tracker** (before, during and after), a **"Why did this win/lose?"** diagnosis with one-tap lessons, in-trade guidance, and a dictated review. |
| **Insights** | Six tabs. **Overview:** drill-down breakdowns and heatmap. **Calendar:** P&L for all accounts and each account, plus monthly totals. **Performance:** streaks, drawdown, rolling expectancy, R by gate, holding time, account comparison. **Patterns:** biggest leak, recurring causes, behaviour sequences, best and worst condition combos. **Emotions:** results by feeling and stage, mental state vs result, check-in trends. **Tools:** a prop-firm Monte Carlo simulator and a what-if replay. |
| **Coach** | Chat for planning and research, with memory, a knowledgebase and lessons. It is provider-agnostic, can do web research, and takes voice input. It proposes actions; you apply them. |
| **Review** | A weekly recap with one computed focus. Draft it with the coach or by voice. |
| **Accounts** | Every parameter is editable after creation: balance, firm rules, personal guardrails, risk ladder, sizing, session, daily reset. You can sync equity to the broker balance, record payouts, delete or close an account, and manage setups. |
| **Everywhere** | ⌘K command palette, a reminder bell with system notifications, and quick voice actions. |

## Quick start

```bash
cp .env.example .env.local
npm install
npm run dev     # http://localhost:3000
npm test        # 27 unit tests: sizing, guardrails, sessions, diagnosis, patterns, Monte Carlo, voice parsing
```

Then:
1. Apply the database once: `supabase/schema.sql` for a new project, or `supabase/migrations/0005_sessions_coach.sql` on top of an existing one.
2. Optionally add one AI key: see [docs/ai-coach.md](docs/ai-coach.md).

## Deploy
- **Vercel (default):** import the repo and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Optional: the AI keys, `APP_URL` and `ALLOWED_IPS`. Deploy, then set the Supabase Auth Site URL. PRs get previews; `main` deploys atomically with instant rollback.
- **Docker:** `docker compose up -d` runs the app plus Caddy with automatic HTTPS. Zero-downtime updates run through `scripts/rolling-deploy.sh`, automated by the Release workflow.
- **CI/CD:** on every push and PR, `ci.yml` tests, builds, audits and smoke-tests the container. `release.yml` publishes `ghcr.io/akhilmonanilkumar/tradeplay` and can roll it out to your server.

Full steps → [docs/deployment.md](docs/deployment.md)

## Security at a glance
- Single-owner lock in the database, and magic-link auth.
- RLS on every table and on the screenshot bucket; `anon` is revoked.
- AI routes run **as you**: your JWT is verified, RLS applies, and there is no service-role key.
- LLM keys are server-only.
- Nonce-based CSP, HSTS and frame denial.
- Microphone access is limited to this origin.
- Optional IP allowlist.
- The container runs non-root and read-only, and dependencies are audited.

Details → [docs/security.md](docs/security.md)

## Documentation
| | |
|---|---|
| [Architecture](docs/architecture.md) | Stack, data flow, source map, calculations |
| [AI coach](docs/ai-coach.md) | Providers, keys, context, actions, voice, costs |
| [Security](docs/security.md) | Layers, secrets, IP allowlist, verified tests |
| [Deployment & CI/CD](docs/deployment.md) | Vercel, Docker, pipelines, rolling updates, rollback |
| [Data model](docs/data-model.md) | Tables, generated columns, functions, storage |
| [Accounts & risk](docs/accounts-and-risk.md) | Firm rules, ladders, sizing, sessions, guardrail logic |
| [Operations](docs/operations.md) | Daily workflow, backups, common tasks, troubleshooting |
| [Trading playbook](docs/trading-playbook.md) | The A+ rules the app enforces |
| [Design](docs/design.md) | Brand, tokens, themes, components |

Database definition: [`supabase/schema.sql`](supabase/schema.sql) · migrations: [`supabase/migrations/`](supabase/migrations)
