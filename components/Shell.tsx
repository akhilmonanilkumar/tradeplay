"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { todayIST } from "@/lib/calc";
import type { Account, Adjustment, Checkin, DayPlan, Lesson, Memory, Payout, Reminder, Review, Setup, Trade } from "@/lib/types";
import { Logo } from "@/components/Brand";
import CommandPalette from "@/components/CommandPalette";
import ReminderCenter from "@/components/Reminders";

type Data = {
  session: Session;
  accounts: Account[];
  setups: Setup[];
  trades: Trade[];
  payouts: Payout[];
  reviews: Review[];
  plans: DayPlan[];
  adjustments: Adjustment[];
  lessons: Lesson[];
  reminders: Reminder[];
  memory: Memory[];
  checkins: Checkin[];
  /** False until migration 0005 is applied — coach/lessons/reminders UI shows a notice instead. */
  coachDb: boolean;
  refresh: () => Promise<void>;
  /** Today's (IST) plan for an account, if written. */
  todayPlan: (accountId: string) => DayPlan | null;
};

const Ctx = createContext<Data | null>(null);
export function useData(): Data {
  const d = useContext(Ctx);
  if (!d) throw new Error("useData outside Shell");
  return d;
}

export const NAV = [
  { href: "/", label: "Today", icon: "M3 12h4l3-8 4 16 3-8h4" },
  { href: "/plan", label: "Plan", icon: "M9 11l3 3 8-8M20 12v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h11" },
  { href: "/new", label: "New trade", icon: "M12 5v14M5 12h14" },
  { href: "/trades", label: "Trades", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/analytics", label: "Insights", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  { href: "/coach", label: "Coach", icon: "M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" },
  { href: "/review", label: "Review", icon: "M5 4h14v16l-7-4-7 4z" },
  { href: "/accounts", label: "Accounts", icon: "M3 7h18v12H3zM3 11h18M7 15h3" },
];
const MOBILE = ["/", "/plan", "/new", "/coach"];

export function Icon({ d, className = "h-4 w-4" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={d} />
    </svg>
  );
}

/* ---------- theme (cookie so the server renders the right palette) ---------- */

export type Theme = "dark" | "light" | "system";
export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, set] = useState<Theme>("dark");
  useEffect(() => {
    const t = document.documentElement.dataset.theme as Theme | undefined;
    if (t) set(t);
  }, []);
  const apply = useCallback((t: Theme) => {
    document.documentElement.dataset.theme = t;
    document.cookie = `theme=${t}; path=/; max-age=31536000; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
    set(t);
  }, []);
  return [theme, apply];
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useTheme();
  const next: Theme = theme === "dark" ? "light" : theme === "light" ? "system" : "dark";
  const icon =
    theme === "dark" ? "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"
    : theme === "light" ? "M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z"
    : "M4 5h16v11H4zM8 20h8M12 16v4";
  return (
    <button onClick={() => setTheme(next)} className={compact ? "grid h-9 w-9 place-items-center rounded-lg text-mute hover:bg-raised hover:text-ink" : "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-mute hover:bg-raised hover:text-ink"} aria-label={`Theme: ${theme}. Switch to ${next}`} title={`Theme: ${theme}`}>
      <Icon d={icon} />
      {!compact && <span className="capitalize">{theme} theme</span>}
    </button>
  );
}

/* ---------- loading ---------- */

const missingTable = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|could not find the table/i.test(e.message ?? ""));

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [data, setData] = useState<Omit<Data, "session" | "refresh" | "todayPlan"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [palette, setPalette] = useState(false);
  const [more, setMore] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const refresh = useCallback(async () => {
    const [a, s, t, p, r, dp, adj, les, rem, mem, ci] = await Promise.all([
      supabase.from("accounts").select("*").order("created_at"),
      supabase.from("setups").select("*").order("created_at"),
      supabase.from("trades").select("*").order("opened_at", { ascending: false }).limit(5000),
      supabase.from("payouts").select("*").order("paid_at", { ascending: false }),
      supabase.from("reviews").select("*").order("week_start", { ascending: false }),
      supabase.from("day_plans").select("*").order("plan_date", { ascending: false }).limit(400),
      supabase.from("balance_adjustments").select("*").order("at", { ascending: false }),
      supabase.from("lessons").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("reminders").select("*").order("due_at").limit(500),
      supabase.from("ai_memory").select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("checkins").select("*").order("checkin_date", { ascending: false }).limit(400),
    ]);
    const err = a.error || s.error || t.error || p.error || r.error || dp.error;
    if (err) return setError(err.message);
    const optional = [adj, les, rem, mem, ci];
    const coachDb = !optional.some((x) => missingTable(x.error));
    const hardErr = optional.find((x) => x.error && !missingTable(x.error))?.error;
    if (hardErr) return setError(hardErr.message);
    setData({
      accounts: a.data as Account[],
      setups: s.data as Setup[],
      trades: t.data as Trade[],
      payouts: p.data as Payout[],
      reviews: r.data as Review[],
      plans: dp.data as DayPlan[],
      adjustments: (adj.data ?? []) as Adjustment[],
      lessons: (les.data ?? []) as Lesson[],
      reminders: (rem.data ?? []) as Reminder[],
      memory: (mem.data ?? []) as Memory[],
      checkins: (ci.data ?? []) as Checkin[],
      coachDb,
    });
  }, []);

  useEffect(() => {
    if (session) refresh();
  }, [session, refresh]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => setMore(false), [pathname]);

  const todayPlan = useCallback(
    (accountId: string) => data?.plans.find((p) => p.account_id === accountId && p.plan_date === todayIST()) ?? null,
    [data?.plans],
  );
  const value = useMemo(() => (data && session ? { session, refresh, todayPlan, ...data } : null), [data, session, refresh, todayPlan]);

  if (pathname === "/login") return <>{children}</>;

  if (session === undefined) return <Splash text="Loading…" />;
  if (session === null) {
    if (typeof window !== "undefined") window.location.replace("/login");
    return <Splash text="Redirecting to sign in…" />;
  }
  if (error) return <Splash text={`Couldn't load data: ${error}`} />;
  if (!data || !value) return <Splash text="Loading your journal…" />;

  if (data.accounts.length === 0) return <Onboard onDone={refresh} />;

  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <Ctx.Provider value={value}>
      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-panel/60 px-3 py-4 md:flex">
          <Link href="/" className="mb-5 flex items-center gap-2.5 px-2">
            <Logo className="h-8 w-8" />
            <span className="font-semibold tracking-tight"><span className="text-accent">A+</span> TradePlay</span>
          </Link>
          <nav className="flex flex-col gap-0.5" aria-label="Main">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition ${active(n.href) ? "bg-raised font-medium text-ink" : "text-mute hover:bg-raised/60 hover:text-ink"}`}
              >
                <Icon d={n.icon} className={`h-4 w-4 ${active(n.href) && n.href === "/coach" ? "text-accent" : ""}`} />
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex-1" />
          <button onClick={() => setPalette(true)} className="mb-2 flex items-center justify-between rounded-lg border border-line px-2.5 py-2 text-xs text-mute hover:text-ink">
            <span>Search &amp; actions</span>
            <kbd className="num rounded border border-line px-1.5 text-[10px]">⌘K</kbd>
          </button>
          <ThemeToggle />
          <button onClick={() => supabase.auth.signOut()} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-mute hover:bg-raised hover:text-ink">
            <Icon d="M15 4h4v16h-4M10 17l5-5-5-5M15 12H3" /> Sign out
          </button>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile header */}
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-bg/85 px-4 py-2.5 backdrop-blur md:hidden">
            <Link href="/" className="flex items-center gap-2">
              <Logo className="h-7 w-7" />
              <span className="text-[15px] font-semibold tracking-tight"><span className="text-accent">A+</span> TradePlay</span>
            </Link>
            <div className="flex items-center gap-1">
              <ReminderCenter compact />
              <button onClick={() => setPalette(true)} className="grid h-9 w-9 place-items-center rounded-lg text-mute hover:bg-raised" aria-label="Search and actions">
                <Icon d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3" />
              </button>
              <ThemeToggle compact />
            </div>
          </header>
          <div className="hidden justify-end px-8 pt-4 md:flex">
            <ReminderCenter />
          </div>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-5 sm:px-6 md:px-8 md:pb-12 md:pt-2">{children}</main>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-panel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Main">
        {NAV.filter((n) => MOBILE.includes(n.href)).map((n) => (
          <Link key={n.href} href={n.href} className={`flex flex-col items-center gap-1 py-2.5 text-[10px] ${active(n.href) ? "text-ink" : "text-mute"}`}>
            {n.href === "/new" ? (
              <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-accent-ink"><Icon d={n.icon} className="h-4 w-4" /></span>
            ) : (
              <Icon d={n.icon} className={`h-5 w-5 ${n.href === "/coach" && active(n.href) ? "text-accent" : ""}`} />
            )}
            {n.label.replace(" trade", "")}
          </Link>
        ))}
        <button onClick={() => setMore((v) => !v)} className={`flex flex-col items-center gap-1 py-2.5 text-[10px] ${more ? "text-ink" : "text-mute"}`} aria-expanded={more}>
          <Icon d="M4 6h16M4 12h16M4 18h16" className="h-5 w-5" />
          More
        </button>
      </nav>
      {more && (
        <div className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 card p-2 shadow-2xl md:hidden">
          {NAV.filter((n) => !MOBILE.includes(n.href)).map((n) => (
            <Link key={n.href} href={n.href} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm hover:bg-raised">
              <Icon d={n.icon} /> {n.label}
            </Link>
          ))}
          <button onClick={() => supabase.auth.signOut()} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-mute hover:bg-raised">
            <Icon d="M15 4h4v16h-4M10 17l5-5-5-5M15 12H3" /> Sign out
          </button>
        </div>
      )}
      <CommandPalette open={palette} onClose={() => setPalette(false)} go={(href) => { setPalette(false); router.push(href); }} />
    </Ctx.Provider>
  );
}

function Splash({ text }: { text: string }) {
  return (
    <div className="grid min-h-screen place-items-center">
      <div className="flex flex-col items-center gap-4 text-sm text-mute">
        <Logo className="h-12 w-12 animate-pulse" />
        {text}
      </div>
    </div>
  );
}

function Onboard({ onDone }: { onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="card max-w-md p-6">
        <Logo className="h-10 w-10" />
        <h1 className="mt-4 text-xl font-semibold">Set up your accounts</h1>
        <p className="mt-2 text-sm text-mute">
          Loads your two accounts with their firm rules and risk ladders. You can edit everything later under Accounts.
        </p>
        <ul className="mt-4 space-y-1 text-sm">
          <li>• FundedHive 25K PFP — XAUUSD, $125 risk/trade</li>
          <li>• Breakout 5K Funded — BTCUSDT.P, $25 risk/trade</li>
          <li>• Setups: Market Shift, Flip Zone, Sweep → OB → FVG</li>
        </ul>
        {err && <p className="mt-3 text-sm text-down">{err}</p>}
        <button
          className="btn-primary mt-5 w-full"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const { error } = await supabase.rpc("seed_my_defaults");
            if (error) setErr(error.message);
            await onDone();
            setBusy(false);
          }}
        >
          {busy ? "Setting up…" : "Load my accounts"}
        </button>
      </div>
    </div>
  );
}
