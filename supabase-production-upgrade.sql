alter table public.athlete_profiles
add column if not exists photo_url text not null default '';

alter table public.athlete_profiles
add column if not exists updated_at timestamptz not null default now();

alter table public.goals
add column if not exists updated_at timestamptz not null default now();

alter table public.daily_standards
add column if not exists updated_at timestamptz not null default now();

alter table public.daily_deposits
add column if not exists focus_question text not null default '';

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'athlete'),
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do update
    set role = excluded.role,
        full_name = excluded.full_name;

  if coalesce(new.raw_user_meta_data->>'role', 'athlete') = 'athlete' then
    insert into public.athlete_profiles (user_id)
    values (new.id)
    on conflict (user_id) do nothing;

    insert into public.athlete_privacy_settings (athlete_user_id)
    values (new.id)
    on conflict (athlete_user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

insert into public.athlete_profiles (user_id)
select id
from public.profiles
where role = 'athlete'
on conflict (user_id) do nothing;

create table if not exists public.athlete_privacy_settings (
  athlete_user_id uuid primary key references public.profiles(id) on delete cascade,
  readiness_visible boolean not null default true,
  standards_visible boolean not null default true,
  goals_visible boolean not null default false,
  journal_private boolean not null default true,
  coach_private boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.athlete_privacy_settings (athlete_user_id)
select id
from public.profiles
where role = 'athlete'
on conflict (athlete_user_id) do nothing;

create table if not exists public.parent_messages (
  id text primary key default 'active',
  title text not null default '',
  body text not null default '',
  conversation_cue text not null default '',
  avoid text not null default '',
  send_date date not null default current_date,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.athlete_privacy_settings enable row level security;
alter table public.parent_messages enable row level security;

revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

create or replace function public.current_user_is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

create or replace function public.parent_is_linked_to_athlete(athlete_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.parent_links
    where parent_user_id = (select auth.uid())
      and athlete_user_id = athlete_id
  );
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

revoke all on function public.current_user_is_admin() from public;
revoke all on function public.parent_is_linked_to_athlete(uuid) from public;
revoke all on function public.link_parent_to_athlete(text) from public;
grant execute on function public.current_user_is_admin() to authenticated;
grant execute on function public.parent_is_linked_to_athlete(uuid) to authenticated;
grant execute on function public.link_parent_to_athlete(text) to authenticated;

drop policy if exists "Athletes manage their athlete profile" on public.athlete_profiles;
create policy "Athletes manage their athlete profile"
on public.athlete_profiles for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Linked parents read athlete profile"
on public.athlete_profiles for select
to authenticated
using (public.parent_is_linked_to_athlete(user_id));

create policy "Admins manage athlete profiles"
on public.athlete_profiles for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Athletes manage their goals" on public.goals;
create policy "Athletes manage their goals"
on public.goals for all
to authenticated
using ((select auth.uid()) = athlete_user_id)
with check ((select auth.uid()) = athlete_user_id);

create policy "Linked parents read athlete goals"
on public.goals for select
to authenticated
using (public.parent_is_linked_to_athlete(athlete_user_id));

create policy "Admins manage goals"
on public.goals for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Athletes manage their standards" on public.daily_standards;
create policy "Athletes manage their standards"
on public.daily_standards for all
to authenticated
using ((select auth.uid()) = athlete_user_id)
with check ((select auth.uid()) = athlete_user_id);

create policy "Linked parents read athlete standards"
on public.daily_standards for select
to authenticated
using (public.parent_is_linked_to_athlete(athlete_user_id));

drop policy if exists "Athletes manage their standards history" on public.standards_history;
create policy "Athletes manage their standards history"
on public.standards_history for all
to authenticated
using ((select auth.uid()) = athlete_user_id)
with check ((select auth.uid()) = athlete_user_id);

create policy "Linked parents read athlete standards history"
on public.standards_history for select
to authenticated
using (public.parent_is_linked_to_athlete(athlete_user_id));

drop policy if exists "Athletes manage their readiness" on public.readiness_checks;
create policy "Athletes manage their readiness"
on public.readiness_checks for all
to authenticated
using ((select auth.uid()) = athlete_user_id)
with check ((select auth.uid()) = athlete_user_id);

create policy "Linked parents read athlete readiness"
on public.readiness_checks for select
to authenticated
using (public.parent_is_linked_to_athlete(athlete_user_id));

drop policy if exists "Athletes manage their journal" on public.journal_entries;
create policy "Athletes manage their journal"
on public.journal_entries for all
to authenticated
using ((select auth.uid()) = athlete_user_id)
with check ((select auth.uid()) = athlete_user_id);

create policy "Athletes manage privacy settings"
on public.athlete_privacy_settings for all
to authenticated
using ((select auth.uid()) = athlete_user_id)
with check ((select auth.uid()) = athlete_user_id);

create policy "Linked parents read privacy settings"
on public.athlete_privacy_settings for select
to authenticated
using (public.parent_is_linked_to_athlete(athlete_user_id));

create policy "Parents read their links"
on public.parent_links for select
to authenticated
using ((select auth.uid()) = parent_user_id);

create policy "Admins manage parent links"
on public.parent_links for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Published deposits are readable" on public.daily_deposits;
create policy "Released deposits are readable"
on public.daily_deposits for select
to authenticated
using (status = 'posted' and release_date <= current_date);

create policy "Admins manage daily deposits"
on public.daily_deposits for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Released plans are readable" on public.performance_plans;
create policy "Released plans are readable"
on public.performance_plans for select
to authenticated
using (release_date <= current_date);

create policy "Admins manage performance plans"
on public.performance_plans for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

create policy "Released parent messages are readable"
on public.parent_messages for select
to authenticated
using (status in ('scheduled', 'sent') and send_date <= current_date);

create policy "Admins manage parent messages"
on public.parent_messages for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

insert into storage.buckets (id, name, public)
values ('athlete-profile-photos', 'athlete-profile-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "Athletes upload profile photos" on storage.objects;
create policy "Athletes upload profile photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'athlete-profile-photos'
  and split_part(name, '/', 1) = (select auth.uid())::text
);

drop policy if exists "Athletes update profile photos" on storage.objects;
create policy "Athletes update profile photos"
on storage.objects for update
to authenticated
using (
  bucket_id = 'athlete-profile-photos'
  and split_part(name, '/', 1) = (select auth.uid())::text
)
with check (
  bucket_id = 'athlete-profile-photos'
  and split_part(name, '/', 1) = (select auth.uid())::text
);

drop policy if exists "Athletes read profile photos" on storage.objects;
create policy "Athletes read profile photos"
on storage.objects for select
to authenticated
using (bucket_id = 'athlete-profile-photos');

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

create table if not exists public.coach_daily_usage (
  athlete_user_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null default current_date,
  message_count integer not null default 0 check (message_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (athlete_user_id, usage_date)
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

alter table public.coach_sessions enable row level security;
alter table public.coach_memories enable row level security;
alter table public.coach_daily_usage enable row level security;
alter table public.performance_plan_progress enable row level security;
alter table public.athlete_points_ledger enable row level security;

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

drop policy if exists "Athletes manage their plan progress" on public.performance_plan_progress;
create policy "Athletes manage their plan progress"
on public.performance_plan_progress for all
to authenticated
using ((select auth.uid()) = athlete_user_id)
with check ((select auth.uid()) = athlete_user_id);

drop policy if exists "Linked parents read athlete plan progress" on public.performance_plan_progress;
create policy "Linked parents read athlete plan progress"
on public.performance_plan_progress for select
to authenticated
using (exists (
  select 1
  from public.parent_links
  where parent_links.parent_user_id = (select auth.uid())
    and parent_links.athlete_user_id = performance_plan_progress.athlete_user_id
));

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

drop policy if exists "Athletes read their coach usage" on public.coach_daily_usage;
create policy "Athletes read their coach usage"
on public.coach_daily_usage for select
to authenticated
using ((select auth.uid()) = athlete_user_id);

create index if not exists coach_sessions_athlete_updated_idx
on public.coach_sessions (athlete_user_id, updated_at desc);

create index if not exists coach_daily_usage_date_idx
on public.coach_daily_usage (usage_date desc);

create index if not exists performance_plan_progress_athlete_idx
on public.performance_plan_progress (athlete_user_id, completed_at desc);

create index if not exists athlete_points_ledger_athlete_created_idx
on public.athlete_points_ledger (athlete_user_id, created_at desc);

create index if not exists athlete_points_ledger_entry_date_idx
on public.athlete_points_ledger (entry_date desc);

create index if not exists profiles_role_created_idx
on public.profiles (role, created_at desc);

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

create index if not exists parent_messages_status_send_idx
on public.parent_messages (status, send_date desc);

grant select, insert, update, delete on public.athlete_privacy_settings to authenticated;
grant select, insert, update, delete on public.parent_messages to authenticated;
grant select on public.coach_daily_usage to authenticated;
grant select, insert, update, delete on public.performance_plan_progress to authenticated;
grant select, insert, update, delete on public.athlete_points_ledger to authenticated;
grant execute on function public.reserve_coach_message(integer) to authenticated;
