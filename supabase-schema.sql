-- Dugout complete Supabase setup. Run once in Supabase SQL Editor.
-- Includes private per-user save/profile tables, RLS, and opt-in leaderboard RPC.
-- Uses only public browser access from the client; no secret key belongs in index.html.

-- Dugout account, private-save, and opt-in leaderboard schema
-- Run this entire file once in Supabase: SQL Editor -> New query -> Run.
-- This deliberately does NOT expose emails or private saves on the public leaderboard.

create table if not exists public.dugout_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 24),
  show_on_leaderboard boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.dugout_daily_saves (
  user_id uuid not null references auth.users (id) on delete cascade,
  puzzle_date date not null,
  start_player_id text not null check (char_length(start_player_id) between 2 and 20),
  target_player_id text not null check (char_length(target_player_id) between 2 and 20),
  game_state jsonb not null check (jsonb_typeof(game_state) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (user_id, puzzle_date),
  check (start_player_id <> target_player_id)
);

create table if not exists public.dugout_daily_results (
  user_id uuid not null references auth.users (id) on delete cascade,
  puzzle_date date not null,
  guesses_used smallint not null check (guesses_used between 0 and 6),
  hints integer not null default 0 check (hints between 0 and 1000),
  won boolean not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, puzzle_date),
  check ((won and guesses_used between 1 and 6) or (not won and guesses_used = 0))
);

create index if not exists dugout_daily_results_date_idx
  on public.dugout_daily_results (puzzle_date desc);
create index if not exists dugout_daily_results_user_date_idx
  on public.dugout_daily_results (user_id, puzzle_date desc);

-- Row Level Security: players may only read or change their own account records.
alter table public.dugout_profiles enable row level security;
alter table public.dugout_daily_saves enable row level security;
alter table public.dugout_daily_results enable row level security;

revoke all on table public.dugout_profiles from public, anon, authenticated;
revoke all on table public.dugout_daily_saves from public, anon, authenticated;
revoke all on table public.dugout_daily_results from public, anon, authenticated;

grant select, insert, update on table public.dugout_profiles to authenticated;
grant select, insert, update on table public.dugout_daily_saves to authenticated;
grant select, insert, update on table public.dugout_daily_results to authenticated;

drop policy if exists "Players can read their own Dugout profile" on public.dugout_profiles;
create policy "Players can read their own Dugout profile"
  on public.dugout_profiles for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Players can create their own Dugout profile" on public.dugout_profiles;
create policy "Players can create their own Dugout profile"
  on public.dugout_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Players can update their own Dugout profile" on public.dugout_profiles;
create policy "Players can update their own Dugout profile"
  on public.dugout_profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Players can read their own Dugout saves" on public.dugout_daily_saves;
drop policy if exists "Players can read their own current Dugout save" on public.dugout_daily_saves;
create policy "Players can read their own current Dugout save"
  on public.dugout_daily_saves for select to authenticated
  using (
    (select auth.uid()) = user_id
    and puzzle_date = (now() at time zone 'America/Los_Angeles')::date
  );

drop policy if exists "Players can create their own Dugout saves" on public.dugout_daily_saves;
drop policy if exists "Players can create their own current Dugout save" on public.dugout_daily_saves;
create policy "Players can create their own current Dugout save"
  on public.dugout_daily_saves for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and puzzle_date = (now() at time zone 'America/Los_Angeles')::date
  );

drop policy if exists "Players can update their own Dugout saves" on public.dugout_daily_saves;
drop policy if exists "Players can update their own current Dugout save" on public.dugout_daily_saves;
create policy "Players can update their own current Dugout save"
  on public.dugout_daily_saves for update to authenticated
  using (
    (select auth.uid()) = user_id
    and puzzle_date = (now() at time zone 'America/Los_Angeles')::date
  )
  with check (
    (select auth.uid()) = user_id
    and puzzle_date = (now() at time zone 'America/Los_Angeles')::date
  );

drop policy if exists "Players can read their own Dugout results" on public.dugout_daily_results;
create policy "Players can read their own Dugout results"
  on public.dugout_daily_results for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Players can create their own Dugout results" on public.dugout_daily_results;
drop policy if exists "Players can create their own non-future Dugout results" on public.dugout_daily_results;
create policy "Players can create their own non-future Dugout results"
  on public.dugout_daily_results for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and puzzle_date <= (now() at time zone 'America/Los_Angeles')::date
  );

drop policy if exists "Players can update their own Dugout results" on public.dugout_daily_results;
drop policy if exists "Players can update their own non-future Dugout results" on public.dugout_daily_results;
create policy "Players can update their own non-future Dugout results"
  on public.dugout_daily_results for update to authenticated
  using (
    (select auth.uid()) = user_id
    and puzzle_date <= (now() at time zone 'America/Los_Angeles')::date
  )
  with check (
    (select auth.uid()) = user_id
    and puzzle_date <= (now() at time zone 'America/Los_Angeles')::date
  );

-- Base setup complete. The combined supabase-schema.sql includes the leaderboard function next.


-- Dugout leaderboard RPC. Run after step 1 (tables and RLS) succeeds.
create or replace function public.dugout_leaderboard(p_mode text, p_puzzle_date date)
returns table (
  is_self boolean,
  display_name text,
  guesses_used integer,
  hints integer,
  won boolean,
  current_streak bigint,
  best_streak bigint,
  wins bigint
)
language sql
stable
security definer
set search_path = ''
as $dugout_fn$
  select
    p.user_id = (select auth.uid()),
    p.display_name,
    coalesce(today.guesses_used, 0)::integer,
    coalesce(today.hints, 0)::integer,
    coalesce(today.won, false),
    case when today.user_id is not null and today.won = false
      then 0::bigint else stats.current_streak end,
    stats.best_streak,
    stats.wins
  from public.dugout_profiles as p
  left join public.dugout_daily_results as today
    on today.user_id = p.user_id and today.puzzle_date = p_puzzle_date
  cross join lateral (
    with win_days as (
      select r.puzzle_date,
        r.puzzle_date - row_number() over (order by r.puzzle_date)::integer as grp
      from public.dugout_daily_results as r
      where r.user_id = p.user_id and r.won and r.puzzle_date <= p_puzzle_date
    ), streaks as (
      select grp, count(*)::bigint as len, max(puzzle_date) as last_day
      from win_days group by grp
    )
    select
      coalesce(max(len), 0)::bigint as best_streak,
      coalesce(max(len) filter (where last_day >= p_puzzle_date - 1), 0)::bigint as current_streak,
      (select count(*)::bigint from public.dugout_daily_results as r
        where r.user_id = p.user_id and r.won and r.puzzle_date <= p_puzzle_date) as wins
    from streaks
  ) as stats
  where p.show_on_leaderboard = true
    and (select auth.uid()) is not null
    and p_puzzle_date is not null
    and p_puzzle_date <= (now() at time zone 'America/Los_Angeles')::date
    and p_mode in ('today', 'streak')
    and (
      (p_mode = 'today' and today.user_id is not null)
      or (p_mode = 'streak' and exists (
        select 1 from public.dugout_daily_results as r
        where r.user_id = p.user_id and r.puzzle_date <= p_puzzle_date
      ))
    )
  order by
    case when p_mode = 'today' and today.won then 0
         when p_mode = 'today' then 1 end asc nulls last,
    case when p_mode = 'today' then today.guesses_used end asc nulls last,
    case when p_mode = 'today' then today.hints end asc nulls last,
    case when p_mode = 'streak' then
      case when today.user_id is not null and not today.won then 0
           else stats.current_streak end end desc nulls last,
    case when p_mode = 'streak' then stats.best_streak end desc nulls last,
    case when p_mode = 'streak' then stats.wins end desc nulls last,
    p.display_name asc
  limit 100;
$dugout_fn$;

revoke all on function public.dugout_leaderboard(text, date) from public, anon, authenticated;
grant execute on function public.dugout_leaderboard(text, date) to authenticated;
notify pgrst, 'reload schema';

-- ===== Dugout 3.0 hardening (applied to the live project 2026-11-22) =====
alter table public.dugout_daily_results
  add constraint dugout_results_win_consistent
  check ((won and guesses_used between 1 and 6) or (not won and guesses_used = 0));

create or replace function public.dugout_results_keep_first()
returns trigger language plpgsql set search_path = '' as $$
begin
  return old;  -- first write wins; upserts succeed but keep the original row
end $$;
revoke all on function public.dugout_results_keep_first() from public, anon, authenticated;
create trigger dugout_results_keep_first
  before update on public.dugout_daily_results
  for each row execute function public.dugout_results_keep_first();

create or replace function public.dugout_delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not signed in'; end if;
  delete from public.dugout_daily_results where user_id = uid;
  delete from public.dugout_daily_saves where user_id = uid;
  delete from public.dugout_profiles where user_id = uid;
  delete from auth.users where id = uid;
end $$;
revoke all on function public.dugout_delete_my_account() from public, anon;
grant execute on function public.dugout_delete_my_account() to authenticated;

-- ===== Football / basketball cloud tables (applied to the live project 2026-11-23) =====
-- dugout_sport_saves / dugout_sport_results (PK user_id, sport, puzzle_date; sport in football|basketball),
-- same RLS pattern and win-consistency check as baseball, first-write-wins trigger,
-- dugout_sport_leaderboard(p_sport, p_mode, p_puzzle_date), and dugout_delete_my_account() extended to clear them.
-- The full SQL is recorded in the Supabase migration "dugout_sport_tables_and_leaderboard".
