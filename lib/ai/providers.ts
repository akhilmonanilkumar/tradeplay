import "server-only";

/**
 * Provider-agnostic model calls. One coach, any model:
 *   anthropic:<model>  → Anthropic Messages API        (ANTHROPIC_API_KEY)
 *   openai:<model>     → OpenAI Chat Completions       (OPENAI_API_KEY, optional OPENAI_BASE_URL)
 *   google:<model>     → Gemini generateContent         (GEMINI_API_KEY or GOOGLE_API_KEY)
 *   compat:<model>     → any OpenAI-compatible endpoint (COMPAT_BASE_URL + COMPAT_API_KEY) — OpenRouter, Groq,
 *                        Together, DeepSeek, Mistral, a local Ollama/LM Studio, …
 * AI_MODELS lists the models offered in the UI (first = default), e.g.
 *   AI_MODELS="anthropic:claude-sonnet-5-5,openai:gpt-4.1-mini,google:gemini-2.5-flash"
 * Keys live only in server env vars; nothing here is shipped to the browser.
 */

export type Provider = "anthropic" | "openai" | "google" | "compat";
export type ModelRef = { id: string; provider: Provider; model: string; label: string };
export type ChatMsg = { role: "user" | "assistant"; content: string };

const env = (k: string) => (process.env[k] ?? "").trim();
const keyFor: Record<Provider, () => string> = {
  anthropic: () => env("ANTHROPIC_API_KEY"),
  openai: () => env("OPENAI_API_KEY"),
  google: () => env("GEMINI_API_KEY") || env("GOOGLE_API_KEY"),
  compat: () => env("COMPAT_API_KEY") || (env("COMPAT_BASE_URL") ? "none" : ""),
};

const DEFAULTS: Record<Provider, string> = {
  anthropic: "claude-sonnet-5-5",
  openai: "gpt-4.1-mini",
  google: "gemini-2.5-flash",
  compat: "",
};

function parseRef(s: string): ModelRef | null {
  const m = /^(anthropic|openai|google|compat):(.+)$/.exec(s.trim());
  if (!m) return null;
  const provider = m[1] as Provider;
  return { id: `${provider}:${m[2]}`, provider, model: m[2], label: `${m[2]} · ${provider === "compat" ? "custom" : provider}` };
}

/** Models usable right now (configured and with a key). */
export function availableModels(): ModelRef[] {
  const listed = env("AI_MODELS").split(",").map(parseRef).filter((x): x is ModelRef => !!x);
  const auto = (Object.keys(DEFAULTS) as Provider[])
    .filter((p) => DEFAULTS[p] && keyFor[p]())
    .map((p) => parseRef(`${p}:${DEFAULTS[p]}`)!);
  const all = listed.length ? listed : auto;
  return all.filter((m) => !!keyFor[m.provider]());
}

export function pickModel(id?: string | null): ModelRef | null {
  const all = availableModels();
  return all.find((m) => m.id === id) ?? all[0] ?? null;
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
  constructor(public status: number, message: string) {
    super(message);
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
export function extractJson<T = Record<string, unknown>>(text: string): T | null {
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
