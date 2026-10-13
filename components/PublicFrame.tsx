import Link from "next/link";
import { Logo } from "@/components/Brand";

/** Chrome for public pages (profiles, shared trades, leaderboard): no session needed. */
export default function PublicFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <Link href="/" className="flex items-center gap-2">
          <Logo className="h-8 w-8" />
          <span className="text-[15px] font-semibold tracking-tight">TradePlay</span>
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/leaderboard" className="hidden rounded-full px-3 py-2 text-mute hover:text-ink sm:inline">Leaderboard</Link>
          <Link href="/" className="rounded-full px-3 py-2 text-mute hover:text-ink">Open app</Link>
          <Link href="/login?join" className="btn-primary h-9 min-h-0 px-4 text-sm">Join the beta</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-4 pb-16 pt-4">{children}</main>
      <footer className="mx-auto max-w-4xl px-4 pb-10 text-center text-[11px] leading-relaxed text-mute">
        Stats are computed by A+ TradePlay from trades in the trader&apos;s journal and can&apos;t be edited by hand; &quot;logged live&quot; means the trade was recorded within 30 minutes of entry. They are not broker-audited. Nothing here is financial advice.
      </footer>
    </div>
  );
}

export function VerifiedBadge({ label = "Verified journal" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-chart/40 bg-chart/10 px-2 py-0.5 text-[11px] font-medium text-chart" title="Computed by A+ TradePlay from journal entries — not editable by hand">
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden><path d="M12 2l2.4 1.8 3-.1.9 2.9 2.4 1.8-1 2.8 1 2.8-2.4 1.8-.9 2.9-3-.1L12 22l-2.4-1.8-3 .1-.9-2.9L3.3 15.6l1-2.8-1-2.8 2.4-1.8.9-2.9 3 .1zm-1.2 13.6l5.6-5.6-1.4-1.4-4.2 4.2-2-2-1.4 1.4z" /></svg>
      {label}
    </span>
  );
}
