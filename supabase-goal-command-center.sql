-- Goal Command Center metadata. Safe to run repeatedly.
alter table public.goals
  add column if not exists category text not null default '',
  add column if not exists affirmation text not null default '',
  add column if not exists target_date date,
  add column if not exists milestones jsonb not null default '[]'::jsonb;

update public.goals
set category = label
where category = '';
