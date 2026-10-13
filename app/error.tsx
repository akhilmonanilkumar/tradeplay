"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Friendly in-app error screen instead of the framework error page. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto mt-16 max-w-md px-4 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-down/10 text-2xl text-down">!</div>
      <h1 className="mt-4 text-xl font-semibold">Something went wrong on this screen</h1>
      <p className="mt-2 text-sm text-mute">Your data is safe. Try again, or go back to Today.</p>
      {error?.message && <p className="num mt-3 rounded-xl bg-raised px-3 py-2 text-left text-xs text-mute">{error.message.slice(0, 240)}</p>}
      <div className="mt-5 flex justify-center gap-2">
        <button className="btn-primary" onClick={reset}>Try again</button>
        <Link className="btn-ghost" href="/">Go to Today</Link>
      </div>
    </div>
  );
}
