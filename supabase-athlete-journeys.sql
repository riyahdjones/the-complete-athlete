create table if not exists public.athlete_journeys (
  athlete_user_id uuid primary key references public.profiles(id) on delete cascade,
  journey jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.athlete_journeys enable row level security;

drop policy if exists "Athletes manage their journey" on public.athlete_journeys;
create policy "Athletes manage their journey"
on public.athlete_journeys for all
using (auth.uid() = athlete_user_id)
with check (auth.uid() = athlete_user_id);

grant select, insert, update on public.athlete_journeys to authenticated;
