-- ============================================================
-- Members & permissions: owner/creator edit rights, member list,
-- remove / leave, invite listing & revoke. Apply to BOTH projects.
-- ============================================================

-- ---------- Helper: is_family_owner ----------

create or replace function public.is_family_owner(fid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.family_members
    where family_id = fid
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

revoke execute on function public.is_family_owner(uuid) from public, anon;
grant  execute on function public.is_family_owner(uuid) to authenticated;

-- ---------- Birthdays: only the owner or the creator may edit/delete ----------

drop policy if exists "family_members_update_birthdays" on public.birthdays;

create policy "owner_or_creator_update_birthdays" on public.birthdays
  for update
  to authenticated
  using (
    public.is_family_member(family_id)
    and (created_by = auth.uid() or public.is_family_owner(family_id))
  )
  with check (
    public.is_family_member(family_id)
    and (created_by = auth.uid() or public.is_family_owner(family_id))
  );

-- A row can't be moved to another family or re-attributed.
create or replace function public.pin_birthday_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.family_id  := old.family_id;
  new.created_by := old.created_by;
  return new;
end;
$$;

drop trigger if exists birthdays_pin_ownership on public.birthdays;
create trigger birthdays_pin_ownership
  before update on public.birthdays
  for each row execute function public.pin_birthday_ownership();

-- ---------- RPCs: members ----------

create or replace function public.list_family_members(p_family_id uuid)
returns table (user_id uuid, email text, role text, joined_at timestamptz)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not public.is_family_member(p_family_id) then
    raise exception 'not_member';
  end if;

  return query
    select m.user_id, u.email::text, m.role, m.joined_at
    from public.family_members m
    join auth.users u on u.id = m.user_id
    where m.family_id = p_family_id
    order by m.role desc, m.joined_at;
end;
$$;

revoke execute on function public.list_family_members(uuid) from public, anon;
grant  execute on function public.list_family_members(uuid) to authenticated;

create or replace function public.remove_family_member(p_family_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_family_owner(p_family_id) then
    raise exception 'not_owner';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'cannot_remove_self';
  end if;

  delete from public.family_members
    where family_id = p_family_id
      and user_id = p_user_id;

  if not found then
    raise exception 'not_member';
  end if;
end;
$$;

revoke execute on function public.remove_family_member(uuid, uuid) from public, anon;
grant  execute on function public.remove_family_member(uuid, uuid) to authenticated;

create or replace function public.leave_family()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  my_role text;
begin
  select role into my_role
    from public.family_members
    where user_id = auth.uid();

  if my_role is null then
    raise exception 'not_member';
  end if;
  if my_role = 'owner' then
    raise exception 'owner_cannot_leave';
  end if;

  delete from public.family_members where user_id = auth.uid();
end;
$$;

revoke execute on function public.leave_family() from public, anon;
grant  execute on function public.leave_family() to authenticated;

-- ---------- RPCs: invites ----------

create or replace function public.list_invite_codes(p_family_id uuid)
returns table (code text, created_at timestamptz, expires_at timestamptz, uses smallint, max_uses smallint)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not public.is_family_owner(p_family_id) then
    raise exception 'not_owner';
  end if;

  return query
    select i.code, i.created_at, i.expires_at, i.uses, i.max_uses
    from public.family_invites i
    where i.family_id = p_family_id
      and i.expires_at > current_timestamp
      and i.uses < i.max_uses
    order by i.created_at desc;
end;
$$;

revoke execute on function public.list_invite_codes(uuid) from public, anon;
grant  execute on function public.list_invite_codes(uuid) to authenticated;

create or replace function public.revoke_invite_code(p_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  fid uuid;
begin
  select family_id into fid from public.family_invites where code = p_code;

  if fid is null or not public.is_family_owner(fid) then
    raise exception 'invalid_code';
  end if;

  delete from public.family_invites where code = p_code;
end;
$$;

revoke execute on function public.revoke_invite_code(text) from public, anon;
grant  execute on function public.revoke_invite_code(text) to authenticated;
