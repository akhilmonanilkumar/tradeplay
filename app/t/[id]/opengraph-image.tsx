import { ImageResponse } from "next/og";
import { fmtRs, rpcAnon, UUID_RE, type PublicTrade } from "@/lib/publicApi";

export const alt = "Shared trade on A+ TradePlay";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = UUID_RE.test(id) ? await rpcAnon<PublicTrade | null>("public_trade", { p_share: id }, 60) : null;
  const closed = t?.status === "closed";
  const r = t?.r_multiple ?? 0;
  const color = !t ? "#9AA0AA" : !closed ? "#8B5CF6" : r > 0 ? "#34D399" : r < 0 ? "#FB7185" : "#ECEDF0";
  const big = !t ? "A+ TradePlay" : closed ? fmtRs(r) : t.status === "open" ? "LIVE" : "CANCELLED";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0A0B0D", color: "#ECEDF0", padding: 64, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", width: 56, height: 56, borderRadius: 16, background: "#121317", border: "2px solid #2A2C33", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 800 }}>
            A<span style={{ color: "#F2C14E" }}>+</span>
          </div>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700 }}>
            <span>TradePlay</span>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, padding: "8px 18px", borderRadius: 999, border: "2px solid #8B5CF6", color: "#C4B5FD", fontSize: 24 }}>
            <svg width="24" height="24" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#C4B5FD" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span>{t?.live_logged ? "Verified - logged live" : "Verified journal"}</span>
          </div>
        </div>
        {t ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", gap: 18, alignItems: "center", fontSize: 40 }}>
              <span style={{ color: t.direction === "long" ? "#34D399" : "#FB7185", fontWeight: 800 }}>{t.direction.toUpperCase()}</span>
              <span style={{ fontWeight: 700 }}>{t.instrument}</span>
            </div>
            <div style={{ fontSize: 190, fontWeight: 800, color, letterSpacing: -6, lineHeight: 1.05 }}>{big}</div>
            <div style={{ display: "flex", gap: 40, fontSize: 28, color: "#9AA0AA" }}>
              <span>{`Planned 1:${t.rr_planned ?? "-"}`}</span>
              <span>{`A+ gate ${t.gate_score}/8`}</span>
              {t.entry_model ? <span>{t.entry_model}</span> : null}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 80, fontWeight: 800 }}>Only the A+ trades.</div>
        )}
        <div style={{ display: "flex", fontSize: 26, color: "#9AA0AA" }}>
          {t?.trader ? `${t.trader.display_name || "@" + t.trader.username} - tradeplay.cloud/u/${t.trader.username}` : "tradeplay.cloud"}
        </div>
      </div>
    ),
    size,
  );
}
