"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui";
import { askCoach, authedFetch, preferredModel, setPreferredModel, useCoachStatus } from "@/lib/coach";

type Preset = { slug: string; label: string; note: string };
type OrModel = { id: string; name: string; context: number; free: boolean; tools: boolean; json: boolean; promptPerM: number; completionPerM: number };
type KeyInfo = { label?: string | null; usage?: number | null; limit?: number | null; limit_remaining?: number | null; is_free_tier?: boolean | null; free_model_daily_requests?: { used?: number; limit?: number } | number | null; error?: string };
type Resp = { connected: boolean; presets: Preset[]; key?: KeyInfo | null; models?: OrModel[] };

const ctx = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}M` : `${Math.round(n / 1000)}K`);

/** Pick the coach's model: configured ones, OpenRouter free presets, or anything in the live OpenRouter catalog. */
export default function EnginePanel() {
  const status = useCoachStatus();
  const [data, setData] = useState<Resp | null>(null);
  const [current, setCurrent] = useState<string | undefined>(undefined);
  const [q, setQ] = useState("");
  const [freeOnly, setFreeOnly] = useState(true);
  const [test, setTest] = useState<{ busy?: boolean; ok?: boolean; text?: string } | null>(null);
  const runTest = async () => {
    setTest({ busy: true });
    const r = await askCoach("ping");
    setTest(r.ok ? { ok: true, text: `${String(r.model ?? "").replace(/^\w+:/, "")} answered in ${r.ms} ms` } : { ok: false, text: String(r.error ?? "No response") });
  };

  useEffect(() => {
    setCurrent(preferredModel());
    authedFetch("/api/ai/models").then(async (r) => setData(r.ok ? await r.json() : null)).catch(() => setData(null));
  }, []);

  const choose = (id: string) => {
    setPreferredModel(id);
    setCurrent(id);
  };
  const active = current ?? status?.models?.[0]?.id;

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data?.models ?? []).filter((m) => (!freeOnly || m.free) && (!s || `${m.id} ${m.name}`.toLowerCase().includes(s))).slice(0, 60);
  }, [data, q, freeOnly]);

  const daily = data?.key?.free_model_daily_requests;
  const dailyText = typeof daily === "number" ? `${daily} free requests today` : daily && typeof daily === "object" ? `${daily.used ?? 0} / ${daily.limit ?? "—"} free requests today` : null;

  return (
    <div className="space-y-4 text-sm">
      <div>
        <div className="label mb-1.5">Configured models</div>
        {!status?.models?.length && <p className="text-xs text-mute">None yet — add an API key on the server (docs/ai-coach.md).</p>}
        <ul className="space-y-1">
          {status?.models?.map((m) => (
            <li key={m.id}>
              <button onClick={() => choose(m.id)} className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left ${active === m.id ? "bg-chart/15 text-ink" : "hover:bg-raised"}`}>
                <span className="truncate">{m.label}</span>
                {active === m.id && <span className="text-chart">●</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-line p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold">Test the coach</span>
          <button className="btn-ghost h-8 min-h-0 text-xs" onClick={runTest} disabled={test?.busy || !status?.enabled}>{test?.busy ? "Testing…" : "Run test"}</button>
        </div>
        <p className={`mt-1.5 text-xs ${test?.ok ? "text-up" : test?.ok === false ? "text-down" : "text-mute"}`}>
          {test?.text ?? (status?.enabled ? "Sends a one-word request to the selected model." : "No AI provider configured on the server.")}
        </p>
      </div>

      <div className="rounded-2xl border border-line p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold">OpenRouter</span>
          {data?.connected ? <Badge tone="up">connected</Badge> : <Badge>not connected</Badge>}
        </div>
        {data?.connected ? (
          <div className="mt-1.5 space-y-0.5 text-xs text-mute">
            {data.key?.error && <div className="text-down">{data.key.error}</div>}
            {dailyText && <div>{dailyText}</div>}
            {data.key?.usage != null && <div>Credits used: ${Number(data.key.usage).toFixed(2)}{data.key.limit != null ? ` of $${data.key.limit}` : ""}</div>}
            <div>Free models: 20 req/min · 50/day (1,000/day after a one-time $10 credit). Busy free models fall back automatically.</div>
          </div>
        ) : (
          <p className="mt-1.5 text-xs text-mute">
            Add <code className="num">OPENROUTER_API_KEY</code> (openrouter.ai → Keys) to Vercel env and redeploy to unlock the free models below.
          </p>
        )}
      </div>

      <div>
        <div className="label mb-1.5">Free picks for the coach</div>
        <ul className="space-y-1">
          {(data?.presets ?? []).map((p) => {
            const id = `openrouter:${p.slug}`;
            return (
              <li key={p.slug}>
                <button disabled={!data?.connected} onClick={() => choose(id)} className={`w-full rounded-xl px-3 py-2 text-left disabled:opacity-50 ${active === id ? "bg-chart/15" : "hover:bg-raised"}`}>
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{p.label}</span>
                    {active === id ? <span className="text-chart">●</span> : <Badge tone="up">free</Badge>}
                  </span>
                  <span className="block text-xs text-mute">{p.note}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {data?.connected && (
        <div>
          <div className="label mb-1.5">Browse all OpenRouter models</div>
          <div className="flex gap-2">
            <input className="input" type="search" placeholder="Search (e.g. deepseek, qwen, claude)" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-mute">
            <input type="checkbox" checked={freeOnly} onChange={(e) => setFreeOnly(e.target.checked)} className="accent-[rgb(var(--chart))]" /> Free only
          </label>
          <ul className="mt-2 max-h-80 space-y-1 overflow-y-auto">
            {list.map((m) => {
              const id = `openrouter:${m.id}`;
              return (
                <li key={m.id}>
                  <button onClick={() => choose(id)} className={`w-full rounded-xl px-3 py-2 text-left ${active === id ? "bg-chart/15" : "hover:bg-raised"}`}>
                    <span className="block truncate text-[13px] font-medium">{m.name}</span>
                    <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-mute">
                      <span className="num truncate">{m.id}</span>· {ctx(m.context)}
                      {m.free ? <Badge tone="up">free</Badge> : <span className="num">${m.promptPerM}/${m.completionPerM} per M</span>}
                      {m.tools && <Badge>tools</Badge>}
                      {m.json && <Badge>JSON</Badge>}
                    </span>
                  </button>
                </li>
              );
            })}
            {!list.length && <li className="px-3 py-2 text-xs text-mute">No matches.</li>}
          </ul>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-mute">
        Privacy: free endpoints may log or train on prompts, and coach prompts include your journal context. In OpenRouter → Settings → Privacy you choose which providers are allowed; pick a paid model for sensitive work.
      </p>
    </div>
  );
}
