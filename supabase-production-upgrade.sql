alter table public.athlete_profiles
add column if not exists photo_url text not null default '';

alter table public.athlete_profiles
add column if not exists updated_at timestamptz not null default now();

alter table public.goals
add column if not exists updated_at timestamptz not null default now();

alter table public.daily_standards
add column if not exists updated_at timestamptz not null default now();

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

grant select, insert, update, delete on public.athlete_privacy_settings to authenticated;
grant select, insert, update, delete on public.parent_messages to authenticated;
