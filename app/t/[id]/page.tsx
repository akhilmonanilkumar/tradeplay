import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import PublicFrame, { VerifiedBadge } from "@/components/PublicFrame";
import { fmtRs, rpcAnon, UUID_RE, type PublicTrade } from "@/lib/publicApi";

type Props = { params: Promise<{ id: string }> };

async function load(id: string) {
  if (!UUID_RE.test(id)) return null;
  return rpcAnon<PublicTrade | null>("public_trade", { p_share: id }, 30);
}

const title = (t: PublicTrade) => `${t.direction === "long" ? "Long" : "Short"} ${t.instrument} · ${t.status === "closed" ? fmtRs(t.r_multiple) : t.status === "open" ? "live" : "cancelled"}`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await load((await params).id);
  if (!t) return { title: "Trade not found" };
  const by = t.trader ? ` by ${t.trader.display_name || `@${t.trader.username}`}` : "";
  const desc = `${title(t)}${by} — planned 1:${t.rr_planned ?? "—"}, A+ gate ${t.gate_score}/8${t.live_logged ? ", logged live" : ""}. Verified journal on A+ TradePlay.`;
  return { title: title(t), description: desc, openGraph: { title: `${title(t)}${by}`, description: desc }, twitter: { card: "summary_large_image", title: `${title(t)}${by}`, description: desc } };
}

export default async function SharedTrade({ params }: Props) {
  const t = await load((await params).id);
  if (!t) notFound();
  const win = (t.r_multiple ?? 0) > 0;
  const tone = t.status !== "closed" ? "" : win ? "text-up" : (t.r_multiple ?? 0) < 0 ? "text-down" : "";
  const fmt = (n: number | null) => (n == null ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: 5 }));
  return (
    <PublicFrame>
      <article className="card overflow-hidden">
        <div className="relative p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-25 blur-3xl" style={{ background: t.status === "closed" ? (win ? "rgb(var(--up))" : "rgb(var(--down))") : "rgb(var(--chart))" }} />
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${t.direction === "long" ? "bg-up/15 text-up" : "bg-down/15 text-down"}`}>{t.direction.toUpperCase()}</span>
            <span className="text-lg font-semibold">{t.instrument}</span>
            <VerifiedBadge label={t.live_logged ? "Verified · logged live" : "Verified journal"} />
          </div>
          <div className={`num mt-4 text-5xl font-semibold tracking-tight sm:text-6xl ${tone}`}>
            {t.status === "closed" ? fmtRs(t.r_multiple) : t.status === "open" ? "Live" : "Cancelled"}
          </div>
          {t.net_pnl != null && t.status === "closed" && <div className={`num mt-1 text-lg ${tone}`}>{t.net_pnl >= 0 ? "+" : "−"}${Math.abs(t.net_pnl).toLocaleString("en-US", { maximumFractionDigits: 2 })}</div>}
          <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
            {[
              ["Entry", fmt(t.entry)],
              ["Stop", fmt(t.sl)],
              ["Target", fmt(t.tp)],
              ["Exit", fmt(t.exit)],
              ["Planned R:R", t.rr_planned ? `1:${t.rr_planned}` : "—"],
              ["A+ gate", `${t.gate_score}/8`],
              ["Setup", t.entry_model ?? t.poi_type ?? "—"],
              ["Session", t.session ?? "—"],
            ].map(([k, v]) => (
              <div key={k} className="bg-panel px-4 py-3">
                <div className="text-[11px] uppercase tracking-wide text-mute">{k}</div>
                <div className="num mt-1 truncate text-[15px] font-medium">{v}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-xs text-mute">
            Opened {new Date(t.opened_at).toUTCString().slice(5, 22)} UTC{t.closed_at ? ` · closed ${new Date(t.closed_at).toUTCString().slice(5, 22)} UTC` : ""} · logged {new Date(t.logged_at).toUTCString().slice(5, 22)} UTC
          </div>
        </div>
        {t.trader && (
          <Link href={`/u/${t.trader.username}`} className="flex items-center gap-3 border-t border-line px-6 py-4 hover:bg-raised sm:px-8">
            <Avatar id={t.trader.avatar} size={36} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{t.trader.display_name || `@${t.trader.username}`}</span>
              <span className="block text-xs text-mute">View verified profile →</span>
            </span>
          </Link>
        )}
      </article>
    </PublicFrame>
  );
}
