create table if not exists public.app_events (
  id uuid primary key default gen_random_uuid(),
  area text not null,
  event_type text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'error', 'critical')),
  user_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists app_events_created_idx
on public.app_events (created_at desc);

create index if not exists app_events_area_severity_created_idx
on public.app_events (area, severity, created_at desc);

create index if not exists app_events_user_created_idx
on public.app_events (user_id, created_at desc);

alter table public.app_events enable row level security;

drop policy if exists "Admins read app events" on public.app_events;
create policy "Admins read app events"
on public.app_events for select
to authenticated
using (public.current_user_is_admin());

drop policy if exists "Admins manage app events" on public.app_events;
create policy "Admins manage app events"
on public.app_events for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

grant select on public.app_events to authenticated;
