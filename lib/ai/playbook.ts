/** Condensed A+ playbook — always in the coach's context. Full text: docs/trading-playbook.md (and the knowledgebase). */
export const PLAYBOOK = `A+ PLAYBOOK (built for XAUUSD and BTC perpetuals; the same rules apply to any liquid instrument). Source: Brad Go "Market Mechanics" lessons.
Goal: max 1–2 A+ trades per account per day. Minimum R:R 1:3 to a REAL structural target (never stretch TP). If any box fails → no trade.

PRE-MARKET: economic calendar (no entries ±15 min of high-impact news; wait 30–60 min after) · HTF range from the latest BOS (4H BTC, 1H gold) · premium/discount fib: longs only below 50%, shorts only above, mid-range = no trade · liquidity: PDH/PDL, equal highs/lows, decide the magnet · narrative (continuation/pullback) + written invalidation "bias wrong if price closes and holds beyond ___" · 15M POIs aligned with trend, in the correct half, with a liquidity story; draw from the extreme · set alerts, walk away until price is INSIDE a POI.

A+ GATE (all): 1 HTF aligned (1H/4H and 15M agree, trade goes with them) · 2 correct half · 3 inside a high-quality 15M POI · 4 liquidity swept (internal high/low, PDH/PDL, EQH/EQL) · 5 market shift: 5M/1M BODY close beyond the last lower high (long) / higher low (short) · 6 inside the chosen session window and outside the news window · 7 R:R ≥ 1:3.
Automatic no-trade: mid-range, no sweep, no shift, HTF vs 15M disagree, outside window, can't name invalidation, R:R < 3. The "aggressive" gold entry straight off the sweep (no shift) is NOT A+.

ENTRY MODELS (after POI tap + sweep): A) Market Shift → limit at the 5M zone that caused the shift (default). B) Flip zone: opposing LTF zone fails, then shift; enter on pullback to the flip; if an extreme zone also exists prefer the extreme. C) Sweep → OB → FVG: enter at the FVG in/next to the OB that started the move (tighter stop). If the shift has no pullback, let it go — never chase. Failed shift that sweeps the other side → wait for a fresh sweep + shift.

STOPS/TARGETS/MANAGEMENT: SL beyond the LTF zone or the sweep wick + spread. TP = nearest structural target ≥3R (next 15M swing/opposing zone, PDH/PDL, unfilled FVG); if under 3R skip. First 30 logged trades: set and forget. After: only test SL→BE at +2R AND a new LTF swing in favour. Never widen/remove/move SL for news.

RISK: FundedHive 0.5% ($125), drop to 0.25% after 2 losses in a row or equity < $24,500; max 2 trades/day, stop after 2 losses; weekly −2.5% → stop until Monday; equity ≤ $23,750 → stop and review. Firm: 10% target, 5% daily (EOD), 10% static, 3% per trade max, 3 profitable days.
Breakout BTC: ≥$5,150 0.75%; $5,000–5,149 0.5% ($25); $4,925–4,999 0.25%; $4,880–4,924 0.25% & 1 trade; ≤$4,880 stop. Stop for the day after 2 losses or −1%. Firm: 3% static DD (floor $4,850, floating counts), 3% daily, reset 00:30 UTC (06:00 IST), fees 0.04%/side → qty = risk ÷ (SL distance + entry×0.0008); keep SL ≥ 0.4% of price. Never hold through 06:00 IST.
Gold lots = risk ÷ (SL $ × 100 oz).

SESSIONS (Q-zones, New York time; IST shifts with US DST): London 02:00–05:00 NY, New York 07:00–10:00 NY, Asia 20:00–24:00 NY. The daily plan can choose sessions per account.
EXPECTANCY: breakeven win rate at 3R = 25%; 35% × 3R ≈ +0.4R/trade. Judge on 100 trades, not a week. Slowness is what passes.
INSTRUMENTS: Gold sweeps a high/low then reverses hard — get in fast, out faster (44–80 min holds); 1H/15M misalignment is a hard filter. BTC: liquidation clusters are liquidity; stops trigger on mark price; positive funding = longs pay; rising OI = new money.`;
