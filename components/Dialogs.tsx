"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Modal } from "@/components/ui";

/**
 * App-styled replacements for window.confirm / window.prompt.
 *   if (!(await confirmDialog({ title: "Delete trade?", danger: true }))) return;
 *   const name = await promptDialog({ title: "Rename", value: "Old" });
 * <DialogHost /> is mounted once (in the root layout).
 */
type ConfirmOpts = { title: string; body?: React.ReactNode; confirmLabel?: string; cancelLabel?: string; danger?: boolean };
type PromptOpts = { title: string; body?: React.ReactNode; label?: string; value?: string; placeholder?: string; confirmLabel?: string; maxLength?: number };
type Pending =
  | { kind: "confirm"; opts: ConfirmOpts; resolve: (v: boolean) => void }
  | { kind: "prompt"; opts: PromptOpts; resolve: (v: string | null) => void };

let current: Pending | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l));

function open(p: Pending) {
  // A new dialog supersedes an unanswered one (treated as cancelled).
  if (current) current.kind === "confirm" ? current.resolve(false) : current.resolve(null);
  current = p;
  emit();
}

export function confirmDialog(opts: ConfirmOpts | string): Promise<boolean> {
  const o = typeof opts === "string" ? { title: opts } : opts;
  if (typeof window === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => open({ kind: "confirm", opts: o, resolve }));
}

export function promptDialog(opts: PromptOpts): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => open({ kind: "prompt", opts, resolve }));
}

export function DialogHost() {
  const p = useSyncExternalStore(subscribe, () => current, () => null);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (p?.kind === "prompt") {
      setText(p.opts.value ?? "");
      setTimeout(() => inputRef.current?.select(), 30);
    }
  }, [p]);
  if (!p) return null;
  const close = (ok: boolean) => {
    const done = p;
    current = null;
    emit();
    if (done.kind === "confirm") done.resolve(ok);
    else done.resolve(ok ? text : null);
  };
  const o = p.opts;
  const danger = p.kind === "confirm" && p.opts.danger;
  return (
    <Modal
      open
      onClose={() => close(false)}
      title={o.title}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => close(false)}>{(p.kind === "confirm" && p.opts.cancelLabel) || "Cancel"}</button>
          <button className={danger ? "btn-danger" : "btn-primary"} onClick={() => close(true)} autoFocus={p.kind === "confirm"}>
            {o.confirmLabel ?? (danger ? "Delete" : p.kind === "prompt" ? "Save" : "Confirm")}
          </button>
        </div>
      }
    >
      {o.body && <div className="text-sm text-mute">{o.body}</div>}
      {p.kind === "prompt" && (
        <form onSubmit={(e) => { e.preventDefault(); close(true); }} className={o.body ? "mt-3" : ""}>
          {p.opts.label && <label className="label mb-1.5 block">{p.opts.label}</label>}
          <input ref={inputRef} className="input" value={text} maxLength={p.opts.maxLength ?? 200} placeholder={p.opts.placeholder} onChange={(e) => setText(e.target.value)} />
        </form>
      )}
    </Modal>
  );
}
