create table if not exists public.coach_sessions (
  id text primary key,
  athlete_user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default '',
  session_date date not null default current_date,
  session_time text not null default '',
  messages jsonb not null default '[]'::jsonb,
  safety text not null default 'ok',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coach_memories (
  athlete_user_id uuid primary key references public.profiles(id) on delete cascade,
  summary text not null default '',
  patterns jsonb not null default '[]'::jsonb,
  growth_markers jsonb not null default '[]'::jsonb,
  next_focus text not null default '',
  safety_flags jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.coach_sessions enable row level security;
alter table public.coach_memories enable row level security;

drop policy if exists "Athletes manage their coach sessions" on public.coach_sessions;
create policy "Athletes manage their coach sessions"
on public.coach_sessions for all
to authenticated
using ((select auth.uid()) = athlete_user_id)
with check ((select auth.uid()) = athlete_user_id);

drop policy if exists "Athletes manage their coach memory" on public.coach_memories;
create policy "Athletes manage their coach memory"
on public.coach_memories for all
to authenticated
using ((select auth.uid()) = athlete_user_id)
with check ((select auth.uid()) = athlete_user_id);

create index if not exists coach_sessions_athlete_updated_idx
on public.coach_sessions (athlete_user_id, updated_at desc);
