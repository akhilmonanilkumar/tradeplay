"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar, AVATARS } from "@/components/Avatar";
import { Field, Modal } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { cleanHandle, SOCIALS, USERNAME_RE, type Profile, type Socials } from "@/lib/profile";
import { COMMON_ZONES, isValidTimeZone, setTimeZone, tzAbbr } from "@/lib/tz";

type Draft = Omit<Profile, "user_id" | "created_at">;

const blank = (tz: string): Draft => ({ username: null, display_name: null, avatar: "a1", bio: null, socials: {}, timezone: tz, is_public: false, on_leaderboard: false, show_usd: false });

function Toggle({ on, onChange, label, hint, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)} className="flex w-full items-center justify-between gap-3 rounded-xl px-1 py-2 text-left disabled:opacity-40">
      <span className="min-w-0">
        <span className="block text-sm">{label}</span>
        {hint && <span className="block text-xs text-mute">{hint}</span>}
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-chart" : "bg-line"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

/** View and edit your profile: avatar, names, socials, time zone, public page + leaderboard opt-in. */
export default function ProfileModal({ open, onClose, profile, email, ready, onSaved }: { open: boolean; onClose: () => void; profile: Profile | null; email: string; ready: boolean; onSaved: () => Promise<void> | void }) {
  const browserTz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "Asia/Kolkata";
  const [d, setD] = useState<Draft>(() => (profile ? { ...profile } : blank(browserTz)));
  const [uname, setUname] = useState<"idle" | "checking" | "ok" | "taken" | "invalid">("idle");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setD(profile ? { ...blank(browserTz), ...profile, socials: { ...(profile.socials ?? {}) } } : blank(browserTz));
      setErr(null);
      setSaved(false);
      setUname("idle");
    }
  }, [open, profile, browserTz]);

  // Debounced username availability check.
  useEffect(() => {
    const u = (d.username ?? "").trim().toLowerCase();
    if (!u || u === profile?.username) return setUname("idle");
    if (!USERNAME_RE.test(u)) return setUname("invalid");
    setUname("checking");
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc("username_available", { p_username: u });
      setUname(error ? "idle" : data ? "ok" : "taken");
    }, 400);
    return () => clearTimeout(t);
  }, [d.username, profile?.username]);

  const zones = useMemo(() => {
    const z = new Set([d.timezone, browserTz, ...COMMON_ZONES].filter(isValidTimeZone));
    return [...z];
  }, [d.timezone, browserTz]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const setSocial = (k: keyof Socials, v: string) => setD((x) => ({ ...x, socials: { ...x.socials, [k]: v } }));

  const publicUrl = profile?.username && typeof window !== "undefined" ? `${window.location.origin}/u/${profile.username}` : null;

  async function save() {
    setErr(null);
    const username = (d.username ?? "").trim().toLowerCase() || null;
    if (username && !USERNAME_RE.test(username)) return setErr("Username: 3–20 lowercase letters, numbers or _");
    if (uname === "taken") return setErr("That username is taken");
    if ((d.is_public || d.on_leaderboard) && !username) return setErr("Pick a username to get a public page");
    if (!isValidTimeZone(d.timezone)) return setErr("Unknown time zone");
    const socials: Socials = {};
    for (const s of SOCIALS) {
      const v = cleanHandle(s.key, d.socials[s.key] ?? "");
      if (v) socials[s.key] = v;
    }
    setBusy(true);
    const row = {
      username,
      display_name: d.display_name?.trim().slice(0, 40) || null,
      avatar: d.avatar,
      bio: d.bio?.trim().slice(0, 280) || null,
      socials,
      timezone: d.timezone,
      is_public: d.is_public,
      on_leaderboard: d.is_public && d.on_leaderboard,
      show_usd: d.show_usd,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("profiles").upsert(row, { onConflict: "user_id" });
    if (error) {
      setBusy(false);
      return setErr(/duplicate|unique/i.test(error.message) ? "That username is taken" : error.message);
    }
    // Keep the greeting name in sync for older screens.
    if (row.display_name) await supabase.auth.updateUser({ data: { name: row.display_name } });
    setTimeZone(row.timezone);
    await onSaved();
    setBusy(false);
    setSaved(true);
    setTimeout(onClose, 500);
  }

  const unameHint =
    uname === "checking" ? "Checking…" : uname === "ok" ? "✓ Available" : uname === "taken" ? "Taken — try another" : uname === "invalid" ? "3–20 lowercase letters, numbers or _" : d.username ? `tradeplay.cloud/u/${d.username}` : "Used for your public page and leaderboard";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Your profile"
      footer={
        <div className="flex items-center justify-between gap-2">
          <button className="btn-ghost h-10 min-h-0 px-3 text-sm" onClick={() => supabase.auth.signOut()}>Sign out</button>
          <div className="flex items-center gap-2">
            {err && <span className="hidden text-xs text-down sm:inline">{err}</span>}
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={busy || !ready || uname === "taken" || uname === "invalid"}>{saved ? "Saved" : busy ? "Saving…" : "Save"}</button>
          </div>
        </div>
      }
    >
      {!ready && (
        <p className="mb-4 rounded-xl border border-warn/30 bg-warn/10 p-3 text-xs text-warn">Profiles need database update 0006. Run it in the Supabase SQL editor, then reload.</p>
      )}
      <div className="flex items-center gap-4">
        <Avatar id={d.avatar} size={64} />
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold">{d.display_name || (d.username ? `@${d.username}` : "Trader")}</div>
          <div className="truncate text-xs text-mute">{email}</div>
        </div>
      </div>

      <div className="label mb-2 mt-5">Avatar</div>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
        {AVATARS.map((a) => (
          <button key={a.id} type="button" onClick={() => set("avatar", a.id)} className={`grid aspect-square place-items-center rounded-full p-0.5 transition ${d.avatar === a.id ? "ring-2 ring-chart ring-offset-2 ring-offset-[rgb(var(--panel))]" : "opacity-80 hover:opacity-100"}`} aria-label={a.name} aria-pressed={d.avatar === a.id} title={a.name}>
            <Avatar id={a.id} size={40} />
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Field label="Display name"><input className="input" maxLength={40} value={d.display_name ?? ""} onChange={(e) => set("display_name", e.target.value)} placeholder="How we greet you" /></Field>
        <Field label="Username" hint={<span className={uname === "ok" ? "text-up" : uname === "taken" || uname === "invalid" ? "text-down" : ""}>{unameHint}</span>}>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-mute">@</span>
            <input className="input pl-7" maxLength={20} autoCapitalize="none" spellCheck={false} value={d.username ?? ""} onChange={(e) => set("username", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} placeholder="nickname" />
          </div>
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Bio"><textarea className="input min-h-16" maxLength={280} value={d.bio ?? ""} onChange={(e) => set("bio", e.target.value)} placeholder="Gold & BTC intraday · SMC · London/NY" /></Field>
      </div>

      <div className="mt-3">
        <Field label="Time zone" hint={`Every time in the app is shown in ${tzAbbr(new Date(), d.timezone)}. Your browser is on ${browserTz}.`}>
          <select className="input" value={d.timezone} onChange={(e) => set("timezone", e.target.value)}>
            {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")} ({tzAbbr(new Date(), z)})</option>)}
          </select>
        </Field>
      </div>

      <div className="label mb-2 mt-5">Social handles</div>
      <div className="grid gap-2 sm:grid-cols-2">
        {SOCIALS.map((s) => (
          <label key={s.key} className="flex items-center gap-2 rounded-xl border border-line bg-raised/40 px-3">
            <span className="w-24 shrink-0 text-xs text-mute">{s.label}</span>
            <input className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" value={d.socials[s.key] ?? ""} onChange={(e) => setSocial(s.key, e.target.value)} placeholder={`${s.prefix}${s.placeholder}`} autoCapitalize="none" spellCheck={false} />
          </label>
        ))}
      </div>

      <div className="label mb-1 mt-5">Sharing</div>
      <div className="divide-y divide-line rounded-2xl border border-line px-3">
        <Toggle on={d.is_public} onChange={(v) => setD((x) => ({ ...x, is_public: v, on_leaderboard: v ? x.on_leaderboard : false }))} label="Public profile" hint="A read-only page with your verified stats in R. Journal notes, accounts and balances stay private." />
        <Toggle on={d.on_leaderboard} disabled={!d.is_public} onChange={(v) => set("on_leaderboard", v)} label="Show me on the leaderboard" hint="Ranked by total R. Needs at least 5 closed trades in the period." />
        <Toggle on={d.show_usd} onChange={(v) => set("show_usd", v)} label="Show $ P&L publicly" hint="Off: public pages and shared trades show R only." />
      </div>
      {publicUrl && profile?.is_public && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-raised px-3 py-2 text-xs">
          <a href={publicUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-accent">{publicUrl.replace(/^https?:\/\//, "")}</a>
          <button className="shrink-0 text-mute hover:text-ink" onClick={async () => { await navigator.clipboard?.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "Copied" : "Copy"}</button>
        </div>
      )}
      {err && <p className="mt-3 text-sm text-down sm:hidden">{err}</p>}
    </Modal>
  );
}
