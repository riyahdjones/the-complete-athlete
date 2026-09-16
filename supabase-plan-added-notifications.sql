alter table public.performance_plans
add column if not exists notification_sent_at timestamptz;

-- Existing plans were already available before this feature. Mark them delivered
-- so the first worker run only announces plans created after this migration.
update public.performance_plans
set notification_sent_at = now()
where notification_sent_at is null;

create index if not exists performance_plans_pending_notification_idx
on public.performance_plans (created_at)
where notification_sent_at is null;
