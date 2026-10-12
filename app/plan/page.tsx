"use client";

import { useEffect, useMemo, useState } from "react";
import { useData } from "@/components/Shell";
import { Card, Check, Field, PageHead, Segmented } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { todayIST } from "@/lib/calc";
import { PREMARKET, type DayPlan } from "@/lib/types";

type Draft = Omit<DayPlan, "id">;

export default function Plan() {
  const { accounts, plans, refresh } = useData();
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
  }, [accounts]);

  const existing = useMemo(() => plans.find((p) => p.account_id === accountId && p.plan_date === date), [plans, accountId, date]);

  useEffect(() => {
    setDraft(
      existing
        ? { ...existing }
        : { account_id: accountId, plan_date: date, bias: null, htf_range: "", magnet: "", invalidation: "", pois: "", news_times: [], checklist: {}, notes: "" },
    );
    setSaved("idle");
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
    };
    const { error } = await supabase.from("day_plans").upsert(payload, { onConflict: "account_id,plan_date" });
    if (error) {
      setErr(error.message);
      return setSaved("error");
    }
    await refresh();
    setSaved("saved");
  }

  return (
    <>
      <PageHead
        title="Pre-market plan"
        sub="Do this before your window opens. Entries are blocked ±15 min around the news times you add."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented value={accountId} onChange={setAccountId} options={active.map((a) => ({ value: a.id, label: a.instrument }))} />
            <input type="date" className="input w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        }
      />

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
