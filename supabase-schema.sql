create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('athlete', 'parent', 'admin')),
  full_name text not null default '',
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

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
