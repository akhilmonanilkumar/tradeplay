import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import PublicFrame from "@/components/PublicFrame";
import { fmtRs, pct, rpcAnon, type LeaderRow } from "@/lib/publicApi";

export const metadata: Metadata = { title: "Leaderboard", description: "Traders ranked by total R from their verified A+ TradePlay journals." };

const PERIODS = [
  { v: "7d", label: "7 days" },
  { v: "30d", label: "30 days" },
  { v: "90d", label: "90 days" },
  { v: "all", label: "All time" },
];

export default async function Leaderboard({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const sp = await searchParams;
  const period = PERIODS.some((x) => x.v === sp.p) ? sp.p! : "30d";
  const rows = (await rpcAnon<LeaderRow[]>("leaderboard", { p_period: period, p_limit: 100 }, 120)) ?? [];
  return (
    <PublicFrame>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Leaderboard</h1>
          <p className="mt-1 text-sm text-mute">Ranked by total R from verified journals. Opt-in only · at least 5 closed trades in the period.</p>
        </div>
        <nav className="inline-flex rounded-xl border border-line p-1 text-xs" aria-label="Period">
          {PERIODS.map((x) => (
            <Link key={x.v} href={`/leaderboard?p=${x.v}`} className={`rounded-lg px-3 py-1.5 ${x.v === period ? "bg-ink text-bg" : "text-mute hover:text-ink"}`} aria-current={x.v === period ? "page" : undefined}>
              {x.label}
            </Link>
          ))}
        </nav>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-10 text-center text-sm text-mute">
          No ranked traders yet for this period. Turn on <b className="text-ink">Public profile</b> and <b className="text-ink">Leaderboard</b> in your profile to appear here.
        </div>
      ) : (
        <ol className="card divide-y divide-line overflow-hidden p-0">
          {rows.map((r) => (
            <li key={r.username}>
              <Link href={`/u/${r.username}`} className="flex items-center gap-3 px-4 py-3 hover:bg-raised sm:gap-4 sm:px-5">
                <span className={`num grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold ${r.rank === 1 ? "bg-[#F2C14E] text-[#141518]" : r.rank === 2 ? "bg-[#C7CBD2] text-[#141518]" : r.rank === 3 ? "bg-[#D59A6A] text-[#141518]" : "bg-raised text-mute"}`}>{r.rank}</span>
                <Avatar id={r.avatar} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.display_name || `@${r.username}`}</span>
                  <span className="num block text-xs text-mute">{r.trades} trades · win {pct(r.win_rate)} · A+ {pct(r.aplus_rate)}<span className="hidden sm:inline"> · live {pct(r.live_logged)}</span></span>
                </span>
                <span className="text-right">
                  <span className={`num block text-base font-semibold ${r.total_r > 0 ? "text-up" : r.total_r < 0 ? "text-down" : ""}`}>{fmtRs(r.total_r)}</span>
                  <span className="num block text-[11px] text-mute">{fmtRs(r.avg_r)} avg</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </PublicFrame>
  );
}
