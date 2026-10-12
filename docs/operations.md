# Operations runbook

## Daily use (the 2-minute version)
1. **Plan** → tick the 6 pre-market items, set bias, add news times (IST).
2. **Today** → both accounts show "● Clear to trade" only inside your window with slots left.
3. **New** → fill levels, tick the gate; size is calculated. "Log A+ trade" unlocks only at 8/8 with no guardrail issues.
4. **Today / Trades** → *Close* the trade with the platform's realised P&L and fees; tag mistakes/emotions; drop before/after screenshots.
5. Sunday → **Review** the week, write one focus. **Insights** → click into any leak.

## Install on your phone
Open the site in Safari/Chrome → *Share → Add to Home Screen* (iOS) or *Install app* (Android). It opens full-screen like a native app.

## Backups
- Supabase free tier keeps no point-in-time backups — export regularly:
  - **Trades → Export CSV** (everything incl. gate checks, tags, reviews text), and/or
  - Supabase dashboard → Database → *Backups* / `pg_dump` with the connection string.
- Screenshots: Supabase → Storage → `screenshots` → download.
- Schema: `supabase/schema.sql` rebuilds an empty project.

## Free-tier housekeeping
- Supabase pauses projects after ~7 days with no activity. Opening the app counts; if paused, resume it from the dashboard (data is kept).
- Vercel Hobby limits are far above single-user usage.

## Common tasks
| Task | How |
|---|---|
| Change risk or rules | App → Accounts → edit → Save (takes effect immediately) |
| New prop account | Accounts → *+ Account*, set rules + ladder; mark old one `passed`/`failed`/`closed` |
| Withdrawal/payout | Accounts → Payouts → Add (reduces equity, ladder re-applies) |
| Fix a wrong trade | Click it → edit result/notes, *Reopen*, *Cancel order* or *Delete* (removes screenshots too) |
| Change owner email | SQL editor: `update public.app_owner set email='new@x.com';` |
| Locked out by IP allowlist | Vercel → Settings → Environment Variables → edit/delete `ALLOWED_IPS` → Redeploy |
| Magic link opens wrong site | Supabase → Auth → URL Configuration → fix Site URL / Redirect URLs |
| Roll back a bad release | Vercel → Deployments → *Instant Rollback*; Docker: `./scripts/rolling-deploy.sh ghcr.io/…:<old-sha>` |
| Rotate Supabase keys | Supabase → Settings → API → roll publishable key → update `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel/GitHub vars → redeploy |

## Troubleshooting
| Symptom | Cause / fix |
|---|---|
| "This journal is private." on login | Email ≠ `app_owner.email` |
| Blank page + CSP errors in console | A browser extension injecting scripts, or a changed Supabase URL not matching `connect-src` — rebuild with the right env |
| 403 "Access denied for <ip>" | IP allowlist — see above |
| Day limits look off by a few hours | Set the account's *Daily reset (UTC)* to the firm/broker's rollover |
| Container unhealthy | `docker compose logs app`; check `/api/health`; ensure build args were set |

## Daily flow with the coach (since v2)
1. **Today** — read the quote, do the 30-second **check-in**, scan the **Actions** list, read the **outlook** for gold and BTC.
2. **Economic calendar** widget → *Block today's times in my plans* (and *Remind me before each*).
3. **Plan** → *Dictate plan* (or type), pick the **sessions** you'll trade today per account; the window guardrail follows it.
4. **New trade** → rate your mental state, tick the gate, *Check this trade* → log only on GO.
5. While open: Trade → **Emotion tracker** (log "during") and *What now?*.
6. After close: result, **emotion after**, *Why did this win/lose?* → *Remember this lesson*.
7. Weekly: **Insights → Patterns/Emotions**, then **Review → Draft with coach**.

### Equity doesn't match the broker
Accounts → *Equity sync* → enter the broker balance; the difference is stored as a dated adjustment (delete it to undo).

### Delete vs close an account
*Delete account…* removes the account with all its trades, payouts, plans and screenshots (type the name to confirm). If you want to keep the history, choose *Mark it closed* — it leaves Today but stays in Insights.

### Coach says "No AI provider is configured"
Add one key (see [ai-coach.md](ai-coach.md)) in Vercel → Settings → Environment Variables and redeploy.
