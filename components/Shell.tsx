"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Account, DayPlan, Payout, Review, Setup, Trade } from "@/lib/types";

type Data = {
  session: Session;
  accounts: Account[];
  setups: Setup[];
  trades: Trade[];
  payouts: Payout[];
  reviews: Review[];
  plans: DayPlan[];
  refresh: () => Promise<void>;
};

const Ctx = createContext<Data | null>(null);
export function useData(): Data {
  const d = useContext(Ctx);
  if (!d) throw new Error("useData outside Shell");
  return d;
}

const NAV = [
  { href: "/", label: "Today", icon: "M3 12h4l3-8 4 16 3-8h4" },
  { href: "/plan", label: "Plan", icon: "M9 11l3 3 8-8M20 12v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h11" },
  { href: "/new", label: "New", icon: "M12 5v14M5 12h14" },
  { href: "/trades", label: "Trades", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/analytics", label: "Insights", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  { href: "/review", label: "Review", icon: "M5 4h14v16l-7-4-7 4z" },
  { href: "/accounts", label: "Accounts", icon: "M3 7h18v12H3zM3 11h18M7 15h3" },
];

function Icon({ d, className = "h-4 w-4" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={d} />
    </svg>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [data, setData] = useState<Omit<Data, "session" | "refresh"> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const refresh = useCallback(async () => {
    const [a, s, t, p, r, dp] = await Promise.all([
      supabase.from("accounts").select("*").order("created_at"),
      supabase.from("setups").select("*").order("created_at"),
      supabase.from("trades").select("*").order("opened_at", { ascending: false }).limit(5000),
      supabase.from("payouts").select("*").order("paid_at", { ascending: false }),
      supabase.from("reviews").select("*").order("week_start", { ascending: false }),
      supabase.from("day_plans").select("*").order("plan_date", { ascending: false }).limit(400),
    ]);
    const err = a.error || s.error || t.error || p.error || r.error || dp.error;
    if (err) return setError(err.message);
    setData({
      accounts: a.data as Account[],
      setups: s.data as Setup[],
      trades: t.data as Trade[],
      payouts: p.data as Payout[],
      reviews: r.data as Review[],
      plans: dp.data as DayPlan[],
    });
  }, []);

  useEffect(() => {
    if (session) refresh();
  }, [session, refresh]);

  if (pathname === "/login") return <>{children}</>;

  if (session === undefined) return <Splash text="Loading…" />;
  if (session === null) {
    if (typeof window !== "undefined") window.location.replace("/login");
    return <Splash text="Redirecting to sign in…" />;
  }
  if (error) return <Splash text={`Couldn't load data: ${error}`} />;
  if (!data) return <Splash text="Loading your journal…" />;

  if (data.accounts.length === 0) return <Onboard onDone={refresh} />;

  return (
    <Ctx.Provider value={{ session, refresh, ...data }}>
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-24 sm:px-6 md:pb-10">
        <header className="sticky top-0 z-20 -mx-4 flex items-center justify-between border-b border-line bg-bg/85 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-ink text-[13px] font-bold text-bg">A+</span>
            Tradeplay
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${pathname === n.href ? "bg-ink text-bg" : "text-mute hover:text-ink"}`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <button onClick={() => supabase.auth.signOut()} className="text-xs text-mute hover:text-ink">
            Sign out
          </button>
        </header>
        <main className="flex-1 pt-6">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-7 border-t border-line bg-panel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={`flex flex-col items-center gap-1 py-2.5 text-[10px] ${pathname === n.href ? "text-ink" : "text-mute"}`}>
            <Icon d={n.icon} className="h-5 w-5" />
            {n.label}
          </Link>
        ))}
      </nav>
    </Ctx.Provider>
  );
}

function Splash({ text }: { text: string }) {
  return <div className="grid min-h-screen place-items-center text-sm text-mute">{text}</div>;
}

function Onboard({ onDone }: { onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="card max-w-md p-6">
        <div className="label">Welcome</div>
        <h1 className="mt-1 text-xl font-semibold">Set up your accounts</h1>
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
