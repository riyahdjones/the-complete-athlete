create table if not exists public.game_day_sessions (
  id uuid primary key,
  athlete_user_id uuid not null references public.profiles(id) on delete cascade,
  sport text not null,
  opponent_name text,
  event_time text,
  started_at timestamptz not null default now(),
  question_ids text[] not null default '{}',
  responses jsonb not null default '[]'::jsonb,
  pregame_completed_at timestamptz,
  visualization_completed boolean not null default false,
  visualization_completed_at timestamptz,
  locked_in_at timestamptz,
  reflection jsonb,
  reflection_completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists game_day_sessions_athlete_started_idx
  on public.game_day_sessions (athlete_user_id, started_at desc);

alter table public.game_day_sessions enable row level security;

drop policy if exists "Athletes manage their game day sessions" on public.game_day_sessions;
create policy "Athletes manage their game day sessions"
on public.game_day_sessions for all
to authenticated
using ((select auth.uid()) = athlete_user_id)
with check ((select auth.uid()) = athlete_user_id);

grant select, insert, update, delete on public.game_day_sessions to authenticated;
