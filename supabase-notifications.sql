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

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  daily_deposits boolean not null default true,
  performance_plans boolean not null default true,
  plan_unlocks boolean not null default true,
  streaks boolean not null default true,
  productivity boolean not null default true,
  points boolean not null default true,
  parent_updates boolean not null default true,
  browser_push boolean not null default false,
  updated_at timestamptz not null default now()
);

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
