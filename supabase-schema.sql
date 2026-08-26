create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('athlete', 'parent', 'admin')),
  full_name text not null default '',
  parent_access_code text not null default ('TCA-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 8))),
  last_active_at timestamptz not null default now(),
  last_inactivity_notified_at timestamptz,
  last_winback_10_notified_at timestamptz,
  last_winback_21_notified_at timestamptz,
  last_parent_nudge_notified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.athlete_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  sport text not null default '',
  age text not null default '',
  location text not null default '',
  parent_contact text not null default '',
  parent_access_code text not null default encode(gen_random_bytes(6), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.parent_links (
  id uuid primary key default gen_random_uuid(),
  parent_user_id uuid not null references public.profiles(id) on delete cascade,
  athlete_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (parent_user_id, athlete_user_id)
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  athlete_user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  value text not null,
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  created_at timestamptz not null default now()
);

create table if not exists public.daily_standards (
  id uuid primary key default gen_random_uuid(),
  athlete_user_id uuid not null references public.profiles(id) on delete cascade,
  goal_id uuid references public.goals(id) on delete set null,
  label text not null,
  done boolean not null default false,
  entry_date date not null default current_date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.standards_history (
  id uuid primary key default gen_random_uuid(),
  athlete_user_id uuid not null references public.profiles(id) on delete cascade,
  entry_date date not null,
  completed integer not null default 0,
  total integer not null default 0,
  percent integer not null default 0,
  standards jsonb not null default '[]'::jsonb,
  submitted_at timestamptz not null default now(),
  unique (athlete_user_id, entry_date)
);

create table if not exists public.readiness_checks (
  id uuid primary key default gen_random_uuid(),
  athlete_user_id uuid not null references public.profiles(id) on delete cascade,
  entry_date date not null,
  confidence integer not null default 0,
  energy integer not null default 0,
  mood integer not null default 0,
  belief integer not null default 0,
  created_at timestamptz not null default now(),
  unique (athlete_user_id, entry_date)
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  athlete_user_id uuid not null references public.profiles(id) on delete cascade,
  goal_id uuid references public.goals(id) on delete set null,
  entry_type text not null default 'Daily Reflection',
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_deposits (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  focus_question text not null default '',
  release_date date not null,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'posted')),
  created_at timestamptz not null default now()
);

create table if not exists public.performance_plans (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null,
  steps jsonb not null default '[]'::jsonb,
  release_date date not null,
  challenge_day text not null default '',
  challenge_length integer not null default 7,
  created_at timestamptz not null default now()
);

create table if not exists public.parent_guides (
  id uuid primary key default gen_random_uuid(),
  series_title text not null,
  title text not null,
  category text not null default 'Parent Support',
  subject text not null default '',
  steps jsonb not null default '[]'::jsonb,
  release_date date not null default current_date,
  guide_day text not null default '',
  guide_length integer not null default 1,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.performance_plan_progress (
  athlete_user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id text not null,
  completed_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (athlete_user_id, plan_id)
);

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

create table if not exists public.coach_daily_usage (
  athlete_user_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null default current_date,
  message_count integer not null default 0 check (message_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (athlete_user_id, usage_date)
);

create or replace function public.reserve_coach_message(p_limit integer default 15)
returns table(allowed boolean, message_count integer, message_limit integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_count integer;
begin
  if v_user is null then
    return query select false, 0, p_limit;
    return;
  end if;

  insert into public.coach_daily_usage (athlete_user_id, usage_date, message_count)
  values (v_user, current_date, 1)
  on conflict (athlete_user_id, usage_date) do update
    set message_count = public.coach_daily_usage.message_count + 1,
        updated_at = now()
    where public.coach_daily_usage.message_count < p_limit
  returning public.coach_daily_usage.message_count into v_count;

  if v_count is not null then
    return query select true, v_count, p_limit;
    return;
  end if;

  select public.coach_daily_usage.message_count
  into v_count
  from public.coach_daily_usage
  where athlete_user_id = v_user
    and usage_date = current_date;

  return query select false, coalesce(v_count, p_limit), p_limit;
end;
$$;

create index if not exists profiles_role_created_idx
on public.profiles (role, created_at desc);

create index if not exists profiles_last_active_idx
on public.profiles (last_active_at);

create unique index if not exists profiles_parent_access_code_idx
on public.profiles (parent_access_code)
where role = 'parent';

create unique index if not exists athlete_profiles_parent_access_code_idx
on public.athlete_profiles (parent_access_code);

create index if not exists parent_links_created_idx
on public.parent_links (created_at desc);

create index if not exists parent_links_athlete_idx
on public.parent_links (athlete_user_id);

create index if not exists goals_athlete_created_idx
on public.goals (athlete_user_id, created_at);

create index if not exists daily_standards_athlete_active_created_idx
on public.daily_standards (athlete_user_id, active, created_at);

create index if not exists daily_standards_athlete_entry_date_idx
on public.daily_standards (athlete_user_id, entry_date);

create index if not exists daily_standards_goal_idx
on public.daily_standards (goal_id);

create index if not exists standards_history_athlete_entry_idx
on public.standards_history (athlete_user_id, entry_date desc);

create index if not exists standards_history_entry_idx
on public.standards_history (entry_date desc);

create index if not exists readiness_checks_athlete_entry_idx
on public.readiness_checks (athlete_user_id, entry_date desc);

create index if not exists readiness_checks_entry_idx
on public.readiness_checks (entry_date desc);

create index if not exists journal_entries_athlete_created_idx
on public.journal_entries (athlete_user_id, created_at desc);

create index if not exists journal_entries_created_idx
on public.journal_entries (created_at desc);

create index if not exists daily_deposits_release_status_idx
on public.daily_deposits (release_date desc, status);

create index if not exists performance_plans_release_idx
on public.performance_plans (release_date);

create index if not exists parent_guides_release_status_idx
on public.parent_guides (release_date, status);

create index if not exists performance_plan_progress_athlete_idx
on public.performance_plan_progress (athlete_user_id, completed_at desc);

create index if not exists athlete_points_ledger_athlete_created_idx
on public.athlete_points_ledger (athlete_user_id, created_at desc);

create index if not exists athlete_points_ledger_entry_date_idx
on public.athlete_points_ledger (entry_date desc);

create index if not exists coach_daily_usage_date_idx
on public.coach_daily_usage (usage_date desc);

alter table public.profiles enable row level security;
alter table public.athlete_profiles enable row level security;
alter table public.parent_links enable row level security;
alter table public.goals enable row level security;
alter table public.daily_standards enable row level security;
alter table public.standards_history enable row level security;
alter table public.readiness_checks enable row level security;
alter table public.journal_entries enable row level security;
alter table public.daily_deposits enable row level security;
alter table public.performance_plans enable row level security;
alter table public.parent_guides enable row level security;
alter table public.performance_plan_progress enable row level security;
alter table public.athlete_points_ledger enable row level security;
alter table public.coach_daily_usage enable row level security;

create policy "Users can read their own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy "Users can create their own profile"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Athletes manage their athlete profile"
on public.athlete_profiles for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Athletes manage their goals"
on public.goals for all
to authenticated
using ((select auth.uid()) = athlete_user_id)
with check ((select auth.uid()) = athlete_user_id);

create policy "Athletes manage their standards"
on public.daily_standards for all
to authenticated
using ((select auth.uid()) = athlete_user_id)
with check ((select auth.uid()) = athlete_user_id);

create policy "Athletes manage their standards history"
on public.standards_history for all
to authenticated
using ((select auth.uid()) = athlete_user_id)
with check ((select auth.uid()) = athlete_user_id);

create policy "Athletes manage their readiness"
on public.readiness_checks for all
to authenticated
using ((select auth.uid()) = athlete_user_id)
with check ((select auth.uid()) = athlete_user_id);

create policy "Athletes manage their journal"
on public.journal_entries for all
to authenticated
using ((select auth.uid()) = athlete_user_id)
with check ((select auth.uid()) = athlete_user_id);

create policy "Published deposits are readable"
on public.daily_deposits for select
to authenticated
using (status = 'posted' and release_date <= current_date);

create policy "Released plans are readable"
on public.performance_plans for select
to authenticated
using (release_date <= current_date);

create policy "Published parent guides are readable"
on public.parent_guides for select
to authenticated
using (status = 'published' and release_date <= current_date);

create policy "Athletes manage their plan progress"
on public.performance_plan_progress for all
to authenticated
using ((select auth.uid()) = athlete_user_id)
with check ((select auth.uid()) = athlete_user_id);

create policy "Linked parents read athlete plan progress"
on public.performance_plan_progress for select
to authenticated
using (exists (
  select 1
  from public.parent_links
  where parent_links.parent_user_id = (select auth.uid())
    and parent_links.athlete_user_id = performance_plan_progress.athlete_user_id
));

create policy "Athletes manage their points ledger"
on public.athlete_points_ledger for all
to authenticated
using ((select auth.uid()) = athlete_user_id)
with check ((select auth.uid()) = athlete_user_id);

create policy "Linked parents read athlete points ledger"
on public.athlete_points_ledger for select
to authenticated
using (exists (
  select 1
  from public.parent_links
  where parent_links.parent_user_id = (select auth.uid())
    and parent_links.athlete_user_id = athlete_points_ledger.athlete_user_id
));

create policy "Athletes read their coach usage"
on public.coach_daily_usage for select
to authenticated
using ((select auth.uid()) = athlete_user_id);

create table if not exists public.user_subscriptions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'revenuecat',
  entitlement_id text not null default 'premium',
  status text not null default 'inactive' check (status in ('active', 'trialing', 'inactive', 'expired', 'cancelled')),
  product_id text not null default '',
  original_transaction_id text not null default '',
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider, entitlement_id)
);

create index if not exists user_subscriptions_status_expires_idx
on public.user_subscriptions (status, expires_at);

create index if not exists user_subscriptions_original_transaction_idx
on public.user_subscriptions (original_transaction_id)
where original_transaction_id <> '';

alter table public.user_subscriptions enable row level security;

create or replace function public.subscription_is_active(subscription_status text, subscription_expires_at timestamptz)
returns boolean
language sql
stable
as $$
  select subscription_status in ('active', 'trialing')
    and (subscription_expires_at is null or subscription_expires_at > now());
$$;

create or replace function public.user_has_premium_access(target_user_id uuid default auth.uid())
returns table(has_access boolean, access_source text, sponsor_user_id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  checked_user_id uuid := coalesce(target_user_id, auth.uid());
  direct_row public.user_subscriptions%rowtype;
  sponsored_row record;
begin
  if caller_id is null or checked_user_id is null then
    return query select false, 'none'::text, null::uuid, null::timestamptz;
    return;
  end if;

  if checked_user_id <> caller_id and not exists (
    select 1
    from public.parent_links
    where parent_user_id = caller_id
      and athlete_user_id = checked_user_id
  ) then
    return query select false, 'none'::text, null::uuid, null::timestamptz;
    return;
  end if;

  select *
  into direct_row
  from public.user_subscriptions
  where user_subscriptions.user_id = checked_user_id
    and public.subscription_is_active(user_subscriptions.status, user_subscriptions.expires_at)
  order by user_subscriptions.expires_at nulls last, user_subscriptions.updated_at desc
  limit 1;

  if direct_row.user_id is not null then
    return query select true, 'self'::text, checked_user_id, direct_row.expires_at;
    return;
  end if;

  select parent_links.parent_user_id, user_subscriptions.expires_at
  into sponsored_row
  from public.parent_links
  join public.user_subscriptions
    on user_subscriptions.user_id = parent_links.parent_user_id
  where parent_links.athlete_user_id = checked_user_id
    and public.subscription_is_active(user_subscriptions.status, user_subscriptions.expires_at)
  order by user_subscriptions.expires_at nulls last, user_subscriptions.updated_at desc
  limit 1;

  if sponsored_row.parent_user_id is not null then
    return query select true, 'parent'::text, sponsored_row.parent_user_id, sponsored_row.expires_at;
    return;
  end if;

  return query select false, 'none'::text, null::uuid, null::timestamptz;
end;
$$;

create or replace function public.link_parent_to_athlete(access_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  linked_athlete_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required.';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'parent'
  ) then
    raise exception 'Only parent accounts can link to an athlete.';
  end if;

  select user_id
  into linked_athlete_id
  from public.athlete_profiles
  where parent_access_code = access_code
  limit 1;

  if linked_athlete_id is null then
    raise exception 'No athlete found for that access code.';
  end if;

  insert into public.parent_links (parent_user_id, athlete_user_id)
  values ((select auth.uid()), linked_athlete_id)
  on conflict (parent_user_id, athlete_user_id) do nothing;

  return linked_athlete_id;
end;
$$;

create or replace function public.link_athlete_to_parent(parent_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required.';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'athlete'
  ) then
    raise exception 'Only athlete accounts can use a family access code.';
  end if;

  select id
  into parent_id
  from public.profiles
  where role = 'parent'
    and upper(trim(parent_access_code)) = upper(trim(parent_code))
  limit 1;

  if parent_id is null then
    raise exception 'No parent found for that family access code.';
  end if;

  insert into public.parent_links (parent_user_id, athlete_user_id)
  values (parent_id, (select auth.uid()))
  on conflict (parent_user_id, athlete_user_id) do nothing;

  return parent_id;
end;
$$;

create policy "Users read their own subscriptions"
on public.user_subscriptions for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on function public.subscription_is_active(text, timestamptz) from public;
revoke all on function public.user_has_premium_access(uuid) from public;
revoke all on function public.link_parent_to_athlete(text) from public;
revoke all on function public.link_athlete_to_parent(text) from public;
grant execute on function public.subscription_is_active(text, timestamptz) to authenticated;
grant execute on function public.user_has_premium_access(uuid) to authenticated;
grant execute on function public.link_parent_to_athlete(text) to authenticated;
grant execute on function public.link_athlete_to_parent(text) to authenticated;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.reserve_coach_message(integer) to authenticated;
grant execute on function public.user_has_premium_access(uuid) to authenticated;

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

create policy "Users manage their own notifications"
on public.app_notifications for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

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
grant select, insert, update, delete on public.app_notifications to authenticated;
