export type Tier = { min_equity: number; risk_pct: number; max_trades: number };

export type Account = {
  id: string;
  name: string;
  firm: string | null;
  instrument: string;
  kind: "challenge" | "funded" | "live" | "demo";
  status: "active" | "passed" | "failed" | "closed";
  starting_balance: number;
  target_pct: number | null;
  max_daily_loss_pct: number;
  max_overall_loss_pct: number;
  dd_type: "static" | "trailing";
  min_profitable_days: number;
  day_reset_utc: string; // "HH:MM:SS"
  contract_size: number;
  fee_rate: number;
  min_rr: number;
  max_trades_per_day: number;
  max_losses_per_day: number;
  personal_daily_loss_pct: number;
  hard_stop_equity: number | null;
  risk_ladder: Tier[];
  loss_streak_n: number | null;
  loss_streak_risk_pct: number | null;
  notes: string | null;
  max_daily_profit_pct: number;
  session_window: "London" | "New York" | "Asia" | "Any";
  created_at: string;
};

export type Setup = { id: string; name: string; model: string | null; rules: string | null; active: boolean };

export type Trade = {
  id: string;
  account_id: string;
  setup_id: string | null;
  status: "open" | "closed" | "cancelled";
  opened_at: string;
  closed_at: string | null;
  instrument: string;
  direction: "long" | "short";
  session: string | null;
  entry: number;
  sl: number;
  tp: number;
  exit: number | null;
  size: number | null;
  risk_usd: number;
  fees: number;
  gross_pnl: number | null;
  htf_aligned: boolean;
  correct_half: boolean;
  in_poi: boolean;
  liquidity_swept: boolean;
  market_shift: boolean;
  in_session: boolean;
  news_clear: boolean;
  poi_type: string | null;
  entry_model: string | null;
  invalidation: string | null;
  mistakes: string[];
  emotions: string[];
  review: string | null;
  chart_url: string | null;
  before_path: string | null;
  after_path: string | null;
  rr_planned: number | null;
  net_pnl: number | null;
  r_multiple: number | null;
  gate_score: number;
  planned_risk_usd: number | null;
  override_reason: string | null;
  guardrail_breaches: string[];
  created_at: string;
};

export type Payout = { id: string; account_id: string; amount: number; paid_at: string; note: string | null };

export type Review = {
  id: string;
  week_start: string;
  went_well: string | null;
  to_fix: string | null;
  rule_change: string | null;
  rating: number | null;
};

export type DayPlan = {
  id: string;
  account_id: string;
  plan_date: string;
  bias: "long" | "short" | "neutral" | null;
  htf_range: string | null;
  magnet: string | null;
  invalidation: string | null;
  pois: string | null;
  news_times: string[];
  checklist: Record<string, boolean>;
  notes: string | null;
};

export const PREMARKET = [
  { key: "calendar", label: "Checked the economic calendar and added news times" },
  { key: "range", label: "Marked HTF swing range (4H BTC / 1H gold)" },
  { key: "pd", label: "Premium / discount drawn — I know which side I may trade" },
  { key: "liquidity", label: "PDH / PDL and equal highs/lows marked" },
  { key: "narrative", label: "Continuation or pullback decided, invalidation written" },
  { key: "pois", label: "15M POIs marked from the extreme, alerts set" },
] as const;

export const GATE_CHECKS = [
  { key: "htf_aligned", label: "HTF aligned", hint: "1H/4H and 15M trend agree with the trade" },
  { key: "correct_half", label: "Correct half", hint: "Long in discount, short in premium" },
  { key: "in_poi", label: "Inside POI", hint: "Price is inside a trend-aligned 15M zone, not near it" },
  { key: "liquidity_swept", label: "Liquidity swept", hint: "Internal high/low, PDH/PDL or EQH/EQL taken" },
  { key: "market_shift", label: "Market shift", hint: "5M/1M body close beyond last LH (long) / HL (short)" },
  { key: "in_session", label: "In session", hint: "Inside your Q-zone window" },
  { key: "news_clear", label: "News clear", hint: "Outside ±15 min of high-impact news" },
] as const;

export type GateKey = (typeof GATE_CHECKS)[number]["key"];

export const POI_TYPES = ["Demand", "Supply", "Order Block", "FVG", "Flip zone"];
export const ENTRY_MODELS = ["Market Shift", "Flip zone", "Sweep→OB→FVG"];
export const SESSIONS = ["Asia", "London", "New York", "Off-session"];
export const MISTAKES = [
  "Early entry", "Chased entry", "No sweep", "Counter-bias", "Moved SL",
  "Oversized", "Cut winner early", "Overtrading", "Off-plan", "Revenge",
];
export const EMOTIONS = ["Calm", "Confident", "Hesitant", "FOMO", "Revenge", "Overconfident", "Tired"];
