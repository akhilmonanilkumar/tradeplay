# Data model

Supabase project `trade-journal` (ref `drdpzpaeuvelbsdxhndw`, region ap-south-1). Every table has `user_id uuid default auth.uid()` and RLS restricting all operations to the owner. Full DDL: [`supabase/schema.sql`](../supabase/schema.sql).

## accounts
One row per prop/live account — firm rules **and** your personal plan.

| Column | Meaning |
|---|---|
| `name`, `firm`, `instrument` | Display + the only instrument this account trades |
| `kind` | `challenge` · `funded` · `live` · `demo` |
| `status` | `active` · `passed` · `failed` · `closed` (only `active` shows on Today) |
| `starting_balance`, `target_pct` | Target $ = start × (1 + target%) |
| `max_daily_loss_pct`, `max_overall_loss_pct`, `dd_type` | Firm limits; `static` floor = start × (1 − max%), `trailing` uses peak closed balance |
| `day_reset_utc` | When the firm's day rolls over (Breakout `00:30`) — drives "today" for limits |
| `personal_daily_loss_pct` | Your own daily stop (default 1%) |
| `max_daily_profit_pct` | Lock the day once realised P&L ≥ this % of start-of-day balance |
| `max_trades_per_day`, `max_losses_per_day` | Hard caps |
| `min_rr` | Minimum R:R for the gate (3) |
| `hard_stop_equity` | Stop trading the account at/below this equity |
| `risk_ladder` | `[{min_equity, risk_pct, max_trades}]` — first tier with equity ≥ `min_equity` applies |
| `loss_streak_n`, `loss_streak_risk_pct` | After N consecutive losses, cap risk at this % |
| `session_window` | Default session: `London` · `New York` · `Asia` · `Any` (DST-aware Q-zones); the day plan can override |
| `contract_size`, `fee_rate` | Sizing: gold 100 oz/lot & 0; BTC 1 & 0.0008 round-trip |
| `min_profitable_days`, `notes` | Challenge requirement, free text |

## trades
| Column | Meaning |
|---|---|
| `account_id`, `setup_id` | Links |
| `status` | `open` · `closed` · `cancelled` |
| `opened_at`, `closed_at` | Timestamps (UTC, displayed IST) |
| `instrument`, `direction`, `session` | |
| `entry`, `sl`, `tp`, `exit`, `size` | Levels and position size |
| `risk_usd`, `planned_risk_usd` | Actual risk vs what the plan allowed at entry |
| `gross_pnl`, `fees` | Realised result from the platform |
| `htf_aligned`, `correct_half`, `in_poi`, `liquidity_swept`, `market_shift`, `in_session`, `news_clear` | The 7 manual A+ gate checks |
| `poi_type`, `entry_model`, `invalidation` | Setup detail |
| `override_reason`, `guardrail_breaches[]` | Filled when a guardrail/gate was overridden |
| `mistakes[]`, `emotions[]`, `review`, `chart_url` | Journal |
| `before_path`, `after_path` | Storage paths in `screenshots/<user_id>/<trade_id>/…` |

**Generated (computed by Postgres, read-only):**

| Column | Formula |
|---|---|
| `rr_planned` | `round(|tp − entry| / |entry − sl|, 2)` |
| `net_pnl` | `gross_pnl − fees` |
| `r_multiple` | `round(net_pnl / risk_usd, 2)` |
| `gate_score` | 7 checks + (`rr_planned ≥ 3`) → 0–8; 8 = A+ |

## day_plans
One per account per IST date (`unique(account_id, plan_date)`): `bias` (`long`/`short`/`neutral`), `htf_range`, `magnet`, `invalidation`, `pois`, `news_times[]` (IST `HH:MM`, entries blocked ±15 min), `checklist` (jsonb of the 6 pre-market items), `notes`, `sessions[]` (`Asia`/`London`/`New York`/`Custom`/`Any`; empty = account default), `custom_window` (IST `HH:MM-HH:MM`).

## Added in migration 0005 (`sessions_coach`)
| Table / column | Purpose |
|---|---|
| `trades.emotion_log` | jsonb array `[{at, stage: pre/during/post, emotions[], intensity, note}]` (≤50) |
| `trades.mental` | jsonb `{focus, confidence, patience, energy, stress}` 1–5, rated before entry |
| `balance_adjustments` | Signed equity corrections (deposits, swaps, "sync to broker") — included in equity |
| `lessons` | Win/loss causes and the rule not to repeat (`trade_id`, `account_id`, `kind`, `title`, `cause`, `rule`, `tags[]`, `source` manual/auto/ai, `active`) |
| `reminders` | Timed reminders (`text`, `due_at`, `done`, `source`) → bell + system notifications |
| `checkins` | Daily mental check-in (mood/energy/focus/stress 1–5, sleep, feelings, note), one per day |
| `ai_threads`, `ai_messages` | Coach conversations (trigger enforces messages belong to your own thread) |
| `ai_memory` | Facts/preferences/goals/rules the coach always knows (pin/forget) |
| `kb_docs` | Knowledgebase chunks (≤12k chars) with a generated `tsvector`; `kb_search(q, n)` ranks them |
| `daily_briefs` | Cached outlook/brief per day (`unique(user_id, brief_date, kind)`) |

## setups
`name`, `model`, `rules`, `active`. Seeded: *Market Shift → Pullback*, *Flip Zone*, *Sweep → OB → FVG*.

## payouts
`account_id`, `amount`, `paid_at`, `note` — subtracted from equity.

## reviews
One per user per week (`week_start` = Monday IST): `went_well`, `to_fix`, `rule_change`, `rating` 1–5.

## app_owner
Single row holding the only email allowed to sign up. RLS on, no policies, no grants — invisible to the app.

## Functions & triggers
| Name | Kind | Purpose |
|---|---|---|
| `seed_my_defaults()` | RPC, `security invoker` | Creates the two default accounts + three setups for the signed-in user if they have none |
| `enforce_single_owner()` | trigger on `auth.users` (before insert), `security definer` | Rejects any sign-up whose email ≠ `app_owner.email` |

## Storage
Bucket `screenshots` — private, PNG/JPEG/WebP, 5 MB limit. Policies allow each user only objects under their own `<user_id>/` prefix.
