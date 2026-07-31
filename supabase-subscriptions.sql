create table if not exists public.user_subscriptions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'revenuecat',
  entitlement_id text not null default 'The Complete Athlete Pro',
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
  where user_id = checked_user_id
    and public.subscription_is_active(status, expires_at)
  order by expires_at nulls last, updated_at desc
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

drop policy if exists "Users read their own subscriptions" on public.user_subscriptions;
create policy "Users read their own subscriptions"
on public.user_subscriptions for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Admins manage subscriptions" on public.user_subscriptions;
create policy "Admins manage subscriptions"
on public.user_subscriptions for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

revoke all on function public.subscription_is_active(text, timestamptz) from public;
revoke all on function public.user_has_premium_access(uuid) from public;
grant execute on function public.subscription_is_active(text, timestamptz) to authenticated;
grant execute on function public.user_has_premium_access(uuid) to authenticated;
grant select on public.user_subscriptions to authenticated;
