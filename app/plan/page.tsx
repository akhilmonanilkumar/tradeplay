"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useData } from "@/components/Shell";
import { Card, Check, Chips, Field, PageHead, Segmented } from "@/components/ui";
import VoiceButton from "@/components/Voice";
import { useMarket } from "@/components/Market";
import { supabase } from "@/lib/supabase";
import { todayIST, windowLabel, sessionAt } from "@/lib/calc";
import { parseDictation } from "@/lib/analysis";
import { newsTimesFor } from "@/lib/events";
import { askCoach, resolveAccount, useCoachStatus } from "@/lib/coach";
import { PREMARKET, SESSION_CHOICES, type DayPlan, type SessionName } from "@/lib/types";

type Draft = Omit<DayPlan, "id">;

function mergeVoice(d: Draft, f: Record<string, unknown>, text: string): Draft {
  const sessions = (Array.isArray(f.sessions) ? (f.sessions as string[]) : []).filter((x): x is SessionName => (SESSION_CHOICES as string[]).includes(x));
  const news = Array.isArray(f.news_times) ? (f.news_times as string[]).filter((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)) : [];
  const str = (k: string) => (typeof f[k] === "string" && f[k] ? String(f[k]) : null);
  return {
    ...d,
    bias: (["long", "short", "neutral"].includes(String(f.bias)) ? f.bias : d.bias) as Draft["bias"],
    htf_range: str("htf_range") ?? d.htf_range,
    magnet: str("magnet") ?? d.magnet,
    invalidation: str("invalidation") ?? d.invalidation,
    pois: str("pois") ?? d.pois,
    custom_window: str("custom_window") ?? d.custom_window,
    sessions: sessions.length ? sessions : d.sessions,
    news_times: [...new Set([...(d.news_times ?? []), ...news])].sort().slice(0, 12),
    notes: [d.notes, text].filter(Boolean).join("\n"),
  };
}

export default function Plan() {
  const { accounts, plans, refresh, coachDb } = useData();
  const status = useCoachStatus();
  const market = useMarket();
  const [heard, setHeard] = useState("");
  const [parsing, setParsing] = useState(false);
  const [autoVoice, setAutoVoice] = useState(false);
  const pending = useRef<{ f: Record<string, unknown>; text: string } | null>(null);
  const active = accounts.filter((a) => a.status === "active");
  const [accountId, setAccountId] = useState(active[0]?.id ?? "");
  const [date, setDate] = useState(todayIST());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [newsInput, setNewsInput] = useState("");
  const [saved, setSaved] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [err, setErr] = useState("");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("account");
    if (q && accounts.some((a) => a.id === q)) setAccountId(q);
    if (new URLSearchParams(window.location.search).get("voice") === "1") setAutoVoice(true);
  }, [accounts]);

  const existing = useMemo(() => plans.find((p) => p.account_id === accountId && p.plan_date === date), [plans, accountId, date]);

  useEffect(() => {
    const base: Draft = existing
      ? { ...existing }
      : { account_id: accountId, plan_date: date, bias: null, htf_range: "", magnet: "", invalidation: "", pois: "", news_times: [], checklist: {}, notes: "", sessions: [], custom_window: null };
    const v = pending.current;
    pending.current = null;
    setDraft(v ? mergeVoice(base, v.f, v.text) : base);
    setSaved(v ? "idle" : "idle");
  }, [existing, accountId, date]);

  if (!draft) return null;
  const done = PREMARKET.filter((p) => draft.checklist?.[p.key]).length;
  const acct = accounts.find((a) => a.id === accountId);

  function set<K extends keyof Draft>(k: K, v: Draft[K]) {
    setDraft((d) => (d ? { ...d, [k]: v } : d));
    setSaved("idle");
  }

  function addNews() {
    const v = newsInput.trim();
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) return setErr("Use 24h HH:MM in IST, e.g. 18:00");
    setErr("");
    if (!draft!.news_times.includes(v)) set("news_times", [...draft!.news_times, v].sort());
    setNewsInput("");
  }

  async function save() {
    setSaved("saving");
    const payload = {
      account_id: accountId,
      plan_date: date,
      bias: draft!.bias,
      htf_range: draft!.htf_range || null,
      magnet: draft!.magnet || null,
      invalidation: draft!.invalidation || null,
      pois: draft!.pois || null,
      news_times: draft!.news_times,
      checklist: draft!.checklist,
      notes: draft!.notes || null,
      ...(coachDb ? { sessions: draft!.sessions ?? [], custom_window: (draft!.sessions ?? []).includes("Custom") ? draft!.custom_window || null : null } : {}),
    };
    if (coachDb && (draft!.sessions ?? []).includes("Custom") && !/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(draft!.custom_window ?? "")) {
      setErr("Custom window needs a from and to time");
      return setSaved("error");
    }
    const { error } = await supabase.from("day_plans").upsert(payload, { onConflict: "account_id,plan_date" });
    if (error) {
      setErr(error.message);
      return setSaved("error");
    }
    await refresh();
    setSaved("saved");
  }

  async function fromVoice(text: string) {
    setHeard(text);
    const local = parseDictation(text, accounts);
    let f: Record<string, unknown> = { ...local };
    if (status?.enabled) {
      setParsing(true);
      const r = await askCoach("parse", { payload: { text, target: "plan" } });
      setParsing(false);
      const ai = (r.fields ?? {}) as Record<string, unknown>;
      f = { ...local, ...Object.fromEntries(Object.entries(ai).filter(([, v]) => v != null && v !== "")) };
    }
    const acc = typeof f.account === "string" ? resolveAccount(accounts, f.account) : null;
    const target = acc?.id ?? (local.account_id as string | undefined);
    if (target && target !== accountId) {
      pending.current = { f, text };
      setAccountId(target);
    } else {
      setDraft((d) => (d ? mergeVoice(d, f, text) : d));
    }
    setSaved("idle");
  }

  const calTimes = newsTimesFor(market.data?.events ?? [], date);
  const sessions = draft.sessions ?? [];
  const [cwFrom, cwTo] = (draft.custom_window ?? "-").split("-");

  return (
    <>
      <PageHead
        title="Pre-market plan"
        sub="Do this before your window opens. Entries are blocked ±15 min around the news times you add."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <VoiceButton label="Dictate plan" autoStart={autoVoice} onInterim={setHeard} onText={fromVoice} />
            <Segmented value={accountId} onChange={setAccountId} options={active.map((a) => ({ value: a.id, label: a.instrument }))} />
            <input type="date" className="input w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        }
      />

      {(heard || parsing) && (
        <div className="coach mb-4 p-3 text-sm">
          <span className="label mr-2 text-accent">{parsing ? "Understanding…" : "Heard"}</span>
          {heard}
          <p className="mt-1 text-xs text-mute">Try: “Gold, bias long, HTF range 4,180 to 4,260, magnet PDH 4,252, invalidation close below 4,195, London and New York, CPI at 18:00”.</p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <Card title={`Checklist · ${done}/${PREMARKET.length}`} className="lg:col-span-2">
          <div className="space-y-2">
            {PREMARKET.map((p) => (
              <Check key={p.key} label={p.label} checked={!!draft.checklist?.[p.key]} onChange={(v) => set("checklist", { ...draft.checklist, [p.key]: v })} />
            ))}
          </div>
        </Card>

        <Card title={`${acct?.name ?? ""} · bias & levels`} className="lg:col-span-3">
          <div className="space-y-4">
            <Field label="Bias">
              <Segmented
                value={draft.bias ?? "neutral"}
                onChange={(v) => set("bias", v as Draft["bias"])}
                options={[{ value: "long", label: "Long only" }, { value: "short", label: "Short only" }, { value: "neutral", label: "No bias / stand aside" }]}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="HTF swing range"><input className="input" maxLength={200} placeholder="e.g. 4H 81,200 → 86,900, price in premium" value={draft.htf_range ?? ""} onChange={(e) => set("htf_range", e.target.value)} /></Field>
              <Field label="Liquidity magnet"><input className="input" maxLength={200} placeholder="e.g. PDH 4,212 + EQH" value={draft.magnet ?? ""} onChange={(e) => set("magnet", e.target.value)} /></Field>
            </div>
            <Field label="Invalidation" hint="Bias is wrong if price closes and holds beyond…">
              <input className="input" maxLength={500} value={draft.invalidation ?? ""} onChange={(e) => set("invalidation", e.target.value)} />
            </Field>
            <Field label="15M POIs (extreme first)">
              <textarea className="input min-h-16" maxLength={2000} value={draft.pois ?? ""} onChange={(e) => set("pois", e.target.value)} />
            </Field>
            {coachDb && (
              <Field label="Sessions to trade today" hint={sessions.length ? `Entries allowed in: ${windowLabel(acct ?? { session_window: "Any" }, draft)} · now ${sessionAt().inWindow ? sessionAt().name : "off-session"}` : `Using the account default (${acct?.session_window ?? "—"}). Pick one or more to override for this day.`}>
                <Chips options={SESSION_CHOICES} value={sessions} onChange={(v) => set("sessions", v as SessionName[])} />
                {sessions.includes("Custom") && (
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <span className="text-mute">IST</span>
                    <input type="time" className="input num w-auto" value={cwFrom || ""} onChange={(e) => set("custom_window", `${e.target.value}-${cwTo || ""}`)} aria-label="Custom window start (IST)" />
                    <span className="text-mute">to</span>
                    <input type="time" className="input num w-auto" value={cwTo || ""} onChange={(e) => set("custom_window", `${cwFrom || ""}-${e.target.value}`)} aria-label="Custom window end (IST)" />
                  </div>
                )}
              </Field>
            )}
            <Field label="High-impact news today (IST)">
              <div className="flex gap-2">
                <input className="input num w-28" placeholder="18:00" value={newsInput} onChange={(e) => setNewsInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addNews())} />
                <button type="button" className="btn-ghost" onClick={addNews}>Add</button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {draft.news_times.map((t) => (
                  <button key={t} type="button" className="chip num hover:border-down hover:text-down" onClick={() => set("news_times", draft.news_times.filter((x) => x !== t))}>
                    {t} ✕
                  </button>
                ))}
                {!draft.news_times.length && <span className="text-xs text-mute">None added</span>}
              </div>
              {calTimes.some((t) => !draft.news_times.includes(t)) && (
                <button type="button" className="mt-2 text-xs text-accent" onClick={() => set("news_times", [...new Set([...draft.news_times, ...calTimes])].sort().slice(0, 12))}>
                  + Add from economic calendar: {calTimes.join(", ")}
                </button>
              )}
            </Field>
            <Field label="Notes"><textarea className="input min-h-16" maxLength={4000} value={draft.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></Field>
            {err && <p className="text-sm text-down">{err}</p>}
            <div className="flex items-center justify-end gap-3">
              <span className="text-xs text-mute">{saved === "saved" ? "Saved" : saved === "saving" ? "Saving…" : ""}</span>
              <button className="btn-primary" onClick={save} disabled={saved === "saving"}>Save plan</button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
