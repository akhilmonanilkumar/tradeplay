# Closed beta, profiles and sharing (migration 0006)

## Sign-up
- **Sign in** tab: existing accounts only (`shouldCreateUser: false`).
- **Join the beta** tab: email + access code. `redeem_beta_code(email, code)` checks the bcrypt-hashed code in `beta_codes` (max uses, expiry, active) and adds the email to `beta_access`. The `enforce_single_owner` trigger on `auth.users` now allows the owner **or** an email in `beta_access`; anything else is rejected with "Sign-ups are invite-only during the closed beta".
- Current code: `playtrader26` (label "Closed beta 2026", 500 uses). Rotate with:
  ```sql
  update public.beta_codes set active = false;  -- retire old codes
  insert into public.beta_codes (code_hash, label, max_uses) values (extensions.crypt('NEWCODE', extensions.gen_salt('bf', 10)), 'Wave 2', 200);
  ```
- Supabase → Authentication → URL configuration: Site URL `https://tradeplay.cloud`, redirect URLs `https://tradeplay.cloud/**` and `https://www.tradeplay.cloud/**`. Keep "Allow new users to sign up" **on** — the trigger is the gate.

## Onboarding
New users pick account templates (gold challenge, BTC funded, personal), set balances and a time zone; default setups are added. Everything stays editable in Accounts.

## Profiles and time zone
`profiles` (own rows only): avatar (a1–a12), username, display name, bio, socials, time zone, `is_public`, `on_leaderboard`, `show_usd`. The time zone drives every time shown in the app (`lib/tz.ts`). Default `Asia/Kolkata`.

## Public pages (no sign-in)
- `/u/<username>` — verified stats (R-based; $ only if `show_usd`), equity curve, monthly table. Only when `is_public`.
- `/t/<share_id>` — a shared trade with an OG preview image (`/t/<id>/opengraph-image`). Created from the trade modal → Share; "Stop sharing" clears `share_id`.
- `/leaderboard` — opted-in public profiles with ≥5 closed trades in the period, ranked by total R.
All three use security-definer functions granted to `anon` that return only aggregated / whitelisted fields. "Verified" means computed by the app from journal rows; "logged live" means the row was created within 30 minutes of the entry time. Not broker-audited.

## Shared AI outlook
One outlook per platform day (IST) in `shared_briefs`, built only from public prices, headlines, the economic calendar and the playbook (no personal data, times in UTC). Any trader may refresh it once per day (`claim_brief_refresh`), which replaces the shared copy for everyone. Writes go through `put_shared_brief` (size-limited, date-checked).

## Data sources
- Prices: Kraken public ticker (PAXG for gold), CoinGecko fallback.
- News: Finnhub market news (`FINNHUB_API_KEY`), fallback FXStreet RSS.
- Economic calendar: Forex Factory weekly JSON export.
- Quote of the day: ZenQuotes `/api/today` (attributed on the card), local list as fallback.
