import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import PublicFrame, { VerifiedBadge } from "@/components/PublicFrame";
import { SOCIALS } from "@/lib/profile";
import { fmtRs, pct, rpcAnon, type PublicProfile, type PublicStats } from "@/lib/publicApi";

type Props = { params: Promise<{ username: string }> };

async function load(username: string) {
  if (!/^[a-z0-9_]{3,20}$/i.test(username)) return null;
  return rpcAnon<PublicProfile | null>("public_profile", { p_username: username.toLowerCase() });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await load((await params).username);
  if (!p) return { title: "Trader not found" };
  const name = p.display_name || `@${p.username}`;
  const desc = `${p.stats.trades} trades · ${fmtRs(p.stats.total_r)} · win rate ${pct(p.stats.win_rate)} · ${pct(p.stats.live_logged)} logged live. Verified journal on A+ TradePlay.`;
  return { title: `${name} — trading stats`, description: desc, openGraph: { title: `${name} on A+ TradePlay`, description: desc }, twitter: { card: "summary_large_image", title: `${name} on A+ TradePlay`, description: desc } };
}

function Curve({ points }: { points: { t: string; r: number }[] }) {
  if (points.length < 2) return <div className="grid h-40 place-items-center text-sm text-mute">Not enough trades yet</div>;
  const W = 640, H = 160, P = 8;
  const ys = points.map((p) => p.r);
  const min = Math.min(0, ...ys), max = Math.max(0, ...ys);
  const x = (i: number) => P + (i / (points.length - 1)) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - min) / (max - min || 1)) * (H - 2 * P);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.r).toFixed(1)}`).join(" ");
  const up = ys[ys.length - 1] >= 0;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full" preserveAspectRatio="none" role="img" aria-label="Cumulative R">
      <defs>
        <linearGradient id="pc" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={up ? "rgb(var(--up))" : "rgb(var(--down))"} stopOpacity=".25" />
          <stop offset="1" stopColor={up ? "rgb(var(--up))" : "rgb(var(--down))"} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1={P} x2={W - P} y1={y(0)} y2={y(0)} stroke="rgb(var(--line))" strokeDasharray="4 4" />
      <path d={`${d} L${x(points.length - 1)},${H - P} L${x(0)},${H - P} Z`} fill="url(#pc)" />
      <path d={d} fill="none" stroke={up ? "rgb(var(--up))" : "rgb(var(--down))"} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

function Stats({ s, usd }: { s: PublicStats; usd: boolean }) {
  const items = [
    { k: "Total", v: fmtRs(s.total_r), tone: s.total_r > 0 ? "text-up" : s.total_r < 0 ? "text-down" : "" },
    { k: "Trades", v: String(s.trades) },
    { k: "Win rate", v: pct(s.win_rate) },
    { k: "Avg / trade", v: fmtRs(s.avg_r) },
    { k: "Profit factor", v: s.profit_factor == null ? "—" : s.profit_factor.toFixed(2) },
    { k: "A+ rate", v: pct(s.aplus_rate) },
    { k: "Logged live", v: pct(s.live_logged) },
    usd && s.net != null ? { k: "Net P&L", v: `${s.net >= 0 ? "+" : "−"}$${Math.abs(s.net).toLocaleString("en-US", { maximumFractionDigits: 0 })}`, tone: s.net >= 0 ? "text-up" : "text-down" } : { k: "Best trade", v: fmtRs(s.best_r) },
  ];
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
      {items.map((x) => (
        <div key={x.k} className="bg-panel px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-mute">{x.k}</div>
          <div className={`num mt-1 text-xl font-semibold ${x.tone ?? ""}`}>{x.v}</div>
        </div>
      ))}
    </div>
  );
}

export default async function PublicProfilePage({ params }: Props) {
  const p = await load((await params).username);
  if (!p) notFound();
  const name = p.display_name || `@${p.username}`;
  const socials = SOCIALS.filter((s) => p.socials?.[s.key]);
  return (
    <PublicFrame>
      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar id={p.avatar} size={72} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
              <VerifiedBadge />
            </div>
            <div className="text-sm text-mute">@{p.username} · trading since {new Date(p.joined).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</div>
            {p.bio && <p className="mt-2 max-w-xl text-sm">{p.bio}</p>}
          </div>
        </div>
        {socials.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {socials.map((s) => (
              <a key={s.key} href={s.url(p.socials[s.key])} target="_blank" rel="noopener noreferrer nofollow" className="chip h-8 px-3 text-xs hover:text-ink">
                {s.label}: {s.prefix}{p.socials[s.key]}
              </a>
            ))}
          </div>
        )}
      </section>

      <h2 className="mb-2 mt-6 text-sm font-semibold">All time</h2>
      <Stats s={p.stats} usd={p.show_usd} />
      <h2 className="mb-2 mt-6 text-sm font-semibold">Last 30 days</h2>
      <Stats s={p.stats_30d} usd={p.show_usd} />

      <section className="card mt-6 p-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Equity curve (cumulative R)</h2>
          <span className="num text-sm">{fmtRs(p.stats.total_r)}</span>
        </div>
        <Curve points={p.curve} />
      </section>

      {p.months.length > 0 && (
        <section className="card mt-6 p-5">
          <h2 className="mb-3 text-sm font-semibold">Monthly</h2>
          <ul className="divide-y divide-line">
            {p.months.map((m) => (
              <li key={m.m} className="num flex items-center justify-between py-2 text-sm">
                <span>{new Date(`${m.m}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}</span>
                <span className="text-mute">{m.n} trades</span>
                <span className={m.r > 0 ? "text-up" : m.r < 0 ? "text-down" : ""}>{fmtRs(m.r)}{m.net != null ? ` · ${m.net >= 0 ? "+" : "−"}$${Math.abs(m.net).toLocaleString("en-US", { maximumFractionDigits: 0 })}` : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="mt-6 text-center text-sm"><Link href="/leaderboard" className="text-accent">See the leaderboard →</Link></p>
    </PublicFrame>
  );
}
