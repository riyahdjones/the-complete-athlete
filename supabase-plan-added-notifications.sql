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

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_new_performance_plan()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform net.http_post(
    url := 'https://the-complete-athlete.vercel.app/api/send-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Plan-Notification-Secret', '__PLAN_NOTIFICATION_WEBHOOK_SECRET__'
    ),
    body := jsonb_build_object(
      'source', 'performance_plan_insert',
      'planId', new.id
    )
  );
  return new;
exception when others then
  -- Adding a plan must still succeed if notification delivery is unavailable.
  return new;
end;
$$;

drop trigger if exists notify_new_performance_plan_after_insert on public.performance_plans;

create trigger notify_new_performance_plan_after_insert
after insert on public.performance_plans
for each row execute function public.notify_new_performance_plan();
