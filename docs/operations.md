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
