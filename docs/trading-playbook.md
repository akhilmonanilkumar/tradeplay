# Trading playbook — XAUUSD (FundedHive 25K) & BTCUSDT.P (Breakout 5K funded)

Built from Brad Go's Market Mechanics lessons; the source video numbers are in [brackets] and the full transcripts live in the Claude project "Trade Finder Pro". Account limits are my own, set inside each firm's rules. Lines marked *(my rule)* are not from the source.

**Daily goal:** at most 1–2 A+ trades per account. **The minimum is 1:3 R:R**, and if all boxes aren't ticked, there is no trade.

---

## 1. Daily routine

**Before your session (15 min)**
1. Check the economic calendar. Mark any high-impact news (CPI, NFP, FOMC). Nothing gets opened from 15 min before to 15 min after; wait 30–60 min after the release [44].
2. **HTF range:** on 4H (BTC) or 1H (gold), find the latest BOS. Mark the swing low and swing high [29, 51].
3. **Premium/discount:** draw a fib from swing low to swing high. Below 50% you look only for longs; above 50% only for shorts. Mid-range means no trade [22, 29].
4. **Liquidity:** mark the previous day high (PDH) and previous day low (PDL), plus equal highs and lows. Decide which side is the magnet [29].
5. **Narrative + invalidation:** decide whether it's a continuation or a pullback. Write the sentence "Bias is wrong if price closes and holds beyond ___" [29].
6. **15M POIs:** mark only zones that are aligned with the trend, in the correct half of the range, and that swept or sit next to liquidity. Draw from the extreme first [32, 39, 51].
7. Set price alerts at the POIs and walk away. Do nothing until price is **inside** one [32].

**In session**
8. On a POI alert, drop to 5M/1M and wait for an entry model (section 3).
9. Run the A+ gate (section 2). Any box fails → no trade.
10. Size the position from the stop (section 5). Then set the entry, SL and TP and leave it alone.

**After session**
11. Log the trade in Notion (Trades). Attach before and after screenshots. Tag the entry model and grade. Write one line on what you'd repeat or fix [37, 40].

---

## 2. A+ gate: all 7 or no trade

| # | Check | Pass condition |
|---|---|---|
| 1 | **HTF aligned** | 1H/4H trend and 15M trend point the same way, and the trade goes with them [39, 51] |
| 2 | **Correct half** | Longs only in discount, shorts only in premium [22, 29] |
| 3 | **In a high-quality POI** | Price is *inside* a 15M zone that is trend-aligned and has a liquidity story [39] |
| 4 | **Liquidity swept** | An internal low/high, PDH/PDL, or equal highs/lows got taken at or into the POI [39, 51] |
| 5 | **Market shift** | On 5M/1M, a body close beyond the last lower high (for longs) or the last higher low (for shorts) [32, 39] |
| 6 | **Timing** | Inside your session window and outside the ±15 min news window [39, 44] |
| 7 | **R:R ≥ 1:3** | The TP is a *real* target at least 3R away: next 15M swing, opposing zone, PDH/PDL, or unfilled FVG. **Never stretch the TP to reach 3R** *(your 1:3 rule)* |

**Automatic no-trade:** price is mid-range, there's no sweep, there's no shift, the HTF and 15M trends disagree, you're outside the window, you can't name the invalidation, or the R:R is under 3 [39].

---

## 3. Entry models (only after the POI tap + sweep)

**A. Market Shift → pullback** (the default model) [32]
- Price sweeps liquidity at the 15M POI.
- 5M breaks the last lower high (for longs). That's the market shift.
- Mark the 5M zone that caused the shift. **Place a limit order at that zone.**

**B. Flip zone** [28, 32]
- An opposing LTF zone fails (a failed reaction), and then the shift happens.
- Enter on the pullback to the flip zone.
- **Tie-break:** if a flip zone and an extreme zone both exist, use the extreme zone. Liquidity under the flip zone usually gets swept first [32].

**C. Sweep → OB → FVG refinement** [50]
- After the sweep and shift, mark the order block that started the move.
- Enter at the FVG inside or next to that OB, which gives a tighter stop and makes 1:3 easier to reach.

**Rules for all three:**
- If the shift has no pullback, let the trade go. Don't chase [32].
- If a shift fails and sweeps the other side, wait for a fresh sweep and shift.
- The "aggressive" gold entry (entering straight off the sweep with no shift) is **excluded** from A+, because it skips box 5 [51].

---

## 4. Stops, targets, management

- **SL:** just beyond the LTF zone, or beyond the sweep wick (the protected low or high), plus the spread [32, 51].
- **TP:** the nearest structural target that is at least 3R away, on the entry TF or one TF above. Use the next 15M swing or opposing zone, PDH/PDL, or an unfilled FVG [34, 51].
  - If the nearest real target is under 3R, **skip the trade**.
- **Management** *(my rule)*: set and forget for your first 30 logged trades, to collect clean data. After that, test one rule only: move the SL to breakeven once price reaches +2R *and* the LTF makes a new swing in your favour.
- **Never** widen the SL, remove the SL, or move the SL for news [44, 51].

---

## 5. Account plans

### FundedHive $25K PFP — Phase 1 → XAUUSD only
Firm rules are taken from FundedHive's PFP page (Oct 2026); confirm them in your dashboard:
- Phase 1 target is **10% = $2,500**.
- Max daily loss is **5% = $1,250**, measured end-of-day (EOD).
- Max overall loss is **10% static, balance-based**, giving a floor of **$22,500**.
- Max loss per trade is **3% = $750**.
- You need **3 profitable days** minimum.
- Leverage is 1:50 (dynamic). News trading is allowed. Weekend holding is allowed in Phase 1 but not on the funded account.
- There's no consistency rule, and the profit split is 80%.

| Your limit | Value |
|---|---|
| Risk per trade | **0.5% = $125** |
| Drawdown mode *(my rule)* | After 2 losses in a row, or equity < $24,500, drop to **0.25% = $62.50** until you're back at $25,000 |
| Trades/day | **Max 2.** Stop after 2 losses. Worst day = −1% ($250) |
| Weekly circuit breaker *(my rule)* | Down 2.5% ($625) on the week → stop until Monday and review the journal |
| Review pause | Equity ≤ $23,750 (−5%): stop and review before trading again |

**Gold lots** = Risk $ ÷ (SL distance in $ × 100 oz).
- Example: $125 risk with a $3.00 stop (+spread) gives 125 ÷ 300 = **0.41 lots**, using about $3.4k margin at 1:50. Check the contract size in your platform's symbol spec.

### Breakout $5K 1-Step Turbo — FUNDED → BTCUSDT.P only
Firm rules (third-party summary, Sep 2026; confirm in your dashboard):
- Static max drawdown 3%, with **floor $4,850**. Floating P&L counts.
- Daily loss is 3% of the daily opening balance, and the **reset is 00:30 UTC = 06:00 IST**.
- BTC leverage is 10x. Fees are **0.04% per side** on funded accounts. Payouts need no open positions.

| Equity | Risk/trade | Trades/day |
|---|---|---|
| ≥ $5,150 | 0.75% = $37.50 | 2 |
| $5,000 – $5,149 | **0.5% = $25** | 2 |
| $4,925 – $4,999 | 0.25% = $12.50 | 2 |
| $4,880 – $4,924 | 0.25% | **1** |
| ≤ $4,880 | **Stop** — review before the next session | 0 |

- Stop for the day after 2 losses or −1% ($50).
- Never hold a trade through 06:00 IST.
- *(my rule)* After each payout, the balance drops back toward $5,000 while the floor stays at $4,850. Size from the table above again after every withdrawal.

**BTC qty** = Risk $ ÷ (SL distance $ + Entry × 0.0008). The 0.0008 term covers round-trip fees.
- Example: entry $82,800 with a $400 stop and $25 risk gives 25 ÷ 466 = **0.054 BTC**.
- With 1:3 targets, keep the SL at **≥ 0.4% of price**. Below that, fees take more than about 17% of risk and erode the 3R.

---

## 6. Session windows (IST)

| Window | Now (US daylight time) | From 2 Nov |
|---|---|---|
| London Q zone (source's main window) [26] | 11:30 – 14:30 | 12:30 – 15:30 |
| **New York Q zone** | **16:30 – 19:30** | **17:30 – 20:30** |

- Pick one window per account and stick to it [08, 26].
- NY suits both instruments: gold's NY expansion, and BTC around the US equity open (19:00 IST now).

---

## 7. Realistic expectations *(my assumptions)*

- The breakeven win rate at 3R is **25%**.
- At a 35% win rate × 3R, expectancy is **+0.40R per trade**.
- **FundedHive:** at 0.5% that's +0.2% per trade, so the 10% target takes about **50 trades**, roughly 5–10 weeks at 1–2 trades/day. There's no rush; slowness is what passes [45].
- **Breakout:** at $25 risk that's about +$10 per trade on average. Judge the system on 100 trades, not on a week [03].

---

## 8. Instrument notes

**Gold** [51]:
- Fast in both directions. It loves to sweep a high or low and then reverse hard.
- Take the cleanest part of the move: get in fast, get out faster. His documented trades were held 44–80 min.
- A 1H/15M misalignment nearly cost him a trade, so it's a hard filter.

**BTC** [03, 29]:
- Liquidation clusters act as liquidity.
- Stops and liquidations trigger on the **mark price**.
- Positive funding means longs pay. Rising open interest means new money is entering.
- The source has only one BTC bias example. Treat the BTC rules here as the same framework, and validate them in your journal.

---

## 9. Pre-trade card

```
Account: FH-25K / BO-5K   Instrument: XAUUSD / BTCUSDT.P   Window: ____
HTF swing L ____ H ____ → Premium / Discount / Mid
PDH ____ PDL ____ EQH/EQL ____ → magnet: ____
Bias: LONG / SHORT   Invalidation: wrong if holds beyond ____
POI (15M): Demand / Supply / OB / FVG / Flip  @ ____
[ ] HTF aligned [ ] correct half [ ] in POI [ ] sweep [ ] market shift
[ ] in window & news clear [ ] R:R ≥ 3 to a real target
Model: Market Shift / Flip / OB→FVG
Entry ____ SL ____ TP ____ R:R ____ Risk $ ____ Size ____
Trades today on this account: __/2
```
