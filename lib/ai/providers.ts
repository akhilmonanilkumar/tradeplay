import "server-only";

/**
 * Provider-agnostic model calls. One coach, any model:
 *   anthropic:<model>  → Anthropic Messages API        (ANTHROPIC_API_KEY)
 *   openai:<model>     → OpenAI Chat Completions       (OPENAI_API_KEY, optional OPENAI_BASE_URL)
 *   google:<model>     → Gemini generateContent         (GEMINI_API_KEY or GOOGLE_API_KEY)
 *   openrouter:<slug>  → OpenRouter (OPENROUTER_API_KEY) — 400+ models incl. free ":free" variants, with
 *                        automatic fallback across OPENROUTER_FALLBACKS when a free model is busy/rate-limited
 *   compat:<model>     → any OpenAI-compatible endpoint (COMPAT_BASE_URL + COMPAT_API_KEY) — Groq,
 *                        Together, DeepSeek, Mistral, a local Ollama/LM Studio, …
 * AI_MODELS lists the models offered in the UI (first = default), e.g.
 *   AI_MODELS="anthropic:claude-sonnet-5-5,openai:gpt-4.1-mini,google:gemini-2.5-flash"
 * Keys live only in server env vars; nothing here is shipped to the browser.
 */

export type Provider = "anthropic" | "openai" | "google" | "openrouter" | "compat";
export type ModelRef = { id: string; provider: Provider; model: string; label: string };
export type ChatMsg = { role: "user" | "assistant"; content: string };

const env = (k: string) => (process.env[k] ?? "").trim();
const keyFor: Record<Provider, () => string> = {
  anthropic: () => env("ANTHROPIC_API_KEY"),
  openai: () => env("OPENAI_API_KEY"),
  google: () => env("GEMINI_API_KEY") || env("GOOGLE_API_KEY"),
  openrouter: () => env("OPENROUTER_API_KEY"),
  compat: () => env("COMPAT_API_KEY") || (env("COMPAT_BASE_URL") ? "none" : ""),
};

const DEFAULTS: Record<Provider, string> = {
  anthropic: "claude-sonnet-5-5",
  openai: "gpt-4.1-mini",
  google: "gemini-2.5-flash",
  openrouter: "nvidia/nemotron-3-super-120b-a12b:free",
  compat: "",
};

/**
 * Free OpenRouter models offered when only OPENROUTER_API_KEY is set (verified on openrouter.ai, Oct 2026).
 * Free variants: 20 req/min; 50 req/day per account (1,000/day once ≥$10 credits were ever purchased).
 */
export const OPENROUTER_FREE: { slug: string; label: string; note: string }[] = [
  { slug: "nvidia/nemotron-3-super-120b-a12b:free", label: "Nemotron 3 Super 120B", note: "balanced default · tools · 262K" },
  { slug: "thinkingmachines/inkling-small:free", label: "Inkling Small", note: "reasoning · tools · 1M" },
  { slug: "thinkingmachines/inkling:free", label: "Inkling", note: "strongest reasoning · slower · 1M" },
  { slug: "nvidia/nemotron-3-ultra-550b-a55b:free", label: "Nemotron 3 Ultra 550B", note: "deep research, multi-step · 1M" },
  { slug: "google/gemma-4-31b-it:free", label: "Gemma 4 31B", note: "fast · vision · tools · 262K" },
  { slug: "apodex/apodex-1.1-mini:free", label: "Apodex 1.1 Mini", note: "research & forecasting · JSON · 262K" },
  { slug: "nvidia/nemotron-3.5-lightning:free", label: "Nemotron 3.5 Lightning", note: "fastest · parsing/voice · 1M" },
  { slug: "openrouter/free", label: "OpenRouter Free router", note: "auto-picks any capable free model" },
];
const OR_SLUG = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._:-]*$|^openrouter\/(free|auto)$/i;

function parseRef(s: string): ModelRef | null {
  const m = /^(anthropic|openai|google|openrouter|compat):(.+)$/.exec(s.trim());
  if (!m) return null;
  const provider = m[1] as Provider;
  if (provider === "openrouter" && !OR_SLUG.test(m[2])) return null;
  const preset = provider === "openrouter" ? OPENROUTER_FREE.find((f) => f.slug === m[2]) : undefined;
  const label = preset ? `${preset.label} · free` : `${m[2]} · ${provider === "compat" ? "custom" : provider}`;
  return { id: `${provider}:${m[2]}`, provider, model: m[2], label };
}

/** Models usable right now (configured and with a key). */
export function availableModels(): ModelRef[] {
  const listed = env("AI_MODELS").split(",").map(parseRef).filter((x): x is ModelRef => !!x);
  const auto = (Object.keys(DEFAULTS) as Provider[])
    .filter((p) => DEFAULTS[p] && keyFor[p]())
    .flatMap((p) => (p === "openrouter" ? OPENROUTER_FREE.map((f) => parseRef(`openrouter:${f.slug}`)!) : [parseRef(`${p}:${DEFAULTS[p]}`)!]));
  const all = listed.length ? listed : auto;
  return all.filter((m) => !!keyFor[m.provider]());
}

export function pickModel(id?: string | null): ModelRef | null {
  const all = availableModels();
  const listed = all.find((m) => m.id === id);
  if (listed) return listed;
  // Any OpenRouter model may be chosen in the UI (catalog picker) unless OPENROUTER_ANY_MODEL=false.
  if (id?.startsWith("openrouter:") && keyFor.openrouter() && env("OPENROUTER_ANY_MODEL") !== "false") {
    const r = parseRef(id);
    if (r) return r;
  }
  return all[0] ?? null;
}

/** Fallback chain for OpenRouter: chosen model first, then OPENROUTER_FALLBACKS (default: free presets). OpenRouter allows 3 entries total. */
function orModels(primary: string): string[] {
  const conf = env("OPENROUTER_FALLBACKS");
  const list = conf ? conf.split(",").map((x) => x.trim()).filter((x) => OR_SLUG.test(x)) : OPENROUTER_FREE.map((f) => f.slug);
  return [primary, ...list.filter((x) => x !== primary)].slice(0, 3);
}

type CallOpts = {
  model: ModelRef;
  system: string;
  messages: ChatMsg[];
  json?: boolean;
  maxTokens?: number;
  webSearch?: boolean;
};

class ProviderError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function post(url: string, headers: Record<string, string>, body: unknown): Promise<any> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(55_000),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text.slice(0, 300);
    try {
      const j = JSON.parse(text);
      msg = j.error?.message ?? j.message ?? msg;
    } catch {}
    throw new ProviderError(res.status, `${res.status}: ${msg}`);
  }
  return JSON.parse(text);
}

/** One completion. Returns plain text (JSON text when json=true). */
export async function complete(o: CallOpts): Promise<string> {
  const max = o.maxTokens ?? 1500;
  const key = keyFor[o.model.provider]();
  switch (o.model.provider) {
    case "anthropic": {
      const body: Record<string, unknown> = {
        model: o.model.model,
        max_tokens: max,
        system: o.system + (o.json ? "\n\nRespond with a single JSON object only — no prose before or after it." : ""),
        messages: o.messages,
      };
      if (o.webSearch) body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }];
      const j = await post("https://api.anthropic.com/v1/messages", { "x-api-key": key, "anthropic-version": "2023-06-01" }, body);
      return (j.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    }
    case "openrouter": {
      const body: Record<string, unknown> = {
        model: o.model.model,
        models: orModels(o.model.model), // OpenRouter tries these in order on errors / rate limits
        messages: [{ role: "system", content: o.system }, ...o.messages],
        max_tokens: max,
      };
      if (o.json) body.response_format = { type: "json_object" };
      if (o.webSearch) body.plugins = [{ id: "web", max_results: 4 }]; // paid add-on (uses credits)
      const j = await post("https://openrouter.ai/api/v1/chat/completions", {
        authorization: `Bearer ${key}`,
        "HTTP-Referer": env("APP_URL") || "https://github.com/akhilmonanilkumar/tradeplay",
        "X-Title": "A+ TradePlay",
      }, body);
      if (j.error) throw new ProviderError(Number(j.error.code) || 502, j.error.message ?? "OpenRouter error");
      const used = j.model && j.model !== o.model.model ? `\n\n_(answered by ${j.model})_` : "";
      const text = j.choices?.[0]?.message?.content ?? "";
      return o.json ? text : text + used;
    }
    case "openai":
    case "compat": {
      const base = o.model.provider === "openai" ? env("OPENAI_BASE_URL") || "https://api.openai.com/v1" : env("COMPAT_BASE_URL");
      const body: Record<string, unknown> = {
        model: o.model.model,
        messages: [{ role: "system", content: o.system }, ...o.messages],
      };
      if (o.model.provider === "openai") body.max_completion_tokens = max;
      else body.max_tokens = max;
      if (o.json && o.model.provider === "openai") body.response_format = { type: "json_object" };
      const headers: Record<string, string> = key && key !== "none" ? { authorization: `Bearer ${key}` } : {};
      const j = await post(`${base.replace(/\/$/, "")}/chat/completions`, headers, body);
      return j.choices?.[0]?.message?.content ?? "";
    }
    case "google": {
      const body: Record<string, unknown> = {
        systemInstruction: { parts: [{ text: o.system }] },
        contents: o.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        generationConfig: { maxOutputTokens: max, ...(o.json && !o.webSearch ? { responseMimeType: "application/json" } : {}) },
      };
      if (o.webSearch) body.tools = [{ google_search: {} }];
      const j = await post(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(o.model.model)}:generateContent`,
        { "x-goog-api-key": key },
        body,
      );
      return (j.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("");
    }
  }
}

/** Speech-to-text fallback for browsers without the Web Speech API (OpenAI-compatible /audio/transcriptions). */
export async function transcribe(audio: Blob, filename: string): Promise<string | null> {
  const useOpenAI = !!env("OPENAI_API_KEY");
  const base = useOpenAI ? env("OPENAI_BASE_URL") || "https://api.openai.com/v1" : env("STT_BASE_URL") || env("COMPAT_BASE_URL");
  const key = useOpenAI ? env("OPENAI_API_KEY") : env("STT_API_KEY") || env("COMPAT_API_KEY");
  if (!base || !key) return null;
  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", env("AI_STT_MODEL") || (useOpenAI ? "whisper-1" : "whisper-large-v3"));
  const res = await fetch(`${base.replace(/\/$/, "")}/audio/transcriptions`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(55_000),
  });
  if (!res.ok) throw new ProviderError(res.status, `transcription ${res.status}`);
  const j = await res.json();
  return j.text ?? null;
}

export function sttAvailable(): boolean {
  return !!env("OPENAI_API_KEY") || (!!(env("STT_BASE_URL") || env("COMPAT_BASE_URL")) && !!(env("STT_API_KEY") || env("COMPAT_API_KEY")));
}

/** Pull the first JSON object out of a model reply (handles ```json fences and stray prose). */
export function extractJson<T = Record<string, unknown>>(raw: string): T | null {
  const text = raw.replace(/<think>[\s\S]*?<\/think>/gi, "");
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)?.[1];
  for (const cand of [fenced, text]) {
    if (!cand) continue;
    const start = cand.indexOf("{");
    const end = cand.lastIndexOf("}");
    if (start < 0 || end <= start) continue;
    try {
      return JSON.parse(cand.slice(start, end + 1)) as T;
    } catch {}
  }
  return null;
}

export { ProviderError };


/* ---------------- OpenRouter extras ---------------- */

export type OrModel = { id: string; name: string; context: number; free: boolean; tools: boolean; json: boolean; promptPerM: number; completionPerM: number };

let orCache: { at: number; models: OrModel[] } | null = null;

/** Live OpenRouter catalog (public endpoint, cached 1h). */
export async function openrouterCatalog(): Promise<OrModel[]> {
  if (orCache && Date.now() - orCache.at < 3600_000) return orCache.models;
  const res = await fetch("https://openrouter.ai/api/v1/models", { signal: AbortSignal.timeout(10_000), next: { revalidate: 3600 } });
  if (!res.ok) throw new ProviderError(res.status, "OpenRouter catalog unavailable");
  const j = await res.json();
  const models: OrModel[] = (j.data ?? []).map((m: any) => {
    const p = Number(m.pricing?.prompt ?? 0), c = Number(m.pricing?.completion ?? 0);
    const params: string[] = m.supported_parameters ?? [];
    return {
      id: String(m.id), name: String(m.name ?? m.id), context: Number(m.context_length ?? 0),
      free: String(m.id).endsWith(":free") || m.id === "openrouter/free" || (p === 0 && c === 0),
      tools: params.includes("tools"), json: params.includes("response_format") || params.includes("structured_outputs"),
      promptPerM: Math.round(p * 1e6 * 100) / 100, completionPerM: Math.round(c * 1e6 * 100) / 100,
    };
  }).filter((m: OrModel) => m.promptPerM >= 0 && m.completionPerM >= 0);
  orCache = { at: Date.now(), models };
  return models;
}

/** Key usage & free-tier allowance for the configured OpenRouter key. */
export async function openrouterKeyInfo(): Promise<Record<string, unknown> | null> {
  const key = keyFor.openrouter();
  if (!key) return null;
  const res = await fetch("https://openrouter.ai/api/v1/key", { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8000), cache: "no-store" });
  if (!res.ok) return { error: `key check failed (${res.status})` };
  const j = await res.json();
  const d = j.data ?? {};
  return {
    label: d.label ?? null,
    usage: d.usage ?? null,
    limit: d.limit ?? null,
    limit_remaining: d.limit_remaining ?? null,
    is_free_tier: d.is_free_tier ?? null,
    free_model_daily_requests: d.free_model_daily_requests ?? null,
  };
}
