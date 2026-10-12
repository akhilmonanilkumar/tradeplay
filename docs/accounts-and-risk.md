# Accounts & risk configuration

Both accounts are created by **Load my accounts** (the `seed_my_defaults()` function) and are fully editable under **Accounts** in the app. Firm rules come from the firms' published pages (FundedHive PFP page, Oct 2026; Breakout via a third-party summary, Sep 2026) — **confirm them in each dashboard**; personal limits are deliberately tighter.

## FundedHive $25K PFP — Phase 1 → XAUUSD only

| Setting | Value | Source |
|---|---|---|
| Profit target | 10% → $27,500 | Firm |
| Max daily loss | 5% ($1,250), end-of-day based | Firm |
| Max overall loss | 10% static → floor $22,500 | Firm |
| Max loss per trade | 3% | Firm |
| Min profitable days | 3 | Firm |
| Leverage | 1:50 dynamic; news allowed; weekend holding Phase 1 only | Firm |
| Daily reset | `00:00` UTC — **set to your broker's server midnight in UTC** | Edit in app |
| Risk ladder | equity ≥ $24,500 → 0.5% ($125), 2 trades · ≥ $23,750 → 0.25%, 2 trades | Personal |
| Loss streak | after 2 consecutive losses → 0.25% until you recover | Personal |
| Hard stop | $23,750 (−5%) → stop and review | Personal |
| Personal daily stop | −1% | Personal |
| Daily profit cap | +3% | Personal |
| Window | New York Q-zone (change to London if your schedule allows) | Personal |
| Sizing | 100 oz/lot, no fee term — add spread to your stop | — |

Example: $125 risk, $3.00 stop → `125 ÷ (100 × 3)` = **0.41 lots**.

## Breakout $5K 1-Step Turbo — Funded → BTCUSDT.P only

| Setting | Value | Source |
|---|---|---|
| Max drawdown | 3% **static** → floor $4,850; floating P&L counts | Firm |
| Daily loss | 3% of daily opening balance; resets **00:30 UTC (06:00 IST)** | Firm |
| Leverage / fees | BTC 10×; 0.04% per side (round-trip 0.0008) | Firm |
| Payouts | No open positions at request time | Firm |
| Risk ladder | ≥ $5,150 → 0.75%, 2 · ≥ $5,000 → 0.5% ($25), 2 · ≥ $4,925 → 0.25%, 2 · ≥ $4,880 → 0.25%, **1** | Personal |
| Hard stop | $4,880 → stop trading the account | Personal |
| Personal daily stop | −1% ($50) | Personal |
| Window | New York Q-zone (US equity open ≈ 19:00 IST in summer time) | Personal |
| Sizing | qty = risk ÷ (|entry − SL| + entry × 0.0008) | — |

Example: entry $82,800, SL $400 away, risk $25 → `25 ÷ (400 + 66.24)` = **0.054 BTC**. The app warns when fees exceed ~17% of a stop-out (stops tighter than ~0.4% of price).

## How the app decides "can I trade?"
For the selected account, **all** must be true (otherwise the button is locked and the reason is shown):
1. Account `active`, equity above `hard_stop_equity`, and a risk tier applies.
2. Trades opened since the last daily reset < tier's `max_trades`.
3. Losses since reset < `max_losses_per_day`.
4. Equity above personal daily stop **and** above the firm daily floor **and** above the max-drawdown floor.
5. Realised P&L today below the daily profit cap.
6. Inside the account's session window.
7. Not within ±15 min of a news time in today's plan.
8. Trade direction matches today's plan bias (plan "neutral" = stand aside).
9. Risk $ ≤ planned risk (+5% tolerance).
10. A+ gate 8/8 (7 ticks + R:R ≥ 1:3).

You may still override with a written reason (≥10 chars). The trade is tagged **Off-plan**, its breaches are stored, and your Discipline score drops — honesty over a clean-looking journal.

## Session windows (Q-zones)
Defined in New York time, so they shift automatically with US daylight saving:

| Window | New York | IST (until 1 Nov 2026) | IST (from 2 Nov) |
|---|---|---|---|
| Asia | 20:00–24:00 | 05:30–09:30 | 06:30–10:30 |
| London | 02:00–05:00 | 11:30–14:30 | 12:30–15:30 |
| New York | 07:00–10:00 | 16:30–19:30 | 17:30–20:30 |
