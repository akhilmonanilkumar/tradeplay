# Security model

Tradeplay is a **single-user** app. Defence is layered so that any one control failing still leaves your data protected.

| # | Layer | Control | Where |
|---|---|---|---|
| 1 | Network (optional) | IP allowlist — non-matching IPs get `403` before any page renders | `proxy.ts`, env `ALLOWED_IPS` |
| 2 | Identity | Magic-link email only (no passwords to leak or brute-force) | Supabase Auth, `app/login` |
| 3 | Identity | **Owner lock** — a trigger on `auth.users` rejects every sign-up except the owner email | `public.enforce_single_owner()`, `public.app_owner` |
| 4 | Authorisation | Row-level security on every table: `user_id = auth.uid()` for select/insert/update/delete | `supabase/schema.sql` §2 |
| 5 | Authorisation | `anon` role has **no** table privileges (revoked), on top of RLS | schema §2 |
| 6 | Files | Private `screenshots` bucket, per-user folder policy, PNG/JPG/WebP only, ≤5 MB, 10-minute signed URLs | schema §3, `TradeModal.tsx` |
| 7 | Browser | Per-request **nonce CSP** with `strict-dynamic` (no inline/eval scripts in production), `frame-ancestors 'none'`, `object-src 'none'`, `connect-src` limited to self + your Supabase | `proxy.ts` |
| 8 | Browser | HSTS (2 years, preload), `X-Frame-Options: DENY`, `nosniff`, strict `Referrer-Policy`, `Permissions-Policy` (camera/geo/payment off; mic self-only), COOP, `noindex` | `next.config.mjs` |
| 9 | Data integrity | DB constraints: text length caps, `https://`-only chart links, positive prices, sane % and fee ranges, max 12 news times | schema §1 |
| 10 | Runtime | Container runs as non-root `app`, read-only root FS, all Linux capabilities dropped, `no-new-privileges`, memory/CPU limits | `Dockerfile`, `docker-compose.yml` |
| 11 | Supply chain | `npm ci` from lockfile, `npm audit` (high+) in CI, image SBOM + provenance attestations on GHCR | `.github/workflows` |
| 12 | Privacy | Service worker caches only static assets — never API responses or journal data | `public/sw.js` |
| 13 | Server routes | `/api/ai`, `/api/ai/transcribe`, `/api/market` require a valid Supabase access token, verified server-side; queries run under that JWT so RLS still applies; per-user rate limits; input length caps | `lib/ai/auth.ts` |
| 14 | AI | LLM keys are server-only env vars (never `NEXT_PUBLIC_`); third-party headlines are fenced as untrusted data in prompts; the coach can only *propose* changes — you apply them with your own session | `lib/ai/*`, `lib/coach.ts` |
| 15 | Browser | Microphone allowed for this origin only (`Permissions-Policy: microphone=(self)`); audio is sent once for transcription only when the browser lacks speech recognition, never stored | `next.config.mjs`, `components/Voice.tsx` |
| 16 | Rendering | Coach replies render through a tiny markdown renderer that builds React elements (no `dangerouslySetInnerHTML`); only `https://` links | `components/coach-ui.tsx` |

## Keys and secrets

| Value | Sensitivity | Where it lives |
|---|---|---|
| Supabase URL | Public | `.env.example`, Vercel env, CI vars |
| Supabase **publishable** key (`sb_publishable_…`) | Public by design — only grants what RLS allows | Same |
| Supabase **service-role / secret** key | **Secret — never used by this app.** Never put it in env vars, the repo or the browser | Supabase dashboard only |
| `ALLOWED_IPS` | Low | Vercel env / server `.env` |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `COMPAT_API_KEY` | **Secret** | Vercel env (Production/Preview) or server `.env` — server-only |
| `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS` | Secret | GitHub → Settings → Secrets (only if you self-host) |

## The IP allowlist — what it does and doesn't do

- It protects the **web app** (pages, assets behind the proxy). It cannot restrict Supabase's API, which the browser calls directly — that is protected by layers 2–6.
- Vercel and Caddy set `X-Real-IP` from the real socket, so clients cannot spoof it.
- Supports exact IPv4/IPv6 and IPv4 CIDR (`49.37.12.0/24`). Leave unset to disable.
- **Lock-out risk:** Indian ISPs (Jio, Airtel) rotate IPs and often use CGNAT. Prefer a CIDR range, or rely on layers 2–6. Recovery: edit/delete `ALLOWED_IPS` in Vercel → redeploy.

## Recommended Supabase dashboard settings (manual, one-time)

1. **Authentication → URL Configuration** — Site URL = your app URL; Redirect URLs = app URL (+ `http://localhost:3000` for dev). Required for magic links.
2. **Authentication → Providers → Email** — keep "Confirm email" on; leave password sign-in unused.
3. **Authentication → Rate limits** — defaults are fine; lower "emails per hour" if you like.
4. **Project Settings → API** — never expose the secret/service-role key.
5. Optional: **Authentication → Sign In / Up → Allow new users to sign up = off** *after* your first login (the owner trigger already blocks others; this is belt-and-braces).

## Verified behaviour (tested against the live project, then rolled back)

- Stranger sign-up → rejected (`Sign-ups are closed for this app`)
- Owner sign-up → allowed (case-insensitive email match)
- Seed creates exactly 2 accounts + 3 setups and is idempotent
- Generated columns: entry 82,800 / SL 82,400 / TP 84,000, risk $25, P&L $75, fees $3.50 → R:R 3.00, net $71.50, 2.86R, gate 8/8
- `javascript:` chart link → rejected by constraint
- A second authenticated user sees **0** rows
- `anon` role → permission denied on `trades`
- CSP header carries a fresh nonce on every request; all 11 inline Next.js scripts are nonce-tagged
- IP allowlist: blocked IP `403`, allowed IPv4 range `200`, allowed IPv6 `200`, missing IP header `403`

## Reporting / changing the owner

To move the app to a different email: `update public.app_owner set email = 'new@example.com';` in the Supabase SQL editor, then sign in with the new address. Existing rows stay tied to the old user id — migrate with `update … set user_id = '<new uid>'` if needed.
