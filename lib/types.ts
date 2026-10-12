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
  /** Feelings logged across the trade (added in migration 0005; may be absent on older rows). */
  emotion_log?: EmotionEntry[];
  /** Pre-trade mental state ratings 1–5. */
  mental?: MentalState;
  created_at: string;
};

export type TradeStage = "pre" | "during" | "post";
export type EmotionEntry = { at: string; stage: TradeStage; emotions: string[]; intensity?: number; note?: string };
export type MentalState = { focus?: number; confidence?: number; stress?: number; energy?: number; patience?: number };
export const MENTAL_KEYS: { key: keyof MentalState; label: string; good: "high" | "low" }[] = [
  { key: "focus", label: "Focus", good: "high" },
  { key: "confidence", label: "Confidence", good: "high" },
  { key: "patience", label: "Patience", good: "high" },
  { key: "energy", label: "Energy", good: "high" },
  { key: "stress", label: "Stress", good: "low" },
];
/** Wider emotion vocabulary for the tracker; the original EMOTIONS stay valid. */
export const FEELINGS = {
  positive: ["Calm", "Confident", "Focused", "Patient", "Detached"],
  negative: ["Anxious", "Hesitant", "FOMO", "Greedy", "Fearful", "Frustrated", "Revenge", "Overconfident", "Impatient", "Bored", "Tired"],
} as const;
export const ALL_FEELINGS: string[] = [...FEELINGS.positive, ...FEELINGS.negative];

export type Checkin = {
  id: string;
  checkin_date: string;
  mood: number | null;
  energy: number | null;
  focus: number | null;
  stress: number | null;
  sleep_hours: number | null;
  emotions: string[];
  note: string | null;
};

export type Brief = { id: string; brief_date: string; kind: "outlook" | "brief" | "market" | "review"; content: Record<string, unknown>; model: string | null; created_at: string };

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
  /** Sessions chosen for this day; empty = use the account default. */
  sessions?: SessionName[];
  /** IST "HH:MM-HH:MM" used when sessions include "Custom". */
  custom_window?: string | null;
};

export type SessionName = "Asia" | "London" | "New York" | "Any" | "Custom";
export const SESSION_CHOICES: SessionName[] = ["Asia", "London", "New York", "Custom", "Any"];

export type Adjustment = { id: string; account_id: string; amount: number; at: string; note: string | null };

export type Lesson = {
  id: string;
  trade_id: string | null;
  account_id: string | null;
  instrument: string | null;
  kind: "loss" | "win" | "rule";
  title: string;
  cause: string | null;
  rule: string | null;
  tags: string[];
  source: "manual" | "auto" | "ai";
  active: boolean;
  created_at: string;
};

export type Reminder = {
  id: string;
  account_id: string | null;
  text: string;
  due_at: string;
  done: boolean;
  source: "manual" | "ai";
  created_at: string;
};

export type Memory = { id: string; kind: "fact" | "preference" | "goal" | "rule"; content: string; pinned: boolean; created_at: string };
export type Thread = { id: string; title: string; created_at: string; updated_at: string };
export type Message = { id: string; thread_id: string; role: "user" | "assistant"; content: string; meta: Record<string, unknown>; created_at: string };

/** Things the coach may propose; the user applies them with one tap. */
export type CoachAction =
  | { type: "save_plan"; account: string; fields: Partial<Pick<DayPlan, "bias" | "htf_range" | "magnet" | "invalidation" | "pois" | "notes" | "news_times" | "sessions" | "custom_window">> }
  | { type: "add_reminder"; text: string; due_at: string; account?: string }
  | { type: "remember"; content: string; kind?: Memory["kind"] }
  | { type: "add_lesson"; title: string; rule: string; cause?: string; account?: string }
  | { type: "draft_trade"; account?: string; fields: Record<string, unknown> };

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
