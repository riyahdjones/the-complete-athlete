begin;

alter table public.profiles
  add column if not exists preferred_language text not null default 'en';

alter table public.profiles
  drop constraint if exists profiles_preferred_language_check;

alter table public.profiles
  add constraint profiles_preferred_language_check
  check (preferred_language in ('en', 'es'));

alter table public.performance_plans
  add column if not exists title_es text,
  add column if not exists subject_es text,
  add column if not exists steps_es jsonb,
  add column if not exists challenge_day_es text;

alter table public.daily_deposits
  add column if not exists title_es text,
  add column if not exists body_es text,
  add column if not exists focus_question_es text;

alter table public.parent_messages
  add column if not exists title_es text,
  add column if not exists body_es text,
  add column if not exists conversation_cue_es text,
  add column if not exists avoid_es text;

alter table public.parent_guides
  add column if not exists series_title_es text,
  add column if not exists title_es text,
  add column if not exists category_es text,
  add column if not exists subject_es text,
  add column if not exists steps_es jsonb,
  add column if not exists guide_day_es text;

commit;
