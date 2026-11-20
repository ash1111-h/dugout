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
