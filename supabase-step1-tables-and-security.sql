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

-- Base setup complete. Run supabase-step2-leaderboard.sql next.
