"use client";

import { confirmDialog } from "@/components/Dialogs";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useData } from "@/components/Shell";
import { Badge, Chips, Field, Modal, numOrNull } from "@/components/ui";
import { fmtIST, fmtR, fmtUsd } from "@/lib/calc";
import { ALL_FEELINGS, GATE_CHECKS, MISTAKES, type Trade } from "@/lib/types";
import { EmotionTimeline, TradeDiagnosis } from "@/components/TradeInsight";
import VoiceButton from "@/components/Voice";
import { parseDictation } from "@/lib/analysis";
import { askCoach, useCoachStatus } from "@/lib/coach";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp"];

function Shot({ path, label, onUpload }: { path: string | null; label: string; onUpload: (f: File) => Promise<void> }) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    if (!path) return setUrl(null);
    supabase.storage.from("screenshots").createSignedUrl(path, 600).then(({ data }) => live && setUrl(data?.signedUrl ?? null));
    return () => { live = false; };
  }, [path]);

  async function take(f: File | undefined | null) {
    if (!f) return;
    if (!TYPES.includes(f.type)) return setErr("PNG, JPG or WebP only");
    if (f.size > MAX_BYTES) return setErr("Max 5 MB");
    setErr(null);
    setBusy(true);
    await onUpload(f);
    setBusy(false);
  }

  return (
    <div
      className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-dashed border-line text-xs text-mute"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); take(e.dataTransfer.files?.[0]); }}
      onPaste={(e) => take([...e.clipboardData.files][0])}
      tabIndex={0}
    >
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block h-full w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={label} className="h-full w-full object-cover" />
        </a>
      ) : (
        <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 p-3 text-center">
          <span>{busy ? "Uploading…" : `${label} — drop, paste or pick`}</span>
          {err && <span className="text-down">{err}</span>}
          <input type="file" accept={TYPES.join(",")} className="hidden" onChange={(e) => take(e.target.files?.[0])} />
        </label>
      )}
      <span className="absolute left-2 top-2 rounded bg-bg/80 px-1.5 py-0.5 text-[10px]">{label}</span>
    </div>
  );
}

/** Public link for a trade: create/revoke, copy, native share, post to X. */
function SharePanel({ trade }: { trade: Trade }) {
  const { refresh, socialDb, profile, openProfile } = useData();
  const [id, setId] = useState<string | null>(trade.share_id ?? null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => setId(trade.share_id ?? null), [trade.share_id]);
  if (!socialDb) return null;
  const url = id && typeof window !== "undefined" ? `${window.location.origin}/t/${id}` : "";
  const text = `${trade.direction === "long" ? "Long" : "Short"} ${trade.instrument}${trade.status === "closed" && trade.r_multiple != null ? ` · ${fmtR(trade.r_multiple)}` : ""} — verified on A+ TradePlay`;
  async function toggle(on: boolean) {
    setBusy(true);
    setErr(null);
    const next = on ? crypto.randomUUID() : null;
    const { error } = await supabase.from("trades").update({ share_id: next }).eq("id", trade.id);
    setBusy(false);
    if (error) return setErr(error.message);
    setId(next);
    refresh();
  }
  return (
    <div className="mb-4 rounded-2xl border border-line p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-chart" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v14" /></svg>
          Share this trade
        </span>
        {id ? (
          <button className="text-xs text-mute hover:text-down" disabled={busy} onClick={() => toggle(false)}>Stop sharing</button>
        ) : (
          <button className="btn-ghost h-8 min-h-0 px-3 text-xs" disabled={busy} onClick={() => toggle(true)}>{busy ? "Creating…" : "Create public link"}</button>
        )}
      </div>
      {id ? (
        <>
          <div className="mt-2 flex items-center gap-2 rounded-xl bg-raised px-3 py-2 text-xs">
            <span className="num min-w-0 flex-1 truncate">{url.replace(/^https?:\/\//, "")}</span>
            <button className="shrink-0 font-medium text-accent" onClick={async () => { await navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "Copied" : "Copy"}</button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {typeof navigator !== "undefined" && "share" in navigator && (
              <button className="chip h-8 px-3 text-xs" onClick={() => navigator.share({ title: text, url }).catch(() => {})}>Share…</button>
            )}
            <a className="chip h-8 px-3 text-xs" target="_blank" rel="noopener noreferrer" href={`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`}>Post on X</a>
            <a className="chip h-8 px-3 text-xs" target="_blank" rel="noopener noreferrer" href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`}>Telegram</a>
            <a className="chip h-8 px-3 text-xs" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`}>WhatsApp</a>
            <a className="chip h-8 px-3 text-xs" target="_blank" rel="noopener noreferrer" href={url}>Preview ↗</a>
          </div>
          <p className="mt-2 text-[11px] text-mute">
            Shows levels, R and the A+ gate with a verified badge — never your account, balance or notes{profile?.show_usd ? "; $ P&L is shown (profile setting)" : ""}.
            {!profile?.is_public && <> Your name appears once your profile is public — <button className="text-accent" onClick={openProfile}>edit profile</button>.</>}
          </p>
        </>
      ) : (
        <p className="mt-1 text-[11px] text-mute">Creates a read-only link with a preview card for X, Telegram, WhatsApp and more.</p>
      )}
      {err && <p className="mt-1 text-xs text-down">{err}</p>}
    </div>
  );
}

export default function TradeModal({ trade, onClose }: { trade: Trade | null; onClose: () => void }) {
  const { refresh, session, accounts, setups } = useData();
  const coach = useCoachStatus();
  const [exit, setExit] = useState("");
  const [gross, setGross] = useState("");
  const [fees, setFees] = useState("");
  const [mistakes, setMistakes] = useState<string[]>([]);
  const [emotions, setEmotions] = useState<string[]>([]);
  const [review, setReview] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [paths, setPaths] = useState<{ before: string | null; after: string | null }>({ before: null, after: null });

  useEffect(() => {
    if (!trade) return;
    setExit(trade.exit?.toString() ?? "");
    setGross(trade.gross_pnl?.toString() ?? "");
    setFees(trade.fees ? String(trade.fees) : "");
    setMistakes(trade.mistakes ?? []);
    setEmotions(trade.emotions ?? []);
    setReview(trade.review ?? "");
    setPaths({ before: trade.before_path, after: trade.after_path });
    setErr(null);
  }, [trade]);

  if (!trade) return null;
  const acct = accounts.find((a) => a.id === trade.account_id);
  const setup = setups.find((s) => s.id === trade.setup_id);

  // Suggested gross P&L from exit price (user can override with the platform figure)
  const ex = numOrNull(exit);
  const suggested =
    ex != null && trade.size
      ? (trade.direction === "long" ? ex - trade.entry : trade.entry - ex) * trade.size * (acct?.contract_size ?? 1)
      : null;

  async function upload(kind: "before" | "after", f: File) {
    const ext = f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : "jpg";
    const path = `${session.user.id}/${trade!.id}/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("screenshots").upload(path, f, { contentType: f.type, upsert: false });
    if (error) return setErr(error.message);
    const old = paths[kind];
    const { error: e2 } = await supabase.from("trades").update({ [`${kind}_path`]: path }).eq("id", trade!.id);
    if (e2) return setErr(e2.message);
    if (old) await supabase.storage.from("screenshots").remove([old]);
    setPaths((p) => ({ ...p, [kind]: path }));
    refresh();
  }

  async function save(close: boolean) {
    setBusy(true);
    setErr(null);
    const g = numOrNull(gross) ?? (close ? suggested : null);
    if (close && g == null) {
      setBusy(false);
      return setErr("Enter the realized P&L from your platform (or an exit price).");
    }
    const patch: Partial<Trade> = {
      exit: ex,
      gross_pnl: g != null ? Math.round(g * 100) / 100 : null,
      fees: numOrNull(fees) ?? 0,
      mistakes,
      emotions,
      review: review.trim() || null,
    };
    if (close) Object.assign(patch, { status: "closed", closed_at: trade!.closed_at ?? new Date().toISOString() });
    const { error } = await supabase.from("trades").update(patch).eq("id", trade!.id);
    setBusy(false);
    if (error) return setErr(error.message);
    await refresh();
    onClose();
  }

  async function setStatus(status: "cancelled" | "open") {
    const { error } = await supabase.from("trades").update({ status, closed_at: null }).eq("id", trade!.id);
    if (error) return setErr(error.message);
    await refresh();
    onClose();
  }

  async function remove() {
    if (!(await confirmDialog({ title: "Delete this trade?", body: "It is removed permanently, with its screenshots and share link.", danger: true }))) return;
    const files = [paths.before, paths.after].filter(Boolean) as string[];
    if (files.length) await supabase.storage.from("screenshots").remove(files);
    const { error } = await supabase.from("trades").delete().eq("id", trade!.id);
    if (error) return setErr(error.message);
    await refresh();
    onClose();
  }

  return (
    <Modal
      open={!!trade}
      onClose={onClose}
      title={`${trade.direction === "long" ? "Long" : "Short"} ${trade.instrument} · ${fmtIST(trade.opened_at)}`}
      footer={
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-2">
                  <button className="btn text-down hover:bg-down/10" onClick={remove}>Delete</button>
                  {trade.status === "open" && <button className="btn-ghost" onClick={() => setStatus("cancelled")}>Cancel order</button>}
                  {trade.status !== "open" && <button className="btn-ghost" onClick={() => setStatus("open")}>Reopen</button>}
                </div>
                <div className="flex gap-2">
                  <button className="btn-ghost" disabled={busy} onClick={() => save(false)}>Save notes</button>
                  {trade.status !== "cancelled" && (
                    <button className="btn-primary" disabled={busy} onClick={() => save(true)}>
                      {trade.status === "closed" ? "Update result" : "Close trade"}
                    </button>
                  )}
                </div>
              </div>
      }
    >
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Badge tone={trade.gate_score === 8 ? "up" : "warn"}>Gate {trade.gate_score}/8</Badge>
        <Badge>{acct?.name}</Badge>
        {setup && <Badge>{setup.name}</Badge>}
        {trade.session && <Badge>{trade.session}</Badge>}
        {trade.override_reason && <Badge tone="down">Override: {trade.override_reason}</Badge>}
        <Badge tone={trade.status === "closed" ? "accent" : "mute"}>{trade.status}</Badge>
      </div>

      <div className="num mb-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div><div className="label">Entry</div>{trade.entry}</div>
        <div><div className="label">SL / TP</div>{trade.sl} / {trade.tp}</div>
        <div><div className="label">Planned</div>{fmtR(trade.rr_planned)} · {fmtUsd(trade.risk_usd)}</div>
        <div><div className="label">Size</div>{trade.size ?? "—"}</div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5 text-[11px]">
        {GATE_CHECKS.map((g) => (
          <span key={g.key} className={trade[g.key] ? "text-up" : "text-mute line-through"}>{g.label}</span>
        ))}
      </div>

      <SharePanel key={`sh-${trade.id}`} trade={trade} />
      <div className="mb-4"><TradeDiagnosis key={trade.id + trade.status} trade={trade} /></div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Field label="Exit price"><input className="input num" inputMode="decimal" value={exit} onChange={(e) => setExit(e.target.value)} /></Field>
        <Field label="P&L $" hint={suggested != null && !gross ? `≈ ${fmtUsd(suggested, true)}` : "platform figure"}>
          <input className="input num" inputMode="decimal" value={gross} onChange={(e) => setGross(e.target.value)} placeholder={suggested?.toFixed(2)} />
        </Field>
        <Field label="Fees $"><input className="input num" inputMode="decimal" value={fees} onChange={(e) => setFees(e.target.value)} /></Field>
      </div>

      <div className="mt-4 space-y-3">
        <Field label="Mistakes"><Chips options={MISTAKES} value={mistakes} onChange={setMistakes} /></Field>
        <Field label="Emotions (overall)"><Chips options={ALL_FEELINGS} value={emotions} onChange={setEmotions} /></Field>
        <Field label="Review — what to repeat, what to fix">
          <textarea className="input min-h-20" maxLength={5000} value={review} onChange={(e) => setReview(e.target.value)} />
        </Field>
        <div className="-mt-1 flex justify-end">
          <VoiceButton
            size="sm"
            label="Dictate review"
            onInterim={(t) => setReview(t)}
            onText={async (t) => {
              setReview((r) => (r && !t.startsWith(r) ? `${r} ${t}` : t));
              const local = parseDictation(t, accounts);
              let f: Record<string, unknown> = { ...local };
              if (coach?.enabled) {
                const r = await askCoach("parse", { payload: { text: t, target: "journal" } });
                if (r.fields && typeof r.fields === "object") f = { ...f, ...(r.fields as Record<string, unknown>) };
              }
              if (Array.isArray(f.mistakes)) setMistakes((m) => [...new Set([...m, ...(f.mistakes as string[]).filter((x) => MISTAKES.includes(x))])]);
              if (Array.isArray(f.emotions)) setEmotions((m) => [...new Set([...m, ...(f.emotions as string[]).filter((x) => ALL_FEELINGS.includes(x))])]);
              if (typeof f.exit === "number" && !exit) setExit(String(f.exit));
              if (typeof f.gross_pnl === "number" && !gross) setGross(String(f.gross_pnl));
              if (typeof f.fees === "number" && !fees) setFees(String(f.fees));
            }}
          />
        </div>
        <EmotionTimeline key={`em-${trade.id}`} trade={trade} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Shot path={paths.before} label="Before" onUpload={(f) => upload("before", f)} />
        <Shot path={paths.after} label="After" onUpload={(f) => upload("after", f)} />
      </div>
      {trade.chart_url && (
        <a href={trade.chart_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-accent hover:underline">Open chart ↗</a>
      )}

      {err && <p className="mt-3 text-sm text-down">{err}</p>}

    </Modal>
  );
}
