"use client";

import { getTimeZone } from "@/lib/tz";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { todayIST } from "@/lib/calc";
import type { Account, Adjustment, Checkin, DayPlan, Lesson, Memory, Payout, Reminder, Review, Setup, Trade } from "@/lib/types";
import { Logo, Mark } from "@/components/Brand";
import AskBar from "@/components/AskBar";
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

export function ThemeToggle({ compact = false, rail = false }: { compact?: boolean; rail?: boolean }) {
  const [theme, setTheme] = useTheme();
  const next: Theme = theme === "dark" ? "light" : theme === "light" ? "system" : "dark";
  const icon =
    theme === "dark" ? "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"
    : theme === "light" ? "M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z"
    : "M4 5h16v11H4zM8 20h8M12 16v4";
  return (
    <button onClick={() => setTheme(next)} className={rail ? "grid h-11 w-11 place-items-center rounded-[14px] text-[#9AA0AA] hover:bg-white/10 hover:text-white" : compact ? "grid h-10 w-10 place-items-center rounded-full bg-panel text-mute hover:text-ink" : "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-mute hover:bg-raised hover:text-ink"} aria-label={`Theme: ${theme}. Switch to ${next}`} title={`Theme: ${theme}`}>
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
  // Coming back to the app (PWA / tab switch): reload data, at most once a minute.
  useEffect(() => {
    let last = Date.now();
    const onVis = () => {
      if (document.visibilityState === "visible" && Date.now() - last > 60000 && session) {
        last = Date.now();
        refresh();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refresh, session]);

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
  const name = (session.user.user_metadata?.name as string | undefined)?.trim() || "";

  return (
    <Ctx.Provider value={value}>
      <div className="min-h-screen md:p-4">
        <div className="flex min-h-[calc(100vh-2rem)] gap-5">
          {/* Desktop: floating icon rail */}
          <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-[76px] shrink-0 flex-col items-center gap-1.5 rounded-[26px] bg-rail py-4 md:flex">
            <Link href="/" className="mb-4 grid h-11 w-11 place-items-center" aria-label="A+ TradePlay home">
              <Mark className="h-9 w-9" />
            </Link>
            <nav className="flex flex-col items-center gap-1.5" aria-label="Main">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-label={n.label}
                  className={`group relative grid h-11 w-11 place-items-center rounded-[14px] transition ${active(n.href) ? "bg-[#F3F4F6] text-[#0B0B0D]" : "text-[#9AA0AA] hover:bg-white/10 hover:text-white"}`}
                >
                  <Icon d={n.icon} className="h-5 w-5" />
                  <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg bg-solid px-2.5 py-1 text-xs font-medium text-solid-ink opacity-0 shadow-lg transition group-hover:opacity-100">{n.label}</span>
                </Link>
              ))}
            </nav>
            <div className="flex-1" />
            <RailButton label="Theme" onClick={() => {}}>
              <ThemeToggle compact rail />
            </RailButton>
            <button onClick={() => supabase.auth.signOut()} aria-label="Sign out" className="group relative grid h-11 w-11 place-items-center rounded-[14px] text-[#9AA0AA] hover:bg-white/10 hover:text-white">
              <Icon d="M15 4h4v16h-4M10 17l5-5-5-5M15 12H3" className="h-5 w-5" />
              <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg bg-solid px-2.5 py-1 text-xs font-medium text-solid-ink opacity-0 shadow-lg transition group-hover:opacity-100">Sign out</span>
            </button>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            {/* Top bar */}
            <header className="sticky top-0 z-20 flex items-center justify-between gap-3 bg-bg/85 px-4 pb-2.5 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl md:static md:bg-transparent md:px-2 md:py-1 md:backdrop-blur-none">
              <Link href="/" className="flex items-center gap-2 md:hidden">
                <Logo className="h-8 w-8" />
                <span className="text-[15px] font-semibold tracking-tight"><span className="text-accent">A+</span> TradePlay</span>
              </Link>
              <div className="hidden text-sm text-mute md:block">
                {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: getTimeZone() })}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setPalette(true)} className="hidden h-11 items-center gap-3 rounded-full bg-panel px-4 text-sm text-mute shadow-[var(--shadow)] hover:text-ink sm:flex" aria-label="Search and actions">
                  <Icon d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3" />
                  Search
                  <kbd className="num rounded-md bg-raised px-1.5 text-[10px]">⌘K</kbd>
                </button>
                <button onClick={() => setPalette(true)} className="grid h-10 w-10 place-items-center rounded-full bg-panel text-mute sm:hidden" aria-label="Search and actions">
                  <Icon d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3" />
                </button>
                <ReminderCenter compact />
                <ProfileButton name={name} email={session.user.email ?? ""} />
              </div>
            </header>
            <main className="pb-nav mx-auto w-full max-w-[1400px] flex-1 px-4 pt-3 sm:px-6 md:px-2 md:pb-28">{children}</main>
          </div>
        </div>
      </div>

      {pathname !== "/coach" && <AskBar hideOnPhone={["/new", "/plan", "/accounts"].some((p) => pathname.startsWith(p))} />}
      <PullToRefresh onRefresh={refresh} />

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 grid grid-cols-5 rounded-[22px] bg-rail px-1 shadow-2xl md:hidden" aria-label="Main">
        {NAV.filter((n) => MOBILE.includes(n.href)).map((n) => (
          <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined} className={`flex min-h-[60px] flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition active:scale-95 ${active(n.href) ? "text-white" : "text-[#9AA0AA]"}`}>
            {n.href === "/new" ? (
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[#F2C14E] text-[#141518] shadow-lg"><Icon d={n.icon} className="h-5 w-5" /></span>
            ) : (
              <span className={`grid h-8 w-12 place-items-center rounded-full transition ${active(n.href) ? "bg-white/15" : ""}`}><Icon d={n.icon} className="h-5 w-5" /></span>
            )}
            {n.href !== "/new" && n.label}
          </Link>
        ))}
        <button onClick={() => setMore((v) => !v)} className={`flex min-h-[60px] flex-col items-center justify-center gap-0.5 text-[10px] font-medium active:scale-95 ${more || NAV.some((n) => !MOBILE.includes(n.href) && active(n.href)) ? "text-white" : "text-[#9AA0AA]"}`} aria-expanded={more}>
          <span className={`grid h-8 w-12 place-items-center rounded-full ${more ? "bg-white/15" : ""}`}><Icon d="M4 6h16M4 12h16M4 18h16" className="h-5 w-5" /></span>
          More
        </button>
      </nav>
      {more && <div className="fixed inset-0 z-20 md:hidden" onClick={() => setMore(false)} aria-hidden />}
      {more && (
        <div className="sheet-in fixed inset-x-3 bottom-[calc(5.4rem+env(safe-area-inset-bottom))] z-30 card grid grid-cols-2 gap-1 p-2 shadow-2xl md:hidden">
          {NAV.filter((n) => !MOBILE.includes(n.href)).map((n) => (
            <Link key={n.href} href={n.href} className={`flex items-center gap-3 rounded-xl px-3 py-3.5 text-sm hover:bg-raised ${active(n.href) ? "bg-raised font-medium" : ""}`}>
              <Icon d={n.icon} /> {n.label}
            </Link>
          ))}
          <div className="col-span-2 px-0.5 [&>button]:py-3"><ThemeToggle /></div>
          <button onClick={() => supabase.auth.signOut()} className="col-span-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-mute hover:bg-raised">
            <Icon d="M15 4h4v16h-4M10 17l5-5-5-5M15 12H3" /> Sign out
          </button>
        </div>
      )}
      <CommandPalette open={palette} onClose={() => setPalette(false)} go={(href) => { setPalette(false); router.push(href); }} />
    </Ctx.Provider>
  );
}

/** Pull down at the top of the page to reload (touch screens). */
function PullToRefresh({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let y0: number | null = null;
    let dist = 0;
    const start = (e: TouchEvent) => {
      y0 = window.scrollY <= 0 && !document.body.style.overflow ? e.touches[0].clientY : null;
      dist = 0;
    };
    const move = (e: TouchEvent) => {
      if (y0 == null) return;
      dist = Math.max(0, e.touches[0].clientY - y0);
      setPull(Math.min(110, dist * 0.5));
    };
    const end = async () => {
      if (y0 != null && dist * 0.5 > 70) {
        setBusy(true);
        setPull(56);
        await onRefresh();
        setBusy(false);
      }
      y0 = null;
      setPull(0);
    };
    window.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", end);
    return () => {
      window.removeEventListener("touchstart", start);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", end);
    };
  }, [onRefresh]);
  if (!pull && !busy) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center md:hidden" style={{ transform: `translateY(${pull}px)` }}>
      <span className={`mt-2 grid h-9 w-9 place-items-center rounded-full bg-panel shadow-lg ${busy ? "animate-spin" : ""}`} style={{ transform: busy ? undefined : `rotate(${pull * 3}deg)` }}>
        <Icon d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" className={`h-4 w-4 ${pull > 70 || busy ? "text-chart" : "text-mute"}`} />
      </span>
    </div>
  );
}

function RailButton({ label, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <div className="group relative">
      {children}
      <span className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-solid px-2.5 py-1 text-xs font-medium text-solid-ink opacity-0 shadow-lg transition group-hover:opacity-100">{label}</span>
    </div>
  );
}

/** Avatar with your initial; click to set the name used in the greeting (stored in your auth profile). */
function ProfileButton({ name, email }: { name: string; email: string }) {
  const initial = (name || email || "A").trim().charAt(0).toUpperCase();
  return (
    <button
      className="grid h-10 w-10 place-items-center rounded-full bg-[#F2C14E] text-sm font-bold text-[#141518] sm:h-11 sm:w-11"
      title={name ? `${name} — click to rename` : "Set your name"}
      aria-label="Profile name"
      onClick={async () => {
        const v = window.prompt("What should the app call you?", name);
        if (v == null) return;
        await supabase.auth.updateUser({ data: { name: v.trim().slice(0, 40) } });
        await supabase.auth.refreshSession();
      }}
    >
      {initial}
    </button>
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
