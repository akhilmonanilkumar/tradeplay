"use client";

import { Logo } from "@/components/Brand";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => {
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
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin, shouldCreateUser: true },
    });
    if (error) {
      setState("error");
      setMsg(/closed|Database error/i.test(error.message) ? "This journal is private." : error.message);
    } else setState("sent");
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form onSubmit={send} className="card w-full max-w-sm p-6">
        <Logo className="h-11 w-11" />
        <h1 className="mt-4 text-lg font-semibold tracking-tight"><span className="text-accent">A+</span> TradePlay</h1>
        <p className="mt-1 text-sm text-mute">Private journal. Sign in with a one-time email link.</p>
        {state === "sent" ? (
          <p className="mt-6 rounded-lg border border-line p-3 text-sm">
            Check <b>{email}</b> for the sign-in link. You can close this tab.
          </p>
        ) : (
          <>
            <label className="label mt-6 block" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              className="input mt-1.5"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            {state === "error" && <p className="mt-2 text-sm text-down">{msg}</p>}
            <button className="btn-primary mt-4 w-full" disabled={state === "sending"}>
              {state === "sending" ? "Sending…" : "Send magic link"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
