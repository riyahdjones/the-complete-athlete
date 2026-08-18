create extension if not exists pgcrypto;

create or replace function public.outreach_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.outreach_normalize_record()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_table_name = 'outreach_schools' then
    new.name := trim(new.name);
    new.normalized_name := lower(trim(new.name));
    new.website_domain := lower(trim(new.website_domain));
  elsif tg_table_name = 'outreach_contacts' then
    new.full_name := trim(new.full_name);
    new.normalized_name := lower(trim(new.full_name));
    if new.professional_email is not null then
      new.professional_email := trim(new.professional_email);
      new.normalized_email := lower(new.professional_email);
    else
      new.normalized_email := null;
    end if;
  elsif tg_table_name = 'outreach_suppressions' then
    if new.email is not null then
      new.email := trim(new.email);
      new.normalized_email := lower(new.email);
    else
      new.normalized_email := null;
    end if;
    if new.domain is not null then
      new.domain := trim(new.domain);
      new.normalized_domain := lower(new.domain);
    else
      new.normalized_domain := null;
    end if;
  end if;

  return new;
end;
$$;

create table if not exists public.outreach_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'draft'
    check (status in ('draft', 'pilot', 'active', 'paused', 'completed', 'archived')),
  geography jsonb not null default '{"state":"GA"}'::jsonb,
  audience jsonb not null default '{}'::jsonb,
  primary_cta text not null default 'Book a 15-minute introductory call.',
  sending_mailbox text,
  daily_send_cap integer not null default 25 check (daily_send_cap between 1 and 500),
  follow_up_limit integer not null default 2 check (follow_up_limit between 0 and 5),
  follow_up_intervals_days integer[] not null default array[4, 7],
  requires_approval boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(follow_up_intervals_days) = follow_up_limit)
);

create table if not exists public.outreach_schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  school_type text not null check (school_type in ('public', 'private', 'charter')),
  grade_levels text[] not null default '{}',
  address text,
  city text not null,
  county text,
  state text not null default 'GA' check (state = 'GA'),
  postal_code text,
  district_name text,
  website_url text not null,
  website_domain text not null,
  athletics_url text,
  staff_directory_url text,
  enrollment integer check (enrollment is null or enrollment >= 0),
  sports_offered text[] not null default '{}',
  has_organized_athletics boolean not null default false,
  priority_signals jsonb not null default '{}'::jsonb,
  qualification_status text not null default 'pending'
    check (qualification_status in ('pending', 'qualified', 'needs_research', 'disqualified')),
  qualification_score integer not null default 0 check (qualification_score between 0 and 100),
  qualification_reasons jsonb not null default '[]'::jsonb,
  disqualification_reason text,
  source_urls text[] not null default '{}',
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (normalized_name = lower(trim(normalized_name))),
  check (website_domain = lower(trim(website_domain))),
  check (
    qualification_status <> 'qualified'
    or (
      has_organized_athletics
      and cardinality(grade_levels) > 0
      and last_verified_at is not null
      and disqualification_reason is null
    )
  )
);

create unique index if not exists outreach_schools_identity_idx
  on public.outreach_schools (normalized_name, city, state);
create index if not exists outreach_schools_queue_idx
  on public.outreach_schools (qualification_status, qualification_score desc, county, city);
create index if not exists outreach_schools_domain_idx
  on public.outreach_schools (website_domain);

create table if not exists public.outreach_contacts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.outreach_schools(id) on delete cascade,
  full_name text not null,
  normalized_name text not null,
  job_title text not null,
  contact_role text not null check (
    contact_role in (
      'athletic_director', 'assistant_athletic_director', 'head_coach',
      'principal', 'assistant_principal', 'student_activities_director',
      'athletic_coordinator', 'performance_staff', 'counselor',
      'student_development_staff', 'district_athletics_administrator'
    )
  ),
  sport text,
  professional_email text,
  normalized_email text,
  professional_phone text,
  email_status text not null default 'unverified'
    check (email_status in ('unverified', 'valid', 'risky', 'invalid', 'unavailable')),
  is_primary_contact boolean not null default false,
  source_url text not null,
  source_excerpt text,
  last_verified_at timestamptz,
  do_not_contact boolean not null default false,
  do_not_contact_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (normalized_name = lower(trim(normalized_name))),
  check (
    (professional_email is null and normalized_email is null)
    or (professional_email is not null and normalized_email = lower(trim(professional_email)))
  ),
  check (email_status <> 'valid' or professional_email is not null),
  check (not do_not_contact or do_not_contact_reason is not null)
);

create unique index if not exists outreach_contacts_school_person_idx
  on public.outreach_contacts (school_id, normalized_name, contact_role, coalesce(sport, ''));
create unique index if not exists outreach_contacts_email_idx
  on public.outreach_contacts (normalized_email)
  where normalized_email is not null;
create unique index if not exists outreach_contacts_one_primary_idx
  on public.outreach_contacts (school_id)
  where is_primary_contact and not do_not_contact;
create index if not exists outreach_contacts_role_queue_idx
  on public.outreach_contacts (contact_role, email_status, last_verified_at desc);

create table if not exists public.outreach_source_evidence (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.outreach_schools(id) on delete cascade,
  contact_id uuid references public.outreach_contacts(id) on delete cascade,
  url text not null,
  source_type text not null check (
    source_type in (
      'official_school', 'official_district', 'official_athletics',
      'official_staff_directory', 'state_directory',
      'professional_organization', 'licensed_provider'
    )
  ),
  field_supported text not null,
  captured_text text,
  content_hash text,
  retrieved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (school_id is not null or contact_id is not null)
);

create unique index if not exists outreach_source_evidence_identity_idx
  on public.outreach_source_evidence (
    coalesce(school_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(contact_id, '00000000-0000-0000-0000-000000000000'::uuid),
    url,
    field_supported
  );
create index if not exists outreach_source_evidence_school_idx
  on public.outreach_source_evidence (school_id, retrieved_at desc);
create index if not exists outreach_source_evidence_contact_idx
  on public.outreach_source_evidence (contact_id, retrieved_at desc);

create table if not exists public.outreach_suppressions (
  id uuid primary key default gen_random_uuid(),
  email text,
  normalized_email text,
  domain text,
  normalized_domain text,
  school_id uuid references public.outreach_schools(id) on delete set null,
  reason text not null,
  scope text not null check (scope in ('contact', 'school', 'domain')),
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  check (email is not null or domain is not null or school_id is not null),
  check (
    (email is null and normalized_email is null)
    or (email is not null and normalized_email = lower(trim(email)))
  ),
  check (
    (domain is null and normalized_domain is null)
    or (domain is not null and normalized_domain = lower(trim(domain)))
  )
);

create unique index if not exists outreach_suppressions_email_idx
  on public.outreach_suppressions (normalized_email)
  where normalized_email is not null;
create unique index if not exists outreach_suppressions_domain_idx
  on public.outreach_suppressions (normalized_domain)
  where normalized_domain is not null;
create unique index if not exists outreach_suppressions_school_idx
  on public.outreach_suppressions (school_id)
  where school_id is not null;

create table if not exists public.outreach_prospects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.outreach_schools(id) on delete cascade,
  contact_id uuid not null references public.outreach_contacts(id) on delete cascade,
  campaign_id uuid not null references public.outreach_campaigns(id) on delete cascade,
  status text not null default 'discovered' check (
    status in (
      'discovered', 'qualified', 'research_ready', 'draft_ready',
      'awaiting_approval', 'approved', 'active', 'replied',
      'meeting_booked', 'disqualified', 'suppressed', 'closed'
    )
  ),
  priority_score integer not null default 0 check (priority_score between 0 and 100),
  personalization_brief text,
  personalization_evidence jsonb not null default '[]'::jsonb,
  owner text,
  next_action_at timestamptz,
  status_reason text,
  crm_contact_id text,
  crm_opportunity_id text,
  crm_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, contact_id)
);

alter table public.outreach_prospects
  add column if not exists crm_contact_id text,
  add column if not exists crm_opportunity_id text,
  add column if not exists crm_synced_at timestamptz;

create unique index if not exists outreach_prospects_crm_contact_idx
  on public.outreach_prospects (crm_contact_id)
  where crm_contact_id is not null;

create unique index if not exists outreach_prospects_one_active_school_idx
  on public.outreach_prospects (campaign_id, school_id)
  where status in (
    'qualified', 'research_ready', 'draft_ready', 'awaiting_approval',
    'approved', 'active', 'replied', 'meeting_booked'
  );
create index if not exists outreach_prospects_queue_idx
  on public.outreach_prospects (campaign_id, status, priority_score desc, next_action_at);

create table if not exists public.outreach_messages (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.outreach_prospects(id) on delete cascade,
  thread_id text,
  message_type text not null check (message_type in ('initial', 'follow_up', 'reply', 'internal_note')),
  sequence_number integer not null default 0 check (sequence_number between 0 and 5),
  subject text,
  body text not null,
  approval_status text not null default 'draft'
    check (approval_status in ('draft', 'awaiting_approval', 'approved', 'rejected')),
  approved_by text,
  approved_at timestamptz,
  scheduled_at timestamptz,
  sent_at timestamptz,
  delivery_status text not null default 'not_sent'
    check (delivery_status in ('not_sent', 'queued', 'sent', 'delivered', 'soft_bounce', 'hard_bounce', 'failed')),
  provider_message_id text,
  model_version text,
  prompt_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    approval_status <> 'approved'
    or (approved_by is not null and approved_at is not null)
  ),
  check (sent_at is null or approval_status = 'approved'),
  unique (prospect_id, message_type, sequence_number)
);

create unique index if not exists outreach_messages_provider_idx
  on public.outreach_messages (provider_message_id)
  where provider_message_id is not null;
create index if not exists outreach_messages_send_queue_idx
  on public.outreach_messages (approval_status, delivery_status, scheduled_at)
  where sent_at is null;

create table if not exists public.outreach_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.outreach_campaigns(id) on delete cascade,
  prospect_id uuid references public.outreach_prospects(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists outreach_events_campaign_idx
  on public.outreach_events (campaign_id, occurred_at desc);
create index if not exists outreach_events_prospect_idx
  on public.outreach_events (prospect_id, occurred_at desc);

create or replace function public.outreach_is_suppressed(
  checked_email text,
  checked_domain text,
  checked_school_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.outreach_suppressions s
    where (checked_email is not null and s.normalized_email = lower(trim(checked_email)))
       or (checked_domain is not null and s.normalized_domain = lower(trim(checked_domain)))
       or (checked_school_id is not null and s.school_id = checked_school_id)
  );
$$;

create or replace function public.outreach_guard_message_send()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_email text;
  target_domain text;
  target_school_id uuid;
  target_do_not_contact boolean;
  target_email_status text;
begin
  if new.approval_status = 'approved'
     or new.delivery_status = 'queued'
     or new.sent_at is not null then
    select
      c.normalized_email,
      s.website_domain,
      s.id,
      c.do_not_contact,
      c.email_status
    into
      target_email,
      target_domain,
      target_school_id,
      target_do_not_contact,
      target_email_status
    from public.outreach_prospects p
    join public.outreach_contacts c on c.id = p.contact_id
    join public.outreach_schools s on s.id = p.school_id
    where p.id = new.prospect_id;

    if target_email is null or target_email_status <> 'valid' then
      raise exception 'Outreach messages require a verified professional email before approval or sending.';
    end if;

    if target_do_not_contact
       or public.outreach_is_suppressed(target_email, target_domain, target_school_id) then
      raise exception 'Outreach message blocked by do-not-contact or suppression rules.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.outreach_propagate_suppression()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.outreach_contacts
  set do_not_contact = true,
      do_not_contact_reason = coalesce(do_not_contact_reason, new.reason),
      updated_at = now()
  where (new.normalized_email is not null and normalized_email = new.normalized_email)
     or (new.school_id is not null and school_id = new.school_id);

  update public.outreach_prospects p
  set status = 'suppressed',
      status_reason = new.reason,
      next_action_at = null,
      updated_at = now()
  from public.outreach_contacts c, public.outreach_schools s
  where p.contact_id = c.id
    and p.school_id = s.id
    and p.status not in ('meeting_booked', 'closed', 'suppressed')
    and (
      (new.normalized_email is not null and c.normalized_email = new.normalized_email)
      or (new.normalized_domain is not null and s.website_domain = new.normalized_domain)
      or (new.school_id is not null and s.id = new.school_id)
    );

  return new;
end;
$$;

drop trigger if exists outreach_campaigns_updated_at on public.outreach_campaigns;
create trigger outreach_campaigns_updated_at
before update on public.outreach_campaigns
for each row execute function public.outreach_set_updated_at();

drop trigger if exists outreach_schools_normalize on public.outreach_schools;
create trigger outreach_schools_normalize
before insert or update on public.outreach_schools
for each row execute function public.outreach_normalize_record();

drop trigger if exists outreach_schools_updated_at on public.outreach_schools;
create trigger outreach_schools_updated_at
before update on public.outreach_schools
for each row execute function public.outreach_set_updated_at();

drop trigger if exists outreach_contacts_normalize on public.outreach_contacts;
create trigger outreach_contacts_normalize
before insert or update on public.outreach_contacts
for each row execute function public.outreach_normalize_record();

drop trigger if exists outreach_contacts_updated_at on public.outreach_contacts;
create trigger outreach_contacts_updated_at
before update on public.outreach_contacts
for each row execute function public.outreach_set_updated_at();

drop trigger if exists outreach_prospects_updated_at on public.outreach_prospects;
create trigger outreach_prospects_updated_at
before update on public.outreach_prospects
for each row execute function public.outreach_set_updated_at();

drop trigger if exists outreach_messages_updated_at on public.outreach_messages;
create trigger outreach_messages_updated_at
before update on public.outreach_messages
for each row execute function public.outreach_set_updated_at();

drop trigger if exists outreach_guard_message_send on public.outreach_messages;
create trigger outreach_guard_message_send
before insert or update on public.outreach_messages
for each row execute function public.outreach_guard_message_send();

drop trigger if exists outreach_propagate_suppression on public.outreach_suppressions;
drop trigger if exists outreach_suppressions_normalize on public.outreach_suppressions;
create trigger outreach_suppressions_normalize
before insert or update on public.outreach_suppressions
for each row execute function public.outreach_normalize_record();

create trigger outreach_propagate_suppression
after insert on public.outreach_suppressions
for each row execute function public.outreach_propagate_suppression();

alter table public.outreach_campaigns enable row level security;
alter table public.outreach_schools enable row level security;
alter table public.outreach_contacts enable row level security;
alter table public.outreach_source_evidence enable row level security;
alter table public.outreach_suppressions enable row level security;
alter table public.outreach_prospects enable row level security;
alter table public.outreach_messages enable row level security;
alter table public.outreach_events enable row level security;

-- No anon/authenticated policies are intentionally created. These operational
-- records are available only through the server-side service-role client.
revoke all on table public.outreach_campaigns from anon, authenticated;
revoke all on table public.outreach_schools from anon, authenticated;
revoke all on table public.outreach_contacts from anon, authenticated;
revoke all on table public.outreach_source_evidence from anon, authenticated;
revoke all on table public.outreach_suppressions from anon, authenticated;
revoke all on table public.outreach_prospects from anon, authenticated;
revoke all on table public.outreach_messages from anon, authenticated;
revoke all on table public.outreach_events from anon, authenticated;

revoke all on function public.outreach_is_suppressed(text, text, uuid) from public;
revoke all on function public.outreach_set_updated_at() from public;
revoke all on function public.outreach_normalize_record() from public;
revoke all on function public.outreach_guard_message_send() from public;
revoke all on function public.outreach_propagate_suppression() from public;

grant all on table public.outreach_campaigns to service_role;
grant all on table public.outreach_schools to service_role;
grant all on table public.outreach_contacts to service_role;
grant all on table public.outreach_source_evidence to service_role;
grant all on table public.outreach_suppressions to service_role;
grant all on table public.outreach_prospects to service_role;
grant all on table public.outreach_messages to service_role;
grant all on table public.outreach_events to service_role;
grant execute on function public.outreach_is_suppressed(text, text, uuid) to service_role;

comment on table public.outreach_suppressions is
  'Permanent outbound suppression list. Entries must not be deleted as part of normal campaign cleanup.';
comment on table public.outreach_source_evidence is
  'Field-level provenance for every material school and contact fact used by outreach automation.';

insert into public.outreach_campaigns (
  name,
  geography,
  audience,
  primary_cta,
  daily_send_cap,
  follow_up_limit,
  follow_up_intervals_days,
  requires_approval
)
select
  'Georgia Schools Pilot',
  '{"state":"GA","priority_region":"Metro Atlanta and surrounding counties"}'::jsonb,
  '{"school_levels":["middle","high"],"school_types":["public","private","charter"],"primary_role":"athletic_director"}'::jsonb,
  'Book a 15-minute introductory call.',
  25,
  2,
  array[4, 7],
  true
where not exists (
  select 1 from public.outreach_campaigns where name = 'Georgia Schools Pilot'
);
