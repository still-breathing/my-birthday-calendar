-- ============================================================
-- Family Birthdays — Phase 1b: schema, RLS, triggers, RPCs
-- ============================================================

-- ---------- Tables ----------

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default current_timestamp
);

create table public.families (
  id         uuid primary key default pg_catalog.gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default current_timestamp
);

create table public.family_members (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default current_timestamp,
  primary key (family_id, user_id),
  unique (user_id)
);

create table public.birthdays (
  id         uuid primary key default pg_catalog.gen_random_uuid(),
  family_id  uuid not null references public.families(id) on delete cascade,
  name       text not null,
  month      smallint not null check (month between 1 and 12),
  day        smallint not null check (
    day between 1 and
    case month
      when 2 then 29
      when 4 then 30
      when 6 then 30
      when 9 then 30
      when 11 then 30
      else 31
    end
  ),
  birth_year smallint check (birth_year is null or birth_year between 1900 and 2100),
  is_kid     boolean not null default false,
  note       text,
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default current_timestamp,
  deleted    boolean not null default false
);
create index birthdays_family_idx  on public.birthdays (family_id) where not deleted;
create index birthdays_updated_idx on public.birthdays (family_id, updated_at);

create table public.family_invites (
  code       text primary key,
  family_id  uuid not null references public.families(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default current_timestamp,
  expires_at timestamptz not null,
  max_uses   smallint not null default 20,
  uses       smallint not null default 0
);

-- ---------- Helper: is_family_member ----------

create or replace function public.is_family_member(fid uuid)
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
  );
$$;

revoke execute on function public.is_family_member(uuid) from public, anon;
grant  execute on function public.is_family_member(uuid) to authenticated;

-- ---------- Triggers ----------

-- Auto-create profiles row on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Force birthdays.created_by = auth.uid() on insert.
create or replace function public.set_birthday_created_by()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.created_by := auth.uid();
  return new;
end;
$$;

create trigger birthdays_set_created_by
  before insert on public.birthdays
  for each row execute function public.set_birthday_created_by();

-- Maintain birthdays.updated_at.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := current_timestamp;
  return new;
end;
$$;

create trigger birthdays_set_updated_at
  before update on public.birthdays
  for each row execute function public.set_updated_at();

-- ---------- RLS ----------

alter table public.profiles       enable row level security;
alter table public.families       enable row level security;
alter table public.family_members enable row level security;
alter table public.birthdays      enable row level security;
alter table public.family_invites enable row level security;

-- profiles: user can only read/write own row.
create policy "own_profile" on public.profiles
  for all
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- families: members can read their family.
create policy "family_members_select_families" on public.families
  for select
  to authenticated
  using (public.is_family_member(id));

-- family_members: members can read their family's roster.
create policy "family_members_select" on public.family_members
  for select
  to authenticated
  using (public.is_family_member(family_id));

-- birthdays: full CRUD scoped to the user's family.
create policy "family_members_select_birthdays" on public.birthdays
  for select
  to authenticated
  using (public.is_family_member(family_id));

create policy "family_members_insert_birthdays" on public.birthdays
  for insert
  to authenticated
  with check (public.is_family_member(family_id));

create policy "family_members_update_birthdays" on public.birthdays
  for update
  to authenticated
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

-- family_invites: NO policies. Deny-by-default. Access only via SECURITY DEFINER RPCs.

-- ---------- RPCs ----------

-- Owner-only: generate an 8-char invite code.
create or replace function public.create_invite_code(
  p_family_id uuid,
  p_days      int default 7,
  p_max_uses  int default 20
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  alphabet  constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code  text := '';
  i         int;
begin
  if p_days is null or p_days < 1 or p_days > 30 then
    raise exception 'invalid_days';
  end if;
  if p_max_uses is null or p_max_uses < 1 or p_max_uses > 100 then
    raise exception 'invalid_max_uses';
  end if;

  if not exists (
    select 1 from public.family_members
    where family_id = p_family_id
      and user_id = auth.uid()
      and role = 'owner'
  ) then
    raise exception 'not_owner';
  end if;

  for i in 1..8 loop
    new_code := new_code
      || substr(alphabet, floor(pg_catalog.random() * 32)::int + 1, 1);
  end loop;

  insert into public.family_invites
    (code, family_id, created_by, expires_at, max_uses)
  values
    (new_code, p_family_id, auth.uid(),
     current_timestamp + (p_days || ' days')::interval,
     p_max_uses);

  return new_code;
end;
$$;

revoke execute on function public.create_invite_code(uuid, int, int) from public, anon;
grant  execute on function public.create_invite_code(uuid, int, int) to authenticated;

-- Any authenticated user with a valid code joins the family.
create or replace function public.redeem_invite_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv             public.family_invites%rowtype;
  existing_family uuid;
begin
  select family_id into existing_family
    from public.family_members
    where user_id = auth.uid();

  if existing_family is not null then
    raise exception 'already_in_family';
  end if;

  select * into inv
    from public.family_invites
    where code = p_code
    for update;

  if not found then
    raise exception 'invalid_code';
  end if;
  if inv.expires_at < current_timestamp then
    raise exception 'expired';
  end if;
  if inv.uses >= inv.max_uses then
    raise exception 'code_exhausted';
  end if;

  insert into public.family_members (family_id, user_id, role)
    values (inv.family_id, auth.uid(), 'member');

  update public.family_invites
    set uses = uses + 1
    where code = p_code;

  return inv.family_id;
end;
$$;

revoke execute on function public.redeem_invite_code(text) from public, anon;
grant  execute on function public.redeem_invite_code(text) to authenticated;
