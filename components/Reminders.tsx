"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useData, Icon } from "@/components/Shell";
import { nudges, type Nudge } from "@/lib/nudges";
import { supabase } from "@/lib/supabase";

const SEEN_KEY = "aplus.notified";
const READ_KEY = "aplus.read";

function loadSet(key: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) ?? "[]"));
  } catch {
    return new Set();
  }
}
function saveSet(key: string, s: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...s].slice(-300)));
  } catch {
    /* storage unavailable — notifications may repeat, harmless */
  }
}
const loadSeen = () => loadSet(SEEN_KEY);
const saveSeen = (s: Set<string>) => saveSet(SEEN_KEY, s);

async function notify(n: Nudge) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker?.getRegistration?.();
  const opts = { body: n.text, icon: "/icon-192.png", badge: "/icon-192.png", tag: n.id, data: { url: n.href } };
  if (reg) reg.showNotification("A+ TradePlay", opts);
  else new Notification("A+ TradePlay", opts);
}

/** Bell with live reminders: stored ones, plan/news/window nudges, reviews. Fires a system notification once per item. */
export default function ReminderCenter({ compact = false }: { compact?: boolean }) {
  const data = useData();
  const [now, setNow] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const seen = useRef<Set<string> | null>(null);
  const [read, setRead] = useState<Set<string>>(() => new Set());
  const [justRead, setJustRead] = useState<Set<string>>(() => new Set());
  const box = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => setRead(loadSet(READ_KEY)), []);
  // Close on navigation, outside tap and Escape.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("touchstart", away, { passive: true });
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("touchstart", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  useEffect(() => {
    setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const list = useMemo(
    () => nudges(now, { accounts: data.accounts, plans: data.plans, trades: data.trades, reminders: data.reminders, reviews: data.reviews }),
    [now, data.accounts, data.plans, data.trades, data.reminders, data.reviews],
  );

  useEffect(() => {
    if (!seen.current) seen.current = loadSeen();
    const fresh = list.filter((n) => n.level !== "info" && !seen.current!.has(n.id));
    if (!fresh.length) return;
    fresh.forEach((n) => {
      seen.current!.add(n.id);
      notify(n);
    });
    saveSeen(seen.current);
  }, [list]);

  async function done(n: Nudge) {
    if (n.reminderId) {
      await supabase.from("reminders").update({ done: true }).eq("id", n.reminderId);
      data.refresh();
    }
  }

  const unread = list.filter((n) => !read.has(n.id));
  const urgent = unread.filter((n) => n.level !== "info").length;

  // Opening the panel marks everything in it as read; items stay highlighted until it closes.
  useEffect(() => {
    if (!open) return setJustRead(new Set());
    const fresh = list.filter((n) => !read.has(n.id)).map((n) => n.id);
    if (!fresh.length) return;
    setJustRead(new Set(fresh));
    const next = new Set([...read, ...fresh]);
    setRead(next);
    saveSet(READ_KEY, next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return (
    <div className="relative" ref={box}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`relative grid place-items-center text-mute hover:text-ink ${compact ? "h-10 w-10 rounded-full bg-panel shadow-[var(--shadow)] sm:h-11 sm:w-11" : "h-9 gap-2 rounded-lg px-3 text-sm hover:bg-raised"}`}
        aria-label={`Notifications (${unread.length} unread)`}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <Icon d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          {!compact && <span>Reminders</span>}
        </span>
        {unread.length > 0 && (
          <span className={`num absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-semibold ${urgent ? "bg-accent text-accent-ink" : "bg-chart text-white"}`}>{unread.length}</span>
        )}
      </button>
      {open && (
        <div className="card fixed inset-x-3 top-[calc(4.25rem+env(safe-area-inset-top))] z-40 p-2 shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[380px]">
          <div className="flex items-center justify-between px-3 pb-1 pt-1.5">
            <span className="text-sm font-semibold">Notifications</span>
            <button className="grid h-8 w-8 place-items-center rounded-full text-mute hover:bg-raised hover:text-ink" onClick={() => setOpen(false)} aria-label="Close">✕</button>
          </div>
          {list.length === 0 && <p className="px-3 py-4 text-sm text-mute">Nothing pending. Patience is a position.</p>}
          <ul className="max-h-[60vh] overflow-y-auto">
            {list.map((n) => (
              <li key={n.id} className={`flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-raised ${justRead.has(n.id) ? "bg-chart/5" : ""}`}>
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.level === "due" ? "bg-down" : n.level === "warn" ? "bg-accent" : "bg-mute"}`} />
                <Link href={n.href} onClick={() => setOpen(false)} className="flex-1 text-sm leading-snug">{n.text}</Link>
                {n.reminderId && <button className="text-xs text-mute hover:text-ink" onClick={() => done(n)}>Done</button>}
              </li>
            ))}
          </ul>
          <div className="mt-1 flex items-center justify-between border-t border-line px-3 pt-2 text-xs text-mute">
            <Link href="/coach" onClick={() => setOpen(false)} className="hover:text-ink">Ask coach to set a reminder</Link>
            {perm === "default" && (
              <button className="text-accent" onClick={async () => { const r = await Notification.requestPermission(); setPerm(r); try { localStorage.setItem("aplus.notifyAsked", r); } catch {} }}>Enable notifications</button>
            )}
            {perm === "denied" && <span>Notifications blocked in browser</span>}
          </div>
        </div>
      )}
    </div>
  );
}
