"use client";

import { useMemo, useState } from "react";
import { useData } from "@/components/Shell";
import { Badge, Chips } from "@/components/ui";
import VoiceButton from "@/components/Voice";
import { ActionChips, Markdown, Sparkle } from "@/components/coach-ui";
import { diagnoseTrade } from "@/lib/analysis";
import { askCoach, asList, asText, useCoachStatus, type CoachResult } from "@/lib/coach";
import { fmtIST, todayIST } from "@/lib/calc";
import { supabase } from "@/lib/supabase";
import { ALL_FEELINGS, FEELINGS, MENTAL_KEYS, type CoachAction, type EmotionEntry, type Trade, type TradeStage } from "@/lib/types";

const STAGE_LABEL: Record<TradeStage, string> = { pre: "Before entry", during: "In the trade", post: "After exit" };

/** Feelings across the life of a trade: pre (from New trade), during (any time while open), post (on close). */
export function EmotionTimeline({ trade }: { trade: Trade }) {
  const { refresh, coachDb } = useData();
  const [stage, setStage] = useState<TradeStage>(trade.status === "open" ? "during" : "post");
  const [picked, setPicked] = useState<string[]>([]);
  const [intensity, setIntensity] = useState(3);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<EmotionEntry[]>(trade.emotion_log ?? []);
  if (!coachDb) return null;

  async function add() {
    if (!picked.length && !note.trim()) return;
    setBusy(true);
    const next = [...log, { at: new Date().toISOString(), stage, emotions: picked, intensity, note: note.trim() || undefined }].slice(-50);
    const { error } = await supabase.from("trades").update({ emotion_log: next }).eq("id", trade.id);
    setBusy(false);
    if (error) return;
    setLog(next);
    setPicked([]);
    setNote("");
    refresh();
  }

  const neg = (e: string) => (FEELINGS.negative as readonly string[]).includes(e);
  return (
    <div className="rounded-xl border border-line p-3">
      <div className="label mb-2">Emotion tracker</div>
      {Object.keys(trade.mental ?? {}).length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5 text-[11px]">
          {MENTAL_KEYS.filter((m) => trade.mental?.[m.key] != null).map((m) => (
            <Badge key={m.key} tone={(m.good === "high" ? trade.mental![m.key]! >= 4 : trade.mental![m.key]! <= 2) ? "up" : (m.good === "high" ? trade.mental![m.key]! <= 2 : trade.mental![m.key]! >= 4) ? "down" : "mute"}>
              {m.label} {trade.mental![m.key]}/5
            </Badge>
          ))}
        </div>
      )}
      {log.length > 0 && (
        <ol className="mb-3 space-y-1.5 border-l border-line pl-3">
          {log.map((e, i) => (
            <li key={i} className="text-sm">
              <span className="text-xs text-mute">{STAGE_LABEL[e.stage]} · {fmtIST(e.at, false)}{e.intensity ? ` · ${e.intensity}/5` : ""}</span>
              <div className="flex flex-wrap gap-1">
                {e.emotions.map((x) => <Badge key={x} tone={neg(x) ? "down" : "up"}>{x}</Badge>)}
                {e.note && <span className="text-mute">{e.note}</span>}
              </div>
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {(["pre", "during", "post"] as TradeStage[]).map((s) => (
          <button key={s} type="button" onClick={() => setStage(s)} className={`rounded-md px-2 py-1 text-xs ${stage === s ? "bg-ink text-bg" : "text-mute hover:text-ink"}`}>{STAGE_LABEL[s]}</button>
        ))}
        <span className="flex-1" />
        <VoiceButton size="sm" label="Say it" onText={(t) => {
          setNote((n) => [n, t].filter(Boolean).join(" "));
          const low = t.toLowerCase();
          setPicked((p) => [...new Set([...p, ...ALL_FEELINGS.filter((f) => low.includes(f.toLowerCase()))])]);
        }} />
      </div>
      <div className="mt-2"><Chips options={ALL_FEELINGS} value={picked} onChange={setPicked} /></div>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs text-mute">Intensity</span>
        <input type="range" min={1} max={5} value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} className="w-28 accent-[rgb(var(--accent))]" aria-label="Intensity" />
        <span className="num text-xs">{intensity}/5</span>
        <input className="input h-8 min-h-0 flex-1 py-0" placeholder="What's going on? (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
        <button className="btn-ghost h-8 min-h-0 text-xs" disabled={busy || (!picked.length && !note.trim())} onClick={add}>Log</button>
      </div>
    </div>
  );
}

type Analysis = CoachResult & { verdict?: string; causes?: string[]; keep?: string[]; lesson?: { title: string; rule: string; cause: string } | null; actions?: CoachAction[] };

/** Why did this trade win or lose — instant rule-engine diagnosis, optional AI depth, and one-tap lesson. */
export function TradeDiagnosis({ trade }: { trade: Trade }) {
  const { accounts, plans, trades, lessons, refresh, coachDb } = useData();
  const status = useCoachStatus();
  const account = accounts.find((a) => a.id === trade.account_id) ?? null;
  const plan = plans.find((p) => p.account_id === trade.account_id && p.plan_date === todayIST(new Date(trade.opened_at))) ?? null;
  const d = useMemo(() => diagnoseTrade(trade, { account, plan, trades }), [trade, account, plan, trades]);
  const [ai, setAi] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(lessons.some((l) => l.trade_id === trade.id));
  const [mgmt, setMgmt] = useState<CoachResult | null>(null);
  const [price, setPrice] = useState("");

  async function saveLesson(l: { title: string; rule: string; cause?: string }, source: "auto" | "ai") {
    const { error } = await supabase.from("lessons").insert({
      trade_id: trade.id, account_id: trade.account_id, instrument: trade.instrument, kind: d.outcome === "win" ? "win" : d.outcome === "loss" ? "loss" : "rule",
      title: l.title.slice(0, 200), rule: l.rule.slice(0, 500), cause: l.cause?.slice(0, 2000) ?? null, source,
      tags: d.causes.filter((c) => c.severity !== "good").map((c) => c.code).slice(0, 12),
    });
    if (!error) {
      setSaved(true);
      refresh();
    }
  }

  if (trade.status === "open") {
    return (
      <div className="coach p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-sm font-medium"><Sparkle className="h-4 w-4 text-chart" /> In-trade guidance</span>
          <span className="flex-1" />
          {status?.enabled ? (
            <>
              <input className="input num h-8 min-h-0 w-28 py-0" placeholder="Price now" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
              <button className="btn-ghost h-8 min-h-0 text-xs" disabled={busy} onClick={async () => { setBusy(true); setMgmt(await askCoach("manage", { payload: { trade_id: trade.id, price: price || undefined } })); setBusy(false); }}>{busy ? "…" : "What now?"}</button>
            </>
          ) : null}
        </div>
        {mgmt?.error && <p className="mt-2 text-sm text-down">{mgmt.error}</p>}
        {mgmt?.reply && <div className="mt-2 text-sm"><Markdown text={String(mgmt.reply)} /><ActionChips actions={mgmt.actions} /></div>}
        {!mgmt && <p className="mt-1.5 text-xs text-mute">Plan: hold to TP {trade.tp}. First 30 trades are set-and-forget; after that BE only at +2R with a new LTF swing in your favour.</p>}
      </div>
    );
  }
  if (trade.status !== "closed") return null;

  return (
    <div className="coach p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium"><Sparkle className="h-4 w-4 text-chart" /> Why did this {d.outcome === "win" ? "win" : d.outcome === "loss" ? "lose" : "scratch"}?</span>
        <span className="flex-1" />
        {status?.enabled && coachDb && (
          <button className="btn-ghost h-8 min-h-0 text-xs" disabled={busy} onClick={async () => { setBusy(true); setAi((await askCoach("analyze", { payload: { trade_id: trade.id } })) as Analysis); setBusy(false); }}>
            {busy ? "Analysing…" : ai ? "Re-analyse" : "Deeper analysis"}
          </button>
        )}
      </div>
      <p className="mt-2 text-sm">{d.verdict}</p>
      <ul className="mt-2 space-y-1 text-sm">
        {d.causes.map((c) => (
          <li key={c.code} className="flex gap-2">
            <span className={c.severity === "bad" ? "text-down" : c.severity === "warn" ? "text-warn" : "text-up"}>{c.severity === "bad" ? "✕" : c.severity === "warn" ? "!" : "✓"}</span>
            <span>{c.text}</span>
          </li>
        ))}
      </ul>
      {ai?.error && <p className="mt-2 text-sm text-down">{ai.error}</p>}
      {ai && !ai.error && (
        <div className="mt-3 space-y-2 border-t border-accent/20 pt-3 text-sm">
          {ai.verdict && <p className="font-medium">{asText(ai.verdict)}</p>}
          {asList(ai.causes).length > 0 && <ul className="list-disc space-y-0.5 pl-4">{asList(ai.causes).map((c, i) => <li key={i}>{c}</li>)}</ul>}
          {asList(ai.keep).length > 0 && <div><span className="text-up">Repeat:</span> {asList(ai.keep).join(" · ")}</div>}
          <ActionChips actions={ai.actions} />
        </div>
      )}
      {coachDb && ((ai?.lesson && typeof ai.lesson === "object" && typeof ai.lesson.rule === "string") || d.lesson) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-raised px-3 py-2 text-sm">
          <span className="flex-1">→ {((ai?.lesson && typeof ai.lesson.rule === "string" ? ai.lesson : null) ?? d.lesson)!.rule}</span>
          <button className="btn-ghost h-8 min-h-0 text-xs" disabled={saved} onClick={() => saveLesson(((ai?.lesson && typeof ai.lesson.rule === "string" ? ai.lesson : null) ?? d.lesson)!, ai?.lesson ? "ai" : "auto")}>
            {saved ? "✓ Lesson saved" : "Remember this lesson"}
          </button>
        </div>
      )}
    </div>
  );
}
