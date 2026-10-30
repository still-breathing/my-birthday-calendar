-- ============================================================
-- Self-serve family creation (PUBLIC deployment only).
-- Do NOT apply this to the private "family" Supabase project:
-- there, the owner creates the family directly in the database
-- and everyone else joins through an invite code.
-- ============================================================

create or replace function public.create_family(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  fid uuid;
  nm  text := nullif(btrim(p_name), '');
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if nm is null or char_length(nm) > 60 then
    raise exception 'invalid_name';
  end if;
  if exists (select 1 from public.family_members where user_id = auth.uid()) then
    raise exception 'already_in_family';
  end if;

  insert into public.families (name) values (nm) returning id into fid;
  insert into public.family_members (family_id, user_id, role)
    values (fid, auth.uid(), 'owner');

  return fid;
end;
$$;

revoke execute on function public.create_family(text) from public, anon;
grant  execute on function public.create_family(text) to authenticated;
