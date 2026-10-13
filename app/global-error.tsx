"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#0B0C0F", color: "#ECEDF0", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20 }}>A+ TradePlay hit an error</h1>
          <p style={{ color: "#8B909A", fontSize: 14 }}>Your data is safe. Reload to continue.</p>
          <button onClick={reset} style={{ marginTop: 12, padding: "10px 18px", borderRadius: 999, border: 0, background: "#ECEDF0", color: "#0B0C0F", fontWeight: 600 }}>Reload</button>
        </div>
      </body>
    </html>
  );
}
