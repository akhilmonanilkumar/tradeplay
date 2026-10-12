-- Tradeplay schema — mirrors the 4 migrations applied to Supabase project `trade-journal`
-- (init_journal_schema, guardrails_and_discipline, day_plans, single_user_hardening).
-- Run top-to-bottom in the Supabase SQL editor to rebuild from scratch.
-- Change the owner email in section 4 before running on a new project.

------------------------------------------------------------------------
-- 1. Core tables
------------------------------------------------------------------------
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  firm text,
  instrument text not null,
  kind text not null default 'challenge' check (kind in ('challenge','funded','live','demo')),
  status text not null default 'active' check (status in ('active','passed','failed','closed')),
  starting_balance numeric not null check (starting_balance > 0),
  target_pct numeric,
  max_daily_loss_pct numeric not null,
  max_overall_loss_pct numeric not null,
  dd_type text not null default 'static' check (dd_type in ('static','trailing')),
  min_profitable_days int not null default 0,
  day_reset_utc time not null default '00:00',
  contract_size numeric not null default 1,
  fee_rate numeric not null default 0,
  min_rr numeric not null default 3,
  max_trades_per_day int not null default 2,
  max_losses_per_day int not null default 2,
  personal_daily_loss_pct numeric not null default 1,
  hard_stop_equity numeric,
  risk_ladder jsonb not null default '[]'::jsonb,
  loss_streak_n int,
  loss_streak_risk_pct numeric,
  notes text,
  max_daily_profit_pct numeric not null default 3,
  session_window text not null default 'New York' check (session_window in ('London','New York','Asia','Any')),
  created_at timestamptz not null default now(),
  constraint accounts_pct_ranges check (
    max_daily_loss_pct between 0 and 100 and max_overall_loss_pct between 0 and 100
    and personal_daily_loss_pct between 0 and 100 and max_daily_profit_pct between 0 and 1000
    and fee_rate between 0 and 0.05 and contract_size > 0 and min_rr >= 0
  ),
  constraint accounts_text_len check (length(name) <= 120 and coalesce(length(notes), 0) <= 4000)
);

create table public.setups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  model text,
  rules text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  setup_id uuid references public.setups(id) on delete set null,
  status text not null default 'open' check (status in ('open','closed','cancelled')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  instrument text not null,
  direction text not null check (direction in ('long','short')),
  session text,
  entry numeric not null,
  sl numeric not null,
  tp numeric not null,
  exit numeric,
  size numeric,
  risk_usd numeric not null check (risk_usd > 0),
  fees numeric not null default 0,
  gross_pnl numeric,
  htf_aligned boolean not null default false,
  correct_half boolean not null default false,
  in_poi boolean not null default false,
  liquidity_swept boolean not null default false,
  market_shift boolean not null default false,
  in_session boolean not null default false,
  news_clear boolean not null default false,
  poi_type text,
  entry_model text,
  invalidation text,
  mistakes text[] not null default '{}',
  emotions text[] not null default '{}',
  review text,
  chart_url text,
  before_path text,
  after_path text,
  planned_risk_usd numeric,
  override_reason text,
  guardrail_breaches text[] not null default '{}',
  rr_planned numeric generated always as (
    case when entry <> sl then round(abs(tp - entry) / abs(entry - sl), 2) end
  ) stored,
  net_pnl numeric generated always as (gross_pnl - fees) stored,
  r_multiple numeric generated always as (
    case when gross_pnl is not null then round((gross_pnl - fees) / risk_usd, 2) end
  ) stored,
  gate_score int generated always as (
    htf_aligned::int + correct_half::int + in_poi::int + liquidity_swept::int
    + market_shift::int + in_session::int + news_clear::int
    + (case when entry <> sl and abs(tp - entry) / abs(entry - sl) >= 3 then 1 else 0 end)
  ) stored,
  created_at timestamptz not null default now(),
  constraint trades_text_len check (
    coalesce(length(review), 0) <= 5000 and coalesce(length(invalidation), 0) <= 500
    and coalesce(length(override_reason), 0) <= 1000 and coalesce(length(chart_url), 0) <= 500
  ),
  constraint trades_chart_url_https check (chart_url is null or chart_url ~ '^https://'),
  constraint trades_levels_positive check (entry > 0 and sl > 0 and tp > 0),
  constraint trades_size_nonneg check (size is null or size >= 0),
  constraint trades_fees_nonneg check (fees >= 0)
);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  amount numeric not null check (amount > 0),
  paid_at date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  week_start date not null,
  went_well text,
  to_fix text,
  rule_change text,
  rating int check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  unique (user_id, week_start),
  constraint reviews_text_len check (
    coalesce(length(went_well), 0) <= 4000 and coalesce(length(to_fix), 0) <= 4000 and coalesce(length(rule_change), 0) <= 4000
  )
);

create table public.day_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  plan_date date not null,
  bias text check (bias in ('long','short','neutral')),
  htf_range text,
  magnet text,
  invalidation text,
  pois text,
  news_times text[] not null default '{}',
  checklist jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  unique (account_id, plan_date),
  constraint day_plans_text_len check (
    coalesce(length(notes), 0) <= 4000 and coalesce(length(pois), 0) <= 2000 and coalesce(length(invalidation), 0) <= 500
    and cardinality(news_times) <= 12
  )
);

create index on public.accounts (user_id);
create index on public.setups (user_id);
create index on public.trades (user_id, opened_at desc);
create index on public.trades (account_id, opened_at desc);
create index on public.trades (setup_id);
create index on public.payouts (account_id);
create index on public.reviews (user_id, week_start desc);
create index on public.day_plans (user_id, plan_date desc);

------------------------------------------------------------------------
-- 2. Row level security: every row is visible/editable by its owner only
------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['accounts','setups','trades','payouts','reviews','day_plans'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows select" on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy "own rows insert" on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy "own rows update" on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create policy "own rows delete" on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end $$;

revoke all on public.accounts, public.setups, public.trades, public.payouts, public.reviews, public.day_plans from anon;

------------------------------------------------------------------------
-- 3. Private screenshot storage (images only, 5 MB, files under <user_id>/...)
------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('screenshots', 'screenshots', false, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "own screenshots select" on storage.objects for select to authenticated
  using (bucket_id = 'screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own screenshots insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own screenshots update" on storage.objects for update to authenticated
  using (bucket_id = 'screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own screenshots delete" on storage.objects for delete to authenticated
  using (bucket_id = 'screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text);

------------------------------------------------------------------------
-- 4. Single-user lock: only the owner email can ever be created in auth.users
------------------------------------------------------------------------
create table public.app_owner (
  id boolean primary key default true check (id),
  email text not null
);
alter table public.app_owner enable row level security; -- intentionally no policies
revoke all on public.app_owner from anon, authenticated;
insert into public.app_owner (email) values ('akhilcubet@gmail.com'); -- ← change for a new owner

create or replace function public.enforce_single_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
declare owner_email text;
begin
  select email into owner_email from public.app_owner where id;
  if owner_email is null or lower(new.email) <> lower(owner_email) then
    raise exception 'Sign-ups are closed for this app';
  end if;
  return new;
end;
$$;
revoke execute on function public.enforce_single_owner() from public, anon, authenticated;

create trigger enforce_single_owner
  before insert on auth.users
  for each row execute function public.enforce_single_owner();

------------------------------------------------------------------------
-- 5. One-click seed for the signed-in user (accounts + setups)
------------------------------------------------------------------------
create or replace function public.seed_my_defaults()
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if exists (select 1 from public.accounts where user_id = (select auth.uid())) then
    return;
  end if;

  insert into public.accounts (name, firm, instrument, kind, starting_balance, target_pct,
    max_daily_loss_pct, max_overall_loss_pct, dd_type, min_profitable_days, day_reset_utc,
    contract_size, fee_rate, min_rr, max_trades_per_day, max_losses_per_day,
    personal_daily_loss_pct, hard_stop_equity, risk_ladder, loss_streak_n, loss_streak_risk_pct, notes)
  values
  ('FundedHive 25K PFP', 'FundedHive', 'XAUUSD', 'challenge', 25000, 10,
    5, 10, 'static', 3, '00:00',
    100, 0, 3, 2, 2,
    1, 23750,
    '[{"min_equity":24500,"risk_pct":0.5,"max_trades":2},{"min_equity":23750,"risk_pct":0.25,"max_trades":2}]'::jsonb,
    2, 0.25,
    'Phase 1. Firm: 10% target, 5% daily (EOD), 10% static, 3% max per trade, 3 profitable days, 1:50. Set the daily reset to your broker server midnight in UTC.'),
  ('Breakout 5K Funded', 'Breakout', 'BTCUSDT.P', 'funded', 5000, null,
    3, 3, 'static', 0, '00:30',
    1, 0.0008, 3, 2, 2,
    1, 4880,
    '[{"min_equity":5150,"risk_pct":0.75,"max_trades":2},{"min_equity":5000,"risk_pct":0.5,"max_trades":2},{"min_equity":4925,"risk_pct":0.25,"max_trades":2},{"min_equity":4880,"risk_pct":0.25,"max_trades":1}]'::jsonb,
    null, null,
    'Static floor $4,850. Daily 3% of opening balance, resets 00:30 UTC (06:00 IST). Fees 0.04%/side. Payouts need no open positions.');

  insert into public.setups (name, model, rules) values
  ('Market Shift → Pullback', 'Market Shift', 'Sweep at 15M POI → 5M body close beyond last LH/HL → limit at the 5M zone that caused the shift. No pullback = no trade.'),
  ('Flip Zone', 'Flip zone', 'Opposing LTF zone fails → shift → enter on pullback to flip zone. If flip + extreme zone both exist, use the extreme.'),
  ('Sweep → OB → FVG', 'Sweep→OB→FVG', 'After sweep + shift, mark the OB that started the move; limit at the FVG inside/next to it for a tighter stop.');
end;
$$;

revoke execute on function public.seed_my_defaults() from public, anon;
grant execute on function public.seed_my_defaults() to authenticated;
