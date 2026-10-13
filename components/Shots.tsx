"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export const SHOT_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const SHOT_MAX = 5 * 1024 * 1024;

export function checkShot(f: File): string | null {
  if (!SHOT_TYPES.includes(f.type)) return "PNG, JPG or WebP only";
  if (f.size > SHOT_MAX) return "Max 5 MB per image";
  return null;
}

/** Upload one image to the private screenshots bucket under <uid>/<folder>/; returns the storage path. */
export async function uploadShot(uid: string, folder: string, f: File): Promise<{ path?: string; error?: string }> {
  const bad = checkShot(f);
  if (bad) return { error: bad };
  const ext = f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : "jpg";
  const path = `${uid}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const { error } = await supabase.storage.from("screenshots").upload(path, f, { contentType: f.type, upsert: false });
  return error ? { error: error.message } : { path };
}

function Plus() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>;
}

/** Pick screenshots before the record exists (kept in memory, uploaded on save). Drop, paste or tap. */
export function ShotPicker({ files, onChange, max = 1, label = "Chart screenshot" }: { files: File[]; onChange: (f: File[]) => void; max?: number; label?: string }) {
  const [err, setErr] = useState<string | null>(null);
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const u = files.map((f) => URL.createObjectURL(f));
    setUrls(u);
    return () => u.forEach((x) => URL.revokeObjectURL(x));
  }, [files]);
  const add = (list: FileList | File[] | null | undefined) => {
    const arr = [...(list ?? [])];
    const bad = arr.map(checkShot).find(Boolean);
    setErr(bad ?? null);
    const ok = arr.filter((f) => !checkShot(f));
    if (ok.length) onChange([...files, ...ok].slice(-max));
  };
  return (
    <div onPaste={(e) => add(e.clipboardData.files)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); add(e.dataTransfer.files); }}>
      <div className="flex flex-wrap gap-2">
        {urls.map((u, i) => (
          <div key={u} className="relative h-24 w-36 overflow-hidden rounded-xl border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt={`${label} ${i + 1}`} className="h-full w-full object-cover" />
            <button type="button" className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-bg/85 text-xs" onClick={() => onChange(files.filter((_, j) => j !== i))} aria-label="Remove image">✕</button>
          </div>
        ))}
        {files.length < max && (
          <label className="flex h-24 w-36 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line text-center text-[11px] text-mute hover:border-chart/50 hover:text-ink" tabIndex={0}>
            <Plus />
            <span>{label}</span>
            <input type="file" accept={SHOT_TYPES.join(",")} multiple={max > 1} className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
          </label>
        )}
      </div>
      <p className="mt-1.5 text-[11px] text-mute">Drop, paste (Ctrl/⌘+V) or tap · PNG/JPG/WebP · 5 MB{max > 1 ? ` · up to ${max}` : ""}</p>
      {err && <p className="mt-1 text-xs text-down">{err}</p>}
    </div>
  );
}

function Thumb({ path, onRemove }: { path: string; onRemove?: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    supabase.storage.from("screenshots").createSignedUrl(path, 900).then(({ data }) => live && setUrl(data?.signedUrl ?? null));
    return () => { live = false; };
  }, [path]);
  return (
    <div className="relative h-24 w-36 overflow-hidden rounded-xl border border-line bg-raised">
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Screenshot" className="h-full w-full object-cover" />
        </a>
      )}
      {onRemove && <button type="button" className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-bg/85 text-xs" onClick={onRemove} aria-label="Remove image">✕</button>}
    </div>
  );
}

/** Uploaded images (storage paths) with add/remove; persists through onChange(paths). */
export function ShotGallery({ uid, folder, paths, onChange, max = 6, disabled }: { uid: string; folder: string; paths: string[]; onChange: (p: string[]) => Promise<void> | void; max?: number; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inFlight = useRef(false);
  async function add(list: FileList | File[] | null | undefined) {
    const arr = [...(list ?? [])].slice(0, Math.max(0, max - paths.length));
    if (!arr.length || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setErr(null);
    const out: string[] = [];
    for (const f of arr) {
      const r = await uploadShot(uid, folder, f);
      if (r.error) setErr(r.error);
      else if (r.path) out.push(r.path);
    }
    if (out.length) await onChange([...paths, ...out]);
    setBusy(false);
    inFlight.current = false;
  }
  async function remove(p: string) {
    await onChange(paths.filter((x) => x !== p));
    await supabase.storage.from("screenshots").remove([p]);
  }
  return (
    <div onPaste={(e) => !disabled && add(e.clipboardData.files)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (!disabled) add(e.dataTransfer.files); }}>
      <div className="flex flex-wrap gap-2">
        {paths.map((p) => <Thumb key={p} path={p} onRemove={disabled ? undefined : () => remove(p)} />)}
        {paths.length < max && !disabled && (
          <label className="flex h-24 w-36 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line text-center text-[11px] text-mute hover:border-chart/50 hover:text-ink" tabIndex={0}>
            {busy ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-chart" /> : <Plus />}
            <span>{busy ? "Uploading…" : "Add screenshot"}</span>
            <input type="file" accept={SHOT_TYPES.join(",")} multiple className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
          </label>
        )}
      </div>
      {err && <p className="mt-1 text-xs text-down">{err}</p>}
    </div>
  );
}
