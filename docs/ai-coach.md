# AI coach

One assistant ("A+ Coach") powers every AI feature: chat, the morning brief, today's outlook, the pre-trade check, in-trade guidance, win/loss analysis, voice parsing and review drafts. It is **model- and provider-agnostic**: you choose which model runs it, and you can switch per chat.

Without an AI key the app still works fully. Guardrails, the rule-engine trade diagnosis, local voice parsing, lessons, reminders, the market data and the economic calendar don't need AI.

## Setup: one key is enough

Set these as **server** environment variables (Vercel → Settings → Environment Variables, or the Docker `.env`). Never prefix them with `NEXT_PUBLIC_`.

| Variable | Provider | Example |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic (Claude) | `sk-ant-…` |
| `OPENAI_API_KEY` (+ optional `OPENAI_BASE_URL`) | OpenAI, or Azure/OpenAI-proxy | `sk-…` |
| `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) | Google Gemini | `AIza…` |
| `OPENROUTER_API_KEY` (+ optional `OPENROUTER_FALLBACKS`, `OPENROUTER_ANY_MODEL`) | **OpenRouter** — 400+ models incl. free ones, automatic fallback | `sk-or-v1-…` |
| `COMPAT_BASE_URL` + `COMPAT_API_KEY` | Any OpenAI-compatible API: OpenRouter, Groq, Together, DeepSeek, Mistral, local Ollama / LM Studio | `https://openrouter.ai/api/v1` |
| `AI_MODELS` | Which models to offer in the UI. The first one is the default. | `anthropic:claude-sonnet-5-5,google:gemini-2.5-flash,compat:meta-llama/llama-3.3-70b-instruct` |
| `AI_STT_MODEL` | Speech-to-text fallback model (default `whisper-1`) | |
| `NEWS_FEEDS` | Override the RSS feeds (comma list of https URLs) | |

If `AI_MODELS` is unset, the app offers a sensible default model for every provider that has a key. A model id is `provider:model`, where provider is `anthropic`, `openai`, `google` or `compat`.

**Web research:** when an Anthropic or Gemini model is configured, the chat shows a *Web research* toggle. It uses that provider's built-in web search, through Anthropic's web search tool or Gemini's Google Search grounding.

## OpenRouter (recommended for free use)

1. openrouter.ai → sign in → **Keys** → *Create key* (optionally set a credit limit, e.g. $0 for free-only).
2. Vercel → Project → Settings → Environment Variables → `OPENROUTER_API_KEY` = the key (Production + Preview) → redeploy. Optional: `APP_URL` (shown as the app on your OpenRouter dashboard).
3. **Privacy (required for free models):** OpenRouter → Settings → Privacy → allow the free endpoints you're comfortable with. Free providers may log or train on prompts, and coach prompts contain your journal context — use a paid model for anything sensitive.
4. Open **Coach → Engine**: you'll see connection status, today's free-request count, the free picks, and a searchable catalog of every OpenRouter model (free or paid). Tap one to make it the coach's model on this device.

With only `OPENROUTER_API_KEY` set, the app offers these free models (verified Oct 2026; the catalog changes — Engine always shows the live list):

| Model id | Good for |
|---|---|
| `nvidia/nemotron-3-super-120b-a12b:free` | Default — balanced, tools, 262K context |
| `thinkingmachines/inkling-small:free` | Reasoning (analysis, pre-trade checks), 1M |
| `thinkingmachines/inkling:free` | Strongest reasoning (outlook, weekly review), slower |
| `nvidia/nemotron-3-ultra-550b-a55b:free` | Deep multi-step research, 1M |
| `google/gemma-4-31b-it:free` | Fast general chat, vision |
| `apodex/apodex-1.1-mini:free` | Research & forecasting, JSON |
| `nvidia/nemotron-3.5-lightning:free` | Fastest — voice parsing, quick answers |
| `openrouter/free` | Router that auto-picks any capable free model |

- **Fallbacks:** every request sends a `models` list (your pick + up to 3 others, from `OPENROUTER_FALLBACKS` or the presets above), so a busy or rate-limited free model is skipped automatically.
- **Limits:** free variants are 20 requests/min and 50/day per account; buying $10 of credits once raises it to 1,000/day. Today's outlook and the morning brief are cached daily, so normal use fits easily.
- **Web research** on OpenRouter uses the paid `web` plugin (billed to credits); leave it off for free-only use.
- Paid models (Claude, GPT, DeepSeek, Qwen…) work through the same key — just pick them in Engine.

## What the coach sees

Every call is made **as you**. The browser sends your Supabase access token, the server verifies it with Supabase, and every query runs under your JWT, so row-level security still applies. No service-role key exists in this app.

Context is assembled per request (`lib/ai/context.ts`):
- **Accounts:** live guardrail state (equity, floors, risk, slots, lock reasons, window).
- **Plans:** today's plan per account.
- **Trades:** open trades and the last 15 closed.
- **Stats and patterns:** 30-day and all-time stats, discipline score, and recurring problems from the rule engine.
- **Your notes:** active lessons ("don't repeat"), memory items, and pending reminders.
- **Knowledgebase:** the most relevant excerpts for the question, via Postgres full-text search (`kb_search`).
- **The playbook:** a condensed A+ playbook is always included (`lib/ai/playbook.ts`).
- **Outlook only:** public prices (Kraken/CoinGecko), RSS headlines and the week's economic calendar. Headlines are marked as untrusted third-party text.

## What it can do

The coach **proposes** actions; nothing changes until you tap *Apply*:
- `save_plan`: merges fields into today's plan.
- `add_reminder`: adds a timed reminder (the bell plus a system notification).
- `remember`: saves a fact, preference, goal or rule to memory.
- `add_lesson`: saves a "don't repeat" rule.
- `draft_trade`: opens New trade prefilled.

## Features and where they live

| Feature | Where | Task |
|---|---|---|
| Chat for planning and research (threads, model picker, voice, web research) | Coach | `chat` |
| Memory: facts, preferences, goals, rules (pin or forget) | Coach → Memory | — |
| Knowledgebase: upload .md/.txt, paste notes, add the built-in playbook | Coach → Knowledge | — |
| Lessons ("don't repeat") | Coach → Lessons, Today, New trade | — |
| Morning brief | Coach, ⌘K | `brief` (cached per day) |
| Today's outlook per instrument, in our framework | Today | `outlook` (cached per day, Refresh to regenerate) |
| Pre-trade second opinion: GO / WAIT / NO plus a management plan | New trade → Coach check | `precheck` |
| In-trade guidance | Trade → "What now?" | `manage` |
| Why did this win or lose? | Trade (closed) → Deeper analysis | `analyze` |
| Voice → structured fields | Plan, New trade, trade review, check-in | `parse` |
| Weekly review draft | Review → Draft with coach | `review` |

## Voice input

- **Chrome, Edge, Safari:** live dictation with the browser's speech engine (default language en-IN). In Chrome, recognition runs through Google's speech service.
- **Other browsers:** the mic records and posts audio once to `/api/ai/transcribe`, which forwards it to an OpenAI-compatible `/audio/transcriptions` endpoint. This needs `OPENAI_API_KEY`, or `STT_BASE_URL` + `STT_API_KEY`. Audio is never stored.
- **Parsing:** dictation is parsed locally first (`parseDictation`: direction, levels, sessions, news times, POI and model, mistakes, feelings), then refined by the model when one is configured. Always check the fields before saving.

## Costs and limits

- Calls are rate-limited to about 20 per minute per user per server instance.
- Outlook and brief are cached once per day in `daily_briefs`.
- Typical prompt size is 3–6k tokens.
- Route timeout is 60 s (`maxDuration`).
