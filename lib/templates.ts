import type { Account, Tier } from "./types";

/** Starting points for a new trader's first account. Every field stays editable under Accounts. */
export type AccountTemplate = {
  id: string;
  label: string;
  blurb: string;
  row: Partial<Account> & { name: string; instrument: string; starting_balance: number; risk_ladder: Tier[] };
};

const ladder = (bal: number, base: number): Tier[] => [
  { min_equity: Math.round(bal * 1.03), risk_pct: base * 1.5, max_trades: 2 },
  { min_equity: bal, risk_pct: base, max_trades: 2 },
  { min_equity: Math.round(bal * 0.97), risk_pct: base / 2, max_trades: 2 },
  { min_equity: Math.round(bal * 0.94), risk_pct: base / 4, max_trades: 1 },
];

export const ACCOUNT_TEMPLATES: AccountTemplate[] = [
  {
    id: "gold-challenge",
    label: "Gold prop challenge",
    blurb: "XAUUSD · 10% target · 5% daily / 10% max loss · 0.5% risk",
    row: {
      name: "Gold challenge", firm: null, instrument: "XAUUSD", kind: "challenge", starting_balance: 25000, target_pct: 10,
      max_daily_loss_pct: 5, max_overall_loss_pct: 10, dd_type: "static", min_profitable_days: 3, day_reset_utc: "00:00",
      contract_size: 100, fee_rate: 0, min_rr: 3, max_trades_per_day: 2, max_losses_per_day: 2, personal_daily_loss_pct: 1,
      risk_ladder: ladder(25000, 0.5), loss_streak_n: 2, loss_streak_risk_pct: 0.25, session_window: "London",
    },
  },
  {
    id: "btc-funded",
    label: "BTC funded account",
    blurb: "BTCUSDT perp · 3% daily / 6% max loss · fees 0.04%/side",
    row: {
      name: "BTC funded", firm: null, instrument: "BTCUSDT.P", kind: "funded", starting_balance: 10000, target_pct: null,
      max_daily_loss_pct: 3, max_overall_loss_pct: 6, dd_type: "static", min_profitable_days: 0, day_reset_utc: "00:00",
      contract_size: 1, fee_rate: 0.0008, min_rr: 3, max_trades_per_day: 2, max_losses_per_day: 2, personal_daily_loss_pct: 1,
      risk_ladder: ladder(10000, 0.5), loss_streak_n: 2, loss_streak_risk_pct: 0.25, session_window: "New York",
    },
  },
  {
    id: "forex-personal",
    label: "Personal / live account",
    blurb: "Any pair · your own capital · 1% risk · 3% daily stop",
    row: {
      name: "Personal account", firm: null, instrument: "EURUSD", kind: "live", starting_balance: 5000, target_pct: null,
      max_daily_loss_pct: 3, max_overall_loss_pct: 20, dd_type: "static", min_profitable_days: 0, day_reset_utc: "00:00",
      contract_size: 100000, fee_rate: 0, min_rr: 2, max_trades_per_day: 3, max_losses_per_day: 2, personal_daily_loss_pct: 2,
      risk_ladder: [{ min_equity: 0, risk_pct: 1, max_trades: 3 }], loss_streak_n: 3, loss_streak_risk_pct: 0.5, session_window: "Any",
    },
  },
];

export const DEFAULT_SETUPS = [
  { name: "Market Shift → Pullback", model: "Market Shift", rules: "Sweep at 15M POI → 5M body close beyond last LH/HL → limit at the 5M zone that caused the shift. No pullback = no trade." },
  { name: "Flip Zone", model: "Flip zone", rules: "Opposing LTF zone fails → shift → enter on pullback to flip zone. If flip + extreme zone both exist, use the extreme." },
  { name: "Sweep → OB → FVG", model: "Sweep→OB→FVG", rules: "After sweep + shift, mark the OB that started the move; limit at the FVG inside/next to it for a tighter stop." },
];

export const INSTRUMENTS: { symbol: string; contract: number; note: string }[] = [
  { symbol: "XAUUSD", contract: 100, note: "Gold · 100 oz/lot" },
  { symbol: "BTCUSDT.P", contract: 1, note: "Bitcoin perp · 1 BTC" },
  { symbol: "BTCUSD", contract: 1, note: "Bitcoin CFD · 1 BTC" },
  { symbol: "EURUSD", contract: 100000, note: "Forex · 100k/lot" },
  { symbol: "GBPUSD", contract: 100000, note: "Forex · 100k/lot" },
  { symbol: "NAS100", contract: 1, note: "Nasdaq CFD · $1/pt" },
];
