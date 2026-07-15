create table if not exists public.athlete_points_ledger (
  id uuid primary key default gen_random_uuid(),
  athlete_user_id uuid not null references public.profiles(id) on delete cascade,
  event_key text not null,
  event_type text not null,
  points integer not null check (points > 0),
  label text not null default 'Points earned',
  metadata jsonb not null default '{}'::jsonb,
  entry_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (athlete_user_id, event_key)
);

create index if not exists athlete_points_ledger_athlete_created_idx
on public.athlete_points_ledger (athlete_user_id, created_at desc);

create index if not exists athlete_points_ledger_entry_date_idx
on public.athlete_points_ledger (entry_date desc);

alter table public.athlete_points_ledger enable row level security;

drop policy if exists "Athletes manage their points ledger" on public.athlete_points_ledger;
create policy "Athletes manage their points ledger"
on public.athlete_points_ledger for all
to authenticated
using ((select auth.uid()) = athlete_user_id)
with check ((select auth.uid()) = athlete_user_id);

drop policy if exists "Linked parents read athlete points ledger" on public.athlete_points_ledger;
create policy "Linked parents read athlete points ledger"
on public.athlete_points_ledger for select
to authenticated
using (exists (
  select 1
  from public.parent_links
  where parent_links.parent_user_id = (select auth.uid())
    and parent_links.athlete_user_id = athlete_points_ledger.athlete_user_id
));

grant select, insert, update, delete on public.athlete_points_ledger to authenticated;
