-- 0005 sessions_coach: per-plan sessions, balance adjustments, lessons, reminders,
-- and the AI coach's threads, memory and knowledgebase. Owner-only RLS on everything.

------------------------------------------------------------------------
-- Day plan picks which session(s) to trade, per account per day
------------------------------------------------------------------------
alter table public.day_plans
  add column if not exists sessions text[] not null default '{}',
  add column if not exists custom_window text;

alter table public.day_plans
  add constraint day_plans_sessions_valid check (
    sessions <@ array['Asia','London','New York','Any','Custom']::text[] and cardinality(sessions) <= 5
  ),
  add constraint day_plans_custom_window_fmt check (
    custom_window is null or custom_window ~ '^([01][0-9]|2[0-3]):[0-5][0-9]-([01][0-9]|2[0-3]):[0-5][0-9]$'
  );

------------------------------------------------------------------------
-- Balance adjustments: deposits, corrections, "sync to broker" (signed)
------------------------------------------------------------------------
create table if not exists public.balance_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  amount numeric not null check (amount <> 0 and abs(amount) < 1e9),
  at timestamptz not null default now(),
  note text check (coalesce(length(note), 0) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists balance_adjustments_account_idx on public.balance_adjustments (account_id, at);
create index if not exists balance_adjustments_user_idx on public.balance_adjustments (user_id);

------------------------------------------------------------------------
-- Lessons: causes found in wins/losses, and the rule not to repeat
------------------------------------------------------------------------
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trade_id uuid references public.trades(id) on delete set null,
  account_id uuid references public.accounts(id) on delete cascade,
  instrument text,
  kind text not null default 'loss' check (kind in ('loss','win','rule')),
  title text not null check (length(title) between 1 and 200),
  cause text check (coalesce(length(cause), 0) <= 2000),
  rule text check (coalesce(length(rule), 0) <= 500),
  tags text[] not null default '{}' check (cardinality(tags) <= 12),
  source text not null default 'manual' check (source in ('manual','auto','ai')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists lessons_user_idx on public.lessons (user_id, active, created_at desc);
create index if not exists lessons_trade_idx on public.lessons (trade_id);
create index if not exists lessons_account_idx on public.lessons (account_id);

------------------------------------------------------------------------
-- Reminders (manual or proposed by the coach)
------------------------------------------------------------------------
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete cascade,
  text text not null check (length(text) between 1 and 300),
  due_at timestamptz not null,
  done boolean not null default false,
  source text not null default 'manual' check (source in ('manual','ai')),
  created_at timestamptz not null default now()
);
create index if not exists reminders_user_idx on public.reminders (user_id, done, due_at);
create index if not exists reminders_account_idx on public.reminders (account_id);

------------------------------------------------------------------------
-- Coach: threads, messages, memory, knowledgebase (full-text search)
------------------------------------------------------------------------
create table if not exists public.ai_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default 'New conversation' check (length(title) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_threads_user_idx on public.ai_threads (user_id, updated_at desc);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  thread_id uuid not null references public.ai_threads(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null check (length(content) <= 40000),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ai_messages_thread_idx on public.ai_messages (thread_id, created_at);
create index if not exists ai_messages_user_idx on public.ai_messages (user_id);

create table if not exists public.ai_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null default 'fact' check (kind in ('fact','preference','goal','rule')),
  content text not null check (length(content) between 1 and 1000),
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists ai_memory_user_idx on public.ai_memory (user_id, created_at desc);

create table if not exists public.kb_docs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(title) between 1 and 200),
  source text check (coalesce(length(source), 0) <= 300),
  chunk int not null default 0,
  content text not null check (length(content) <= 12000),
  fts tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', content), 'B')
  ) stored,
  created_at timestamptz not null default now()
);
create index if not exists kb_docs_user_idx on public.kb_docs (user_id, title, chunk);
create index if not exists kb_docs_fts_idx on public.kb_docs using gin (fts);

-- Ranked search over the caller's own documents (RLS applies: security invoker).
create or replace function public.kb_search(q text, n int default 6)
returns table (id uuid, title text, source text, chunk int, content text, rank real)
language sql stable security invoker set search_path = '' as $$
  select d.id, d.title, d.source, d.chunk, d.content,
         ts_rank_cd(d.fts, websearch_to_tsquery('english', q)) as rank
  from public.kb_docs d
  where d.fts @@ websearch_to_tsquery('english', q)
  order by rank desc
  limit least(greatest(n, 1), 20);
$$;
revoke execute on function public.kb_search(text, int) from public, anon;
grant execute on function public.kb_search(text, int) to authenticated;


------------------------------------------------------------------------
-- Emotion & mental state across the trade: pre / during / post
------------------------------------------------------------------------
alter table public.trades
  add column if not exists emotion_log jsonb not null default '[]'::jsonb,
  add column if not exists mental jsonb not null default '{}'::jsonb;
alter table public.trades
  add constraint trades_emotion_log_shape check (jsonb_typeof(emotion_log) = 'array' and jsonb_array_length(emotion_log) <= 50),
  add constraint trades_mental_shape check (jsonb_typeof(mental) = 'object');

-- Daily check-in: how you show up before the session
create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  checkin_date date not null,
  mood int check (mood between 1 and 5),
  energy int check (energy between 1 and 5),
  focus int check (focus between 1 and 5),
  stress int check (stress between 1 and 5),
  sleep_hours numeric check (sleep_hours between 0 and 24),
  emotions text[] not null default '{}' check (cardinality(emotions) <= 12),
  note text check (coalesce(length(note), 0) <= 2000),
  created_at timestamptz not null default now(),
  unique (user_id, checkin_date)
);
create index if not exists checkins_user_idx on public.checkins (user_id, checkin_date desc);

-- Cached AI outputs (morning outlook, market insights) — one per kind per day
create table if not exists public.daily_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  brief_date date not null,
  kind text not null check (kind in ('outlook','brief','market','review')),
  content jsonb not null,
  model text,
  created_at timestamptz not null default now(),
  unique (user_id, brief_date, kind)
);
create index if not exists daily_briefs_user_idx on public.daily_briefs (user_id, brief_date desc);

------------------------------------------------------------------------
-- RLS: owner-only, same four policies as every other table
------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['balance_adjustments','lessons','reminders','ai_threads','ai_messages','ai_memory','kb_docs','checkins','daily_briefs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows select" on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy "own rows insert" on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy "own rows update" on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create policy "own rows delete" on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- A message may only be added to one of your own threads.
create or replace function public.ai_messages_own_thread()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.ai_threads t where t.id = new.thread_id and t.user_id = new.user_id) then
    raise exception 'thread not found';
  end if;
  return new;
end;
$$;
drop trigger if exists ai_messages_own_thread on public.ai_messages;
create trigger ai_messages_own_thread before insert or update on public.ai_messages
  for each row execute function public.ai_messages_own_thread();
