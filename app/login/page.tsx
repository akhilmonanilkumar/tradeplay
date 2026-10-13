"use client";

import { Logo } from "@/components/Brand";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Mode = "signin" | "join";

export default function Login() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("join") != null) setMode("join");
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.replace("/");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) window.location.replace("/");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setMsg("");
    const addr = email.trim().toLowerCase();
    if (mode === "join") {
      const { error } = await supabase.rpc("redeem_beta_code", { p_email: addr, p_code: code.trim() });
      if (error) {
        setState("error");
        setMsg(/not valid/i.test(error.message) ? "That access code isn't valid." : /valid email/i.test(error.message) ? "Enter a valid email address." : error.message);
        return;
      }
    }
    const { error } = await supabase.auth.signInWithOtp({
      email: addr,
      options: { emailRedirectTo: window.location.origin, shouldCreateUser: mode === "join" },
    });
    if (error) {
      setState("error");
      if (mode === "signin" && /signups? not allowed|not found|invite-only|Database error/i.test(error.message)) {
        setMsg("No account for this email yet. Have a beta access code? Join below.");
      } else if (/rate limit|security purposes/i.test(error.message)) {
        setMsg("Too many links requested — wait a minute and try again.");
      } else setMsg(error.message);
    } else setState("sent");
  }

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <form onSubmit={send} className="card p-6">
          <Logo className="h-11 w-11" />
          <h1 className="mt-4 text-xl font-semibold tracking-tight"><span className="text-accent">A+</span> TradePlay</h1>
          <p className="mt-1 text-sm text-mute">Journal, guardrails and an AI coach for funded traders. Closed beta.</p>

          <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-raised p-1 text-sm" role="tablist">
            {(["signin", "join"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => { setMode(m); setState("idle"); setMsg(""); }}
                className={`rounded-lg py-2 font-medium transition ${mode === m ? "bg-panel text-ink shadow" : "text-mute"}`}
              >
                {m === "signin" ? "Sign in" : "Join the beta"}
              </button>
            ))}
          </div>

          {state === "sent" ? (
            <div className="mt-6 rounded-xl border border-line p-4 text-sm">
              <div className="font-semibold">Check your inbox</div>
              <p className="mt-1 text-mute">We sent a sign-in link to <b className="text-ink">{email}</b>. Open it on this device. You can close this tab.</p>
              <button type="button" className="mt-3 text-xs text-accent" onClick={() => setState("idle")}>Use a different email</button>
            </div>
          ) : (
            <>
              <label className="label mt-5 block" htmlFor="email">Email</label>
              <input id="email" type="email" required autoComplete="email" inputMode="email" className="input mt-1.5" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              {mode === "join" && (
                <>
                  <label className="label mt-4 block" htmlFor="code">Access code</label>
                  <input id="code" required autoComplete="off" autoCapitalize="none" spellCheck={false} className="input mt-1.5" value={code} onChange={(e) => setCode(e.target.value)} placeholder="From your invite" />
                </>
              )}
              {state === "error" && <p className="mt-3 text-sm text-down">{msg}</p>}
              <button className="btn-primary mt-5 h-11 w-full" disabled={state === "sending"}>
                {state === "sending" ? "Sending…" : mode === "join" ? "Join & send my link" : "Send magic link"}
              </button>
              <p className="mt-3 text-center text-xs text-mute">No passwords. We email you a one-time link.</p>
            </>
          )}
        </form>
        <p className="mt-4 text-center text-xs text-mute">
          <a href="/leaderboard" className="hover:text-ink">Leaderboard</a>
        </p>
      </div>
    </div>
  );
}
