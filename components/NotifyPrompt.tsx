"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui";

const KEY = "aplus.notifyAsked";
const LATER_DAYS = 7;

/** Asks once (then weekly if postponed) to allow system notifications for plan, news and window nudges. */
export default function NotifyPrompt() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "default") return;
    let prev: string | null = null;
    try {
      prev = localStorage.getItem(KEY);
    } catch {
      return;
    }
    if (prev && prev !== "later" && !/^later:/.test(prev)) return;
    const at = prev?.startsWith("later:") ? Number(prev.slice(6)) : 0;
    if (at && Date.now() - at < LATER_DAYS * 864e5) return;
    const t = setTimeout(() => setOpen(true), 4000);
    return () => clearTimeout(t);
  }, []);

  const remember = (v: string) => {
    try {
      localStorage.setItem(KEY, v);
    } catch {
      /* ignore */
    }
  };
  const later = () => {
    remember(`later:${Date.now()}`);
    setOpen(false);
  };

  return (
    <Modal
      open={open}
      onClose={later}
      title="Turn on notifications?"
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={later}>Not now</button>
          <button
            className="btn-primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const r = await Notification.requestPermission().catch(() => "denied" as NotificationPermission);
              remember(r);
              setBusy(false);
              setOpen(false);
            }}
          >
            Allow
          </button>
        </div>
      }
    >
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-chart/15 text-chart">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
        </span>
        <div className="text-sm text-mute">
          <p>Get a nudge when it matters — and nothing else:</p>
          <ul className="mt-2 space-y-1 text-ink">
            <li>• Your trading window opens or closes</li>
            <li>• High-impact news is 15 minutes away</li>
            <li>• Plan or check-in not done yet</li>
            <li>• Reminders you or the coach set</li>
          </ul>
          <p className="mt-2 text-xs">Your browser will ask to confirm. You can change it any time in site settings.</p>
        </div>
      </div>
    </Modal>
  );
}
