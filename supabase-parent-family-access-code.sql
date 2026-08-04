alter table public.profiles
add column if not exists parent_access_code text not null default ('TCA-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 8)));

create unique index if not exists profiles_parent_access_code_idx
on public.profiles (parent_access_code)
where role = 'parent';

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

revoke all on function public.link_athlete_to_parent(text) from public;
grant execute on function public.link_athlete_to_parent(text) to authenticated;
