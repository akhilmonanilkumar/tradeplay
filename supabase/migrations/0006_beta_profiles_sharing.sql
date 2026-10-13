-- 0006 beta_profiles_sharing
-- Closed-beta signup with an access code, public profiles, shareable trades, leaderboard,
-- one shared AI outlook per day (1 refresh per trader per day), plan screenshots.
-- Safe to run once; everything is additive.

create extension if not exists pgcrypto with schema extensions;

------------------------------------------------------------------------
-- 1. Closed beta: access codes + allowed emails (both invisible to clients)
------------------------------------------------------------------------
create table if not exists public.beta_codes (
  code_hash text primary key,                -- bcrypt hash, the code itself is never stored
  label text not null,
  max_uses int not null default 500,
  uses int not null default 0,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.beta_access (
  email text primary key,
  code_label text,
  created_at timestamptz not null default now()
);
alter table public.beta_codes enable row level security;
alter table public.beta_access enable row level security;
revoke all on public.beta_codes, public.beta_access from anon, authenticated;

insert into public.beta_codes (code_hash, label, max_uses)
select extensions.crypt('playtrader26', extensions.gen_salt('bf', 10)), 'Closed beta 2026', 500
where not exists (select 1 from public.beta_codes where label = 'Closed beta 2026');

-- Called from the login page (anon). Checks the code, then allows that email to sign up.
create or replace function public.redeem_beta_code(p_email text, p_code text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  e text := lower(trim(coalesce(p_email, '')));
  c public.beta_codes%rowtype;
begin
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(e) > 254 then
    raise exception 'Enter a valid email address';
  end if;
  if exists (select 1 from public.beta_access where email = e)
     or exists (select 1 from public.app_owner where lower(email) = e) then
    return 'ok';
  end if;
  select * into c from public.beta_codes b
  where b.active and b.uses < b.max_uses and (b.expires_at is null or b.expires_at > now())
    and b.code_hash = extensions.crypt(coalesce(p_code, ''), b.code_hash)
  limit 1;
  if not found then
    perform pg_sleep(0.5);                   -- slow down guessing
    raise exception 'That access code is not valid';
  end if;
  insert into public.beta_access (email, code_label) values (e, c.label) on conflict do nothing;
  update public.beta_codes set uses = uses + 1 where code_hash = c.code_hash;
  return 'ok';
end;
$$;
revoke execute on function public.redeem_beta_code(text, text) from public;
grant execute on function public.redeem_beta_code(text, text) to anon, authenticated;

-- Sign-up gate: the owner, or anyone who redeemed a beta code with that email.
create or replace function public.enforce_single_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
declare owner_email text;
begin
  select email into owner_email from public.app_owner where id;
  if (owner_email is not null and lower(new.email) = lower(owner_email))
     or exists (select 1 from public.beta_access a where a.email = lower(new.email)) then
    return new;
  end if;
  raise exception 'Sign-ups are invite-only during the closed beta';
end;
$$;
revoke execute on function public.enforce_single_owner() from public, anon, authenticated;

------------------------------------------------------------------------
-- 2. Profiles (avatar, names, socials, timezone, public/leaderboard opt-in)
------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  username text unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text check (coalesce(length(display_name), 0) <= 40),
  avatar text not null default 'a1' check (avatar ~ '^a[0-9]{1,2}$'),
  bio text check (coalesce(length(bio), 0) <= 280),
  socials jsonb not null default '{}'::jsonb check (jsonb_typeof(socials) = 'object'),
  timezone text not null default 'Asia/Kolkata' check (length(timezone) between 3 and 64),
  is_public boolean not null default false,
  on_leaderboard boolean not null default false,
  show_usd boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own rows select" on public.profiles for select to authenticated using (user_id = (select auth.uid()));
create policy "own rows insert" on public.profiles for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own rows update" on public.profiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows delete" on public.profiles for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.profiles from anon;

-- Username availability check without exposing other profiles.
create or replace function public.username_available(p_username text)
returns boolean language sql stable security definer set search_path = '' as $$
  select lower(p_username) ~ '^[a-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles where username = lower(p_username) and user_id <> auth.uid());
$$;
revoke execute on function public.username_available(text) from public, anon;
grant execute on function public.username_available(text) to authenticated;

------------------------------------------------------------------------
-- 3. Shareable trades + plan screenshots
------------------------------------------------------------------------
alter table public.trades add column if not exists share_id uuid unique;
alter table public.day_plans add column if not exists images text[] not null default '{}';
alter table public.day_plans drop constraint if exists day_plans_images_max;
alter table public.day_plans add constraint day_plans_images_max check (cardinality(images) <= 6);

------------------------------------------------------------------------
-- 4. Public read-only views of opted-in data (security definer, aggregated)
------------------------------------------------------------------------
create or replace function public.trader_stats(p_user uuid, p_since timestamptz default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  with t as (
    select * from public.trades
    where user_id = p_user and status = 'closed' and r_multiple is not null
      and (p_since is null or coalesce(closed_at, opened_at) >= p_since)
  ), s as (
    select count(*) n,
           count(*) filter (where net_pnl > 0) wins,
           coalesce(sum(r_multiple), 0) total_r,
           coalesce(avg(r_multiple), 0) avg_r,
           coalesce(sum(r_multiple) filter (where r_multiple > 0), 0) gw,
           coalesce(-sum(r_multiple) filter (where r_multiple < 0), 0) gl,
           coalesce(max(r_multiple), 0) best_r,
           coalesce(sum(net_pnl), 0) net,
           count(*) filter (where gate_score = 8 and override_reason is null) aplus,
           count(*) filter (where created_at - opened_at < interval '30 minutes') live
    from t
  )
  select jsonb_build_object(
    'trades', n, 'win_rate', case when n > 0 then round(wins::numeric / n, 3) else 0 end,
    'total_r', round(total_r, 2), 'avg_r', round(avg_r, 3),
    'profit_factor', case when gl > 0 then round(gw / gl, 2) else null end,
    'best_r', round(best_r, 2), 'net', round(net, 2),
    'aplus_rate', case when n > 0 then round(aplus::numeric / n, 3) else 0 end,
    'live_logged', case when n > 0 then round(live::numeric / n, 3) else 0 end
  ) from s;
$$;
revoke execute on function public.trader_stats(uuid, timestamptz) from public, anon, authenticated;

create or replace function public.public_profile(p_username text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare p public.profiles%rowtype; st jsonb; curve jsonb; months jsonb;
begin
  select * into p from public.profiles where username = lower(p_username) and is_public;
  if not found then return null; end if;
  st := public.trader_stats(p.user_id, null);
  select coalesce(jsonb_agg(jsonb_build_object('t', d, 'r', round(cum, 2)) order by d), '[]'::jsonb) into curve from (
    select d, sum(r) over (order by d) cum from (
      select date_trunc('day', coalesce(closed_at, opened_at)) d, sum(r_multiple) r
      from public.trades where user_id = p.user_id and status = 'closed' and r_multiple is not null
      group by 1) x) y;
  select coalesce(jsonb_agg(jsonb_build_object('m', m, 'r', round(r, 2), 'n', n, 'net', case when p.show_usd then round(net, 2) end) order by m desc), '[]'::jsonb) into months from (
    select to_char(date_trunc('month', coalesce(closed_at, opened_at)), 'YYYY-MM') m, sum(r_multiple) r, count(*) n, sum(net_pnl) net
    from public.trades where user_id = p.user_id and status = 'closed' and r_multiple is not null
    group by 1 order by 1 desc limit 12) z;
  if not p.show_usd then st := st - 'net'; end if;
  return jsonb_build_object(
    'username', p.username, 'display_name', p.display_name, 'avatar', p.avatar, 'bio', p.bio,
    'socials', p.socials, 'joined', p.created_at, 'show_usd', p.show_usd,
    'stats', st, 'stats_30d', public.trader_stats(p.user_id, now() - interval '30 days') - case when p.show_usd then '' else 'net' end,
    'curve', curve, 'months', months);
end;
$$;
revoke execute on function public.public_profile(text) from public;
grant execute on function public.public_profile(text) to anon, authenticated;

create or replace function public.public_trade(p_share uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'instrument', t.instrument, 'direction', t.direction, 'status', t.status,
    'opened_at', t.opened_at, 'closed_at', t.closed_at, 'session', t.session,
    'entry', t.entry, 'sl', t.sl, 'tp', t.tp, 'exit', t.exit,
    'rr_planned', t.rr_planned, 'r_multiple', t.r_multiple, 'gate_score', t.gate_score,
    'poi_type', t.poi_type, 'entry_model', t.entry_model,
    'net_pnl', case when coalesce(p.show_usd, false) then t.net_pnl end,
    'live_logged', (t.created_at - t.opened_at) < interval '30 minutes',
    'logged_at', t.created_at,
    'trader', case when p.is_public then jsonb_build_object('username', p.username, 'display_name', p.display_name, 'avatar', p.avatar) end
  )
  from public.trades t left join public.profiles p on p.user_id = t.user_id
  where t.share_id = p_share and p_share is not null;
$$;
revoke execute on function public.public_trade(uuid) from public;
grant execute on function public.public_trade(uuid) to anon, authenticated;

create or replace function public.leaderboard(p_period text default '30d', p_limit int default 50)
returns table (rank bigint, username text, display_name text, avatar text, trades int, total_r numeric, win_rate numeric, avg_r numeric, aplus_rate numeric, live_logged numeric)
language sql stable security definer set search_path = '' as $$
  with since as (select case p_period when '7d' then now() - interval '7 days' when '30d' then now() - interval '30 days'
                                      when '90d' then now() - interval '90 days' else null end as ts),
  rows as (
    select p.username, p.display_name, p.avatar, public.trader_stats(p.user_id, (select ts from since)) s
    from public.profiles p where p.is_public and p.on_leaderboard and p.username is not null)
  select row_number() over (order by (s->>'total_r')::numeric desc, (s->>'avg_r')::numeric desc),
         username, display_name, avatar, (s->>'trades')::int, (s->>'total_r')::numeric, (s->>'win_rate')::numeric,
         (s->>'avg_r')::numeric, (s->>'aplus_rate')::numeric, (s->>'live_logged')::numeric
  from rows where (s->>'trades')::int >= 5
  order by 1 limit least(greatest(p_limit, 1), 100);
$$;
revoke execute on function public.leaderboard(text, int) from public;
grant execute on function public.leaderboard(text, int) to anon, authenticated;

------------------------------------------------------------------------
-- 5. One shared AI outlook per day; each trader may force one refresh per day
------------------------------------------------------------------------
create table if not exists public.shared_briefs (
  brief_date date not null,
  kind text not null check (kind in ('outlook')),
  content jsonb not null,
  model text,
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (brief_date, kind)
);
alter table public.shared_briefs enable row level security;
create policy "signed-in read" on public.shared_briefs for select to authenticated using (true);
revoke all on public.shared_briefs from anon;
revoke insert, update, delete on public.shared_briefs from authenticated;

create table if not exists public.brief_refreshes (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  brief_date date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, brief_date)
);
alter table public.brief_refreshes enable row level security;
create policy "own rows select" on public.brief_refreshes for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.brief_refreshes from anon;
revoke insert, update, delete on public.brief_refreshes from authenticated;

-- Use your one refresh for the day (returns false if already used).
create or replace function public.claim_brief_refresh(p_date date)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.brief_refreshes (user_id, brief_date) values (auth.uid(), p_date) on conflict do nothing;
  return found;
end;
$$;

-- Store today's shared outlook: allowed if none exists yet, or if the caller claimed today's refresh.
create or replace function public.put_shared_brief(p_date date, p_kind text, p_content jsonb, p_model text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if jsonb_typeof(p_content) <> 'object' or length(p_content::text) > 20000 then raise exception 'invalid outlook'; end if;
  if p_date not between current_date - 1 and current_date + 1 then raise exception 'invalid date'; end if;
  if exists (select 1 from public.shared_briefs where brief_date = p_date and kind = p_kind)
     and not exists (select 1 from public.brief_refreshes where user_id = auth.uid() and brief_date = p_date) then
    raise exception 'today''s outlook already exists';
  end if;
  insert into public.shared_briefs (brief_date, kind, content, model, created_by, updated_at)
  values (p_date, p_kind, p_content, p_model, auth.uid(), now())
  on conflict (brief_date, kind) do update set content = excluded.content, model = excluded.model, created_by = excluded.created_by, updated_at = now();
end;
$$;
revoke execute on function public.claim_brief_refresh(date), public.put_shared_brief(date, text, jsonb, text) from public, anon;
grant execute on function public.claim_brief_refresh(date), public.put_shared_brief(date, text, jsonb, text) to authenticated;
