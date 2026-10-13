"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { Account, CoachAction } from "./types";
import { todayIST } from "./calc";

export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return fetch(path, { ...init, headers: { ...(init.headers ?? {}), ...(token ? { authorization: `Bearer ${token}` } : {}) } });
}

export type CoachStatus = { enabled: boolean; models: { id: string; label: string }[]; stt: boolean; webSearch: boolean; openrouter?: boolean };
let statusCache: Promise<CoachStatus> | null = null;

export function coachStatus(): Promise<CoachStatus> {
  statusCache ??= authedFetch("/api/ai")
    .then((r) => (r.ok ? r.json() : { enabled: false, models: [], stt: false, webSearch: false }))
    .catch(() => ({ enabled: false, models: [], stt: false, webSearch: false }));
  return statusCache;
}

export function useCoachStatus(): CoachStatus | null {
  const [s, set] = useState<CoachStatus | null>(null);
  useEffect(() => {
    let live = true;
    coachStatus().then((x) => live && set(x));
    return () => {
      live = false;
    };
  }, []);
  return s;
}

const MODEL_KEY = "aplus.model";
export function preferredModel(): string | undefined {
  try {
    return localStorage.getItem(MODEL_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}
export function setPreferredModel(id: string) {
  try {
    localStorage.setItem(MODEL_KEY, id);
  } catch {}
  window.dispatchEvent(new CustomEvent("aplus:model", { detail: id }));
}

export type CoachResult = Record<string, unknown> & { reply?: string; actions?: CoachAction[]; error?: string; setup?: boolean; model?: string; thread_id?: string; cached?: boolean };

export async function askCoach(
  task: "chat" | "brief" | "outlook" | "precheck" | "manage" | "analyze" | "parse" | "review",
  opts: { message?: string; thread_id?: string | null; payload?: Record<string, unknown>; research?: boolean; refresh?: boolean } = {},
): Promise<CoachResult> {
  try {
    const r = await authedFetch("/api/ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task, model: preferredModel(), ...opts }),
    });
    const j = (await r.json().catch(() => ({}))) as CoachResult;
    if (!r.ok) return { ...j, error: j.error ?? `Coach unavailable (${r.status})` };
    return j;
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** Resolve "fh", an id, an account name or an instrument mention to an account. */
export function resolveAccount(accounts: Account[], ref?: string | null): Account | null {
  if (!ref) return accounts.filter((a) => a.status === "active").length === 1 ? accounts.find((a) => a.status === "active")! : null;
  const r = ref.toLowerCase();
  return (
    accounts.find((a) => a.id === ref) ??
    accounts.find((a) => a.name.toLowerCase() === r) ??
    accounts.find((a) => a.name.toLowerCase().includes(r) || r.includes(a.name.toLowerCase()) || (a.firm ?? "").toLowerCase() === r) ??
    accounts.find((a) => (/xau|gold/.test(r) && /XAU/i.test(a.instrument)) || (/btc|bitcoin/.test(r) && /BTC/i.test(a.instrument))) ??
    null
  );
}

export function describeAction(a: CoachAction): string {
  switch (a.type) {
    case "save_plan": return `Save to today's plan${a.account ? ` (${a.account})` : ""}: ${Object.keys(a.fields ?? {}).join(", ")}`;
    case "add_reminder": return `Remind me ${new Date(a.due_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}: ${a.text}`;
    case "remember": return `Remember: ${a.content}`;
    case "add_lesson": return `Save lesson: ${a.title}`;
    case "draft_trade": return "Open as a new trade draft";
  }
}

/** Apply a coach-proposed action with the user's own session (RLS applies). Returns an error message or null. */
export async function applyAction(a: CoachAction, accounts: Account[], go?: (href: string) => void): Promise<string | null> {
  switch (a.type) {
    case "save_plan": {
      const acct = resolveAccount(accounts, a.account);
      if (!acct) return "Which account? Open Plan and pick it.";
      const allowed = ["bias", "htf_range", "magnet", "invalidation", "pois", "notes", "news_times", "sessions", "custom_window"] as const;
      const fields: Record<string, unknown> = {};
      for (const k of allowed) if (a.fields?.[k] !== undefined) fields[k] = a.fields[k];
      const { data: existing } = await supabase.from("day_plans").select("*").eq("account_id", acct.id).eq("plan_date", todayIST()).maybeSingle();
      if (existing?.notes && fields.notes) fields.notes = `${existing.notes}\n${fields.notes}`;
      if (existing?.news_times && Array.isArray(fields.news_times)) fields.news_times = [...new Set([...existing.news_times, ...(fields.news_times as string[])])].slice(0, 12);
      const { error } = await supabase.from("day_plans").upsert({ account_id: acct.id, plan_date: todayIST(), ...fields }, { onConflict: "account_id,plan_date" });
      return error?.message ?? null;
    }
    case "add_reminder": {
      const due = new Date(a.due_at);
      if (isNaN(due.getTime())) return "Invalid reminder time";
      const acct = resolveAccount(accounts, a.account ?? null);
      const { error } = await supabase.from("reminders").insert({ text: a.text.slice(0, 300), due_at: due.toISOString(), source: "ai", account_id: a.account ? acct?.id ?? null : null });
      return error?.message ?? null;
    }
    case "remember": {
      const kind = ["fact", "preference", "goal", "rule"].includes(a.kind ?? "") ? a.kind : "fact";
      const { error } = await supabase.from("ai_memory").insert({ content: a.content.slice(0, 1000), kind });
      return error?.message ?? null;
    }
    case "add_lesson": {
      const acct = a.account ? resolveAccount(accounts, a.account) : null;
      const { error } = await supabase.from("lessons").insert({
        title: a.title.slice(0, 200), rule: a.rule?.slice(0, 500) ?? null, cause: a.cause?.slice(0, 2000) ?? null,
        account_id: acct?.id ?? null, instrument: acct?.instrument ?? null, kind: "rule", source: "ai",
      });
      return error?.message ?? null;
    }
    case "draft_trade": {
      const acct = resolveAccount(accounts, a.account ?? null);
      const draft = { ...(a.fields ?? {}), account_id: acct?.id };
      go?.(`/new?draft=${encodeURIComponent(JSON.stringify(draft))}`);
      return null;
    }
  }
}
