# Deployment & CI/CD

Two supported targets. Use **Vercel** (free, zero-ops) as the default; the **Docker** path exists so you can move to any server later without code changes.

```
            push / PR
               │
     ┌─────────┴──────────┐
     ▼                    ▼
GitHub Actions: CI     Vercel Git integration
 • npm ci               • PR → preview URL
 • unit tests           • main → production (atomic swap,
 • type-check + build     instant rollback)
 • npm audit
 • docker build + smoke test
     │ (main, green)
     ▼
GitHub Actions: Release
 • image → ghcr.io/akhilmonanilkumar/tradeplay:<sha> + :latest (SBOM, provenance)
 • optional: SSH → scripts/rolling-deploy.sh (zero-downtime, auto-rollback)
```

## Environment variables

| Name | Required | Scope | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | build time | `https://drdpzpaeuvelbsdxhndw.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | build time | Supabase publishable key (`sb_publishable_…`) |
| `ALLOWED_IPS` | – | runtime | Comma list: `1.2.3.4, 10.0.0.0/24, 2401:db8::1`. Unset = off |
| `APP_URL` | – | runtime | Public URL for link previews (Vercel sets its own) |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY` / `COMPAT_BASE_URL`+`COMPAT_API_KEY` | – | runtime, **secret** | Any one enables the AI coach — [ai-coach.md](ai-coach.md) |
| `AI_MODELS`, `OPENAI_BASE_URL`, `AI_STT_MODEL`, `NEWS_FEEDS` | – | runtime | Model list (first = default), endpoints, speech model, RSS overrides |

`NEXT_PUBLIC_*` are baked into the browser bundle at **build** time (Docker build args / Vercel build env). Changing them requires a rebuild.

---

## A. Vercel (recommended)

### First deploy
1. vercel.com → **Add New → Project** → import `akhilmonanilkumar/tradeplay` (framework auto-detected: Next.js).
2. Add the env vars above for **Production** and **Preview**.
3. Deploy. Note the URL (e.g. `https://tradeplay-<hash>.vercel.app`) or add a custom domain.
4. Supabase → **Authentication → URL Configuration**: Site URL = that URL, add it to Redirect URLs.
5. Open the app → enter your email → click the link → **Load my accounts**.

### Updates (automatic)
- Every PR gets its own **preview deployment**; every push to `main` becomes production.
- Vercel deploys are **immutable and atomic**: the new build is fully ready before traffic switches, so there is no partial state — the Vercel equivalent of a rolling update with zero downtime.
- **Rollback:** Vercel dashboard → Deployments → pick a previous one → *Instant Rollback* (seconds, no rebuild).
- Recommended: Vercel → Project → Settings → Git → enable "Wait for checks to pass" (or branch protection on `main` requiring the **CI** workflow) so a red build never reaches production.

---

## B. Docker / your own server

### Image
- Multi-stage `Dockerfile`: `deps` → `build` (runs unit tests + `next build`) → `runtime` (standalone server only).
- Runs as non-root `app`, exposes `3000`, built-in `HEALTHCHECK` on `/api/health`.
- Published automatically by the Release workflow to `ghcr.io/akhilmonanilkumar/tradeplay:<short-sha>` and `:latest`.

Build locally:
```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://drdpzpaeuvelbsdxhndw.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_4hGP148iMgHFKwIZhBO5eg_tNt_Ycu1 \
  -t tradeplay .
docker run --rm -p 3000:3000 --read-only --tmpfs /tmp --cap-drop ALL tradeplay
```

### Server setup (once)
Any Linux VPS with Docker + Compose v2 and ports 80/443 open, DNS A/AAAA record → server.
```bash
sudo mkdir -p /opt/tradeplay && sudo chown $USER /opt/tradeplay
git clone https://github.com/akhilmonanilkumar/tradeplay /opt/tradeplay && cd /opt/tradeplay
cat > .env <<'ENV'
DOMAIN=journal.example.com
APP_IMAGE=ghcr.io/akhilmonanilkumar/tradeplay:latest
ALLOWED_IPS=
ENV
# if the GHCR package is private:
echo <github-PAT-with-read:packages> | docker login ghcr.io -u akhilmonanilkumar --password-stdin
docker compose up -d --wait
```
Caddy obtains HTTPS certificates automatically for `DOMAIN` and forwards the real client IP as `X-Real-IP`.

### Rolling updates
`scripts/rolling-deploy.sh <image:tag>`:
1. pulls the new image,
2. starts a **second** `app` replica next to the running one (no host port, so both can coexist),
3. waits up to 90 s for Docker to report it `healthy`,
4. if healthy → stops the old replica (Caddy retries in-flight requests on the healthy one) → scales back to 1;
5. if not → removes the new replica and exits non-zero; the old one never stopped serving (**automatic rollback**).

Manual rollback to any earlier build: `./scripts/rolling-deploy.sh ghcr.io/akhilmonanilkumar/tradeplay:<older-sha>`.

### Automating it from GitHub
Repo → Settings:
- **Variables:** `DEPLOY_VPS=true`, optionally `VPS_APP_DIR` (default `/opt/tradeplay`), and optionally override `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **Secrets:** `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` (private key of a deploy-only user), `VPS_KNOWN_HOSTS` (output of `ssh-keyscan <host>`).
- **Environments:** create `production` and (optionally) require your approval before each rollout.

Then every green push to `main` → image built → rolled out with zero downtime.

---

## Workflows reference

| File | Trigger | Jobs |
|---|---|---|
| `.github/workflows/ci.yml` | push to `main`, every PR | **verify**: `npm ci` → `npm test` → `npm run build` → `npm audit --audit-level=high`; **docker**: build image, run it read-only with no capabilities, assert healthy, assert CSP nonce header, assert non-root user |
| `.github/workflows/release.yml` | CI succeeded on `main`, or manual | **image**: push `:<sha>` + `:latest` to GHCR with SBOM + provenance; **deploy-vps** (only if `DEPLOY_VPS=true`): SSH rolling update |

Concurrency: CI cancels superseded runs; Release never cancels a rollout in progress.

## Supabase changes

Pending for this release: **`supabase/migrations/0005_sessions_coach.sql`** (sessions per plan, equity adjustments, lessons, reminders, emotions, check-ins, coach tables). It is additive; until it runs the app shows a notice on the new sections and everything else keeps working.

Schema changes are applied as migrations (via the Supabase dashboard/MCP) and mirrored in `supabase/schema.sql`. Apply the database change **before** deploying code that depends on it; additive changes (new nullable columns/tables) are safe to ship first.
