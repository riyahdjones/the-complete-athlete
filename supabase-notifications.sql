create table if not exists public.app_notifications (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  notification_type text not null default 'general',
  title text not null,
  body text not null,
  tone text not null default 'info',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists last_active_at timestamptz not null default now(),
  add column if not exists last_inactivity_notified_at timestamptz;

create index if not exists profiles_last_active_idx
  on public.profiles (last_active_at);

create index if not exists app_notifications_user_created_idx
  on public.app_notifications (user_id, created_at desc);

alter table public.app_notifications enable row level security;

drop policy if exists "Users manage their own notifications" on public.app_notifications;

create policy "Users manage their own notifications"
  on public.app_notifications
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.app_notifications to authenticated;

create or replace function public.parent_linked_athletes()
returns table(
  athlete_user_id uuid,
  full_name text,
  sport text,
  age text,
  location text,
  linked_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    parent_links.athlete_user_id,
    profiles.full_name,
    athlete_profiles.sport,
    athlete_profiles.age,
    athlete_profiles.location,
    parent_links.created_at as linked_at
  from public.parent_links
  join public.profiles
    on profiles.id = parent_links.athlete_user_id
  left join public.athlete_profiles
    on athlete_profiles.user_id = parent_links.athlete_user_id
  where parent_links.parent_user_id = auth.uid()
  order by parent_links.created_at desc;
$$;

revoke all on function public.parent_linked_athletes() from public;
grant execute on function public.parent_linked_athletes() to authenticated;

create or replace function public.create_parent_athlete_notification(
  target_athlete_id uuid,
  notice_title text,
  notice_body text,
  notice_type text default 'parentUpdates'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  notification_id text;
begin
  if caller_id is null then
    raise exception 'Sign in before sending encouragement.';
  end if;

  if not exists (
    select 1
    from public.parent_links
    where parent_user_id = caller_id
      and athlete_user_id = target_athlete_id
  ) then
    raise exception 'Parent is not linked to this athlete.';
  end if;

  notification_id := 'parent-update-' || target_athlete_id::text || '-' || extract(epoch from now())::bigint::text || '-' || floor(random() * 100000)::text;

  insert into public.app_notifications (id, user_id, notification_type, title, body, tone, read, created_at)
  values (
    notification_id,
    target_athlete_id,
    coalesce(nullif(notice_type, ''), 'parentUpdates'),
    left(coalesce(nullif(notice_title, ''), 'Parent encouragement'), 80),
    left(coalesce(nullif(notice_body, ''), 'Your parent sent encouragement.'), 220),
    'success',
    false,
    now()
  );

  return target_athlete_id;
end;
$$;

revoke all on function public.create_parent_athlete_notification(uuid, text, text, text) from public;
grant execute on function public.create_parent_athlete_notification(uuid, text, text, text) to authenticated;

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  daily_deposits boolean not null default true,
  performance_plans boolean not null default true,
  plan_unlocks boolean not null default true,
  streaks boolean not null default true,
  productivity boolean not null default true,
  points boolean not null default true,
  parent_updates boolean not null default true,
  inactivity_reminders boolean not null default true,
  browser_push boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences
  add column if not exists inactivity_reminders boolean not null default true;

alter table public.notification_preferences enable row level security;

drop policy if exists "Users manage their own notification preferences" on public.notification_preferences;

create policy "Users manage their own notification preferences"
  on public.notification_preferences
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.notification_preferences to authenticated;

create table if not exists public.push_devices (
  token text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null default 'ios',
  app_version text,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists push_devices_user_enabled_idx
  on public.push_devices (user_id, enabled, last_seen_at desc);

alter table public.push_devices enable row level security;

drop policy if exists "Users can view their own push devices" on public.push_devices;
drop policy if exists "Users can register their own push devices" on public.push_devices;
drop policy if exists "Users can update their own push devices" on public.push_devices;

create policy "Users can view their own push devices"
  on public.push_devices
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can register their own push devices"
  on public.push_devices
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own push devices"
  on public.push_devices
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.push_devices to authenticated;
