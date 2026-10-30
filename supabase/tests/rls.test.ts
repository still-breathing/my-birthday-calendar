// Runs the real migrations in an in-process Postgres (PGlite) with a minimal
// stand-in for Supabase's auth schema, then exercises RLS and RPCs as users.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const root = join(__dirname, '..')
const sql = (p: string) => readFileSync(join(root, p), 'utf8')

const OWNER = '00000000-0000-0000-0000-00000000000a'
const MEMBER = '00000000-0000-0000-0000-00000000000b'
const STRANGER = '00000000-0000-0000-0000-00000000000c'
const OTHER_OWNER = '00000000-0000-0000-0000-00000000000d'

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
`

const GRANTS = `
  grant select, insert, update, delete on all tables in schema public to authenticated;
`

let db: PGlite

// Run a query as an authenticated user (RLS enforced). The savepoint keeps the
// test's transaction usable when the query is expected to fail.
async function as<T = Record<string, unknown>>(uid: string, query: string, params: unknown[] = []) {
  await db.exec('savepoint q')
  try {
    await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid])
    await db.exec('set local role authenticated')
    const rows = (await db.query<T>(query, params)).rows
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', true); release savepoint q`)
    return rows
  } catch (e) {
    await db.exec('rollback to savepoint q; release savepoint q')
    throw e
  }
}

async function addUser(id: string, email: string) {
  await db.query('insert into auth.users (id, email) values ($1, $2)', [id, email])
}

async function familyOf(uid: string) {
  const r = await db.query<{ family_id: string }>(
    'select family_id from public.family_members where user_id = $1',
    [uid],
  )
  return r.rows[0]?.family_id ?? null
}

async function invite(uid: string, fid: string) {
  const [{ code }] = await as<{ code: string }>(uid, 'select public.create_invite_code($1) as code', [fid])
  return code
}

// One database for the file; each test runs in a transaction that is rolled back.
beforeAll(async () => {
  db = new PGlite()
  await db.exec(SUPABASE_STUB)
  await db.exec(sql('migrations/0001_init.sql'))
  await db.exec(sql('migrations/0002_create_family.sql'))
  await db.exec(sql('migrations/0003_members_and_permissions.sql'))
  await db.exec(GRANTS)

  await addUser(OWNER, 'owner@test.local')
  await addUser(MEMBER, 'member@test.local')
  await addUser(STRANGER, 'stranger@test.local')
  await addUser(OTHER_OWNER, 'other@test.local')

  // A family for OWNER with a few sample birthdays (run as the SQL editor would: no auth.uid()).
  await db.exec(`
    do $$
    declare fid uuid;
    begin
      insert into public.families (name) values ('Test Family') returning id into fid;
      insert into public.family_members (family_id, user_id, role) values (fid, '${OWNER}', 'owner');
      insert into public.birthdays (family_id, month, day, name, is_kid) values
        (fid, 1, 5, 'Sample One', false),
        (fid, 6, 12, 'Sample Two', false),
        (fid, 11, 30, 'Sample Three', true);
    end $$;
  `)
}, 60_000)

afterAll(() => db.close())

beforeEach(() => db.exec('begin'))
afterEach(() => db.exec('rollback'))

describe('fixture', () => {
  it('creates the family with OWNER as owner and 3 birthdays', async () => {
    const fid = await familyOf(OWNER)
    expect(fid).not.toBeNull()
    const n = await db.query<{ n: number }>('select count(*)::int n from public.birthdays where family_id = $1', [fid])
    expect(n.rows[0].n).toBe(3)
  })
})

describe('isolation between families', () => {
  it('a user without a family sees nothing', async () => {
    expect(await as(STRANGER, 'select * from public.birthdays')).toHaveLength(0)
    expect(await as(STRANGER, 'select * from public.families')).toHaveLength(0)
    expect(await as(STRANGER, 'select * from public.family_members')).toHaveLength(0)
    expect(await as(STRANGER, 'select * from public.family_invites')).toHaveLength(0)
  })

  it('create_family gives a new empty family, once', async () => {
    const [{ fid }] = await as<{ fid: string }>(STRANGER, `select public.create_family('Strangers') fid`)
    expect(fid).not.toBe(await familyOf(OWNER))
    expect(await as(STRANGER, 'select * from public.birthdays')).toHaveLength(0)
    await expect(as(STRANGER, `select public.create_family('Again')`)).rejects.toThrow(/already_in_family/)
  })

  it("another family can't read, insert, update or delete the existing family's rows", async () => {
    const familyFid = (await familyOf(OWNER))!
    await as(OTHER_OWNER, `select public.create_family('Others')`)

    expect(await as(OTHER_OWNER, 'select * from public.birthdays where family_id = $1', [familyFid])).toHaveLength(0)
    await expect(
      as(OTHER_OWNER, `insert into public.birthdays (family_id, name, month, day) values ($1, 'X', 1, 1)`, [familyFid]),
    ).rejects.toThrow(/row-level security/)

    await as(OTHER_OWNER, `update public.birthdays set name = 'hacked', deleted = true where family_id = $1`, [familyFid])
    await as(OTHER_OWNER, 'delete from public.birthdays where family_id = $1', [familyFid])
    const r = await db.query<{ n: number }>(
      `select count(*)::int n from public.birthdays where family_id = $1 and name <> 'hacked' and not deleted`,
      [familyFid],
    )
    expect(r.rows[0].n).toBe(3)
  })

  it("the existing family can't see another family's rows", async () => {
    const [{ fid }] = await as<{ fid: string }>(OTHER_OWNER, `select public.create_family('Others') fid`)
    await as(OTHER_OWNER, `insert into public.birthdays (family_id, name, month, day) values ($1, 'Secret', 2, 2)`, [fid])
    expect(await as(OWNER, `select * from public.birthdays where name = 'Secret'`)).toHaveLength(0)
    expect(await as(OWNER, 'select * from public.families')).toHaveLength(1)
  })

  it('members can only list their own family', async () => {
    const [{ fid }] = await as<{ fid: string }>(OTHER_OWNER, `select public.create_family('Others') fid`)
    await expect(as(OWNER, 'select * from public.list_family_members($1)', [fid])).rejects.toThrow(/not_member/)
  })
})

describe('edit permissions', () => {
  let fid: string
  let memberRow: string
  let existingRow: string

  beforeEach(async () => {
    fid = (await familyOf(OWNER))!
    await as(MEMBER, 'select public.redeem_invite_code($1)', [await invite(OWNER, fid)])
    const [row] = await as<{ id: string }>(
      MEMBER,
      `insert into public.birthdays (family_id, name, month, day) values ($1, 'Mine', 3, 3) returning id`,
      [fid],
    )
    memberRow = row.id
    existingRow = (await db.query<{ id: string }>(`select id from public.birthdays where name = 'Sample One'`)).rows[0].id
  })

  const nameOf = async (id: string) =>
    (await db.query<{ name: string; deleted: boolean }>('select name, deleted from public.birthdays where id = $1', [id])).rows[0]

  it('member sees all family birthdays', async () => {
    expect(await as(MEMBER, 'select * from public.birthdays')).toHaveLength(4)
  })

  it('member edits and deletes their own entry', async () => {
    await as(MEMBER, `update public.birthdays set name = 'Mine2' where id = $1`, [memberRow])
    expect((await nameOf(memberRow)).name).toBe('Mine2')
    await as(MEMBER, 'update public.birthdays set deleted = true where id = $1', [memberRow])
    expect((await nameOf(memberRow)).deleted).toBe(true)
  })

  it("member can't edit or delete existing or other people's entries", async () => {
    await as(MEMBER, `update public.birthdays set name = 'X', deleted = true where id = $1`, [existingRow])
    expect(await nameOf(existingRow)).toEqual({ name: 'Sample One', deleted: false })

    const [ownerRow] = await as<{ id: string }>(
      OWNER,
      `insert into public.birthdays (family_id, name, month, day) values ($1, 'OwnerAdded', 4, 4) returning id`,
      [fid],
    )
    await as(MEMBER, `update public.birthdays set name = 'X' where id = $1`, [ownerRow.id])
    expect((await nameOf(ownerRow.id)).name).toBe('OwnerAdded')
  })

  it('owner edits any entry', async () => {
    await as(OWNER, `update public.birthdays set name = 'ByOwner' where id = $1`, [memberRow])
    await as(OWNER, `update public.birthdays set note = 'hi' where id = $1`, [existingRow])
    expect((await nameOf(memberRow)).name).toBe('ByOwner')
  })

  it('nobody can hard-delete rows', async () => {
    await as(OWNER, 'delete from public.birthdays where id = $1', [existingRow])
    expect(await nameOf(existingRow)).toBeDefined()
  })

  it("family_id and created_by can't be changed", async () => {
    const [{ fid: other }] = await as<{ fid: string }>(OTHER_OWNER, `select public.create_family('Others') fid`)
    await as(MEMBER, `update public.birthdays set family_id = $2, created_by = $3 where id = $1`, [memberRow, other, OWNER])
    const r = await db.query<{ family_id: string; created_by: string }>(
      'select family_id, created_by from public.birthdays where id = $1',
      [memberRow],
    )
    expect(r.rows[0]).toEqual({ family_id: fid, created_by: MEMBER })
  })

  it('created_by is forced to the inserting user', async () => {
    const [row] = await as<{ created_by: string }>(
      MEMBER,
      `insert into public.birthdays (family_id, name, month, day, created_by) values ($1, 'Spoof', 5, 5, $2) returning created_by`,
      [fid, OWNER],
    )
    expect(row.created_by).toBe(MEMBER)
  })
})

describe('invites', () => {
  let fid: string
  beforeEach(async () => {
    fid = (await familyOf(OWNER))!
  })

  it('redeem joins the family; a second family is refused', async () => {
    const code = await invite(OWNER, fid)
    await as(MEMBER, 'select public.redeem_invite_code($1)', [code])
    expect(await familyOf(MEMBER)).toBe(fid)
    await expect(as(MEMBER, 'select public.redeem_invite_code($1)', [code])).rejects.toThrow(/already_in_family/)
  })

  it('expired, exhausted and revoked codes fail', async () => {
    const expired = await invite(OWNER, fid)
    await db.query(`update public.family_invites set expires_at = now() - interval '1 day' where code = $1`, [expired])
    await expect(as(MEMBER, 'select public.redeem_invite_code($1)', [expired])).rejects.toThrow(/expired/)

    const used = await invite(OWNER, fid)
    await db.query('update public.family_invites set uses = max_uses where code = $1', [used])
    await expect(as(MEMBER, 'select public.redeem_invite_code($1)', [used])).rejects.toThrow(/code_exhausted/)

    const revoked = await invite(OWNER, fid)
    await as(OWNER, 'select public.revoke_invite_code($1)', [revoked])
    await expect(as(MEMBER, 'select public.redeem_invite_code($1)', [revoked])).rejects.toThrow(/invalid_code/)
  })

  it('owner lists only active codes', async () => {
    const live = await invite(OWNER, fid)
    const dead = await invite(OWNER, fid)
    await db.query(`update public.family_invites set expires_at = now() - interval '1 day' where code = $1`, [dead])
    const rows = await as<{ code: string }>(OWNER, 'select code from public.list_invite_codes($1)', [fid])
    expect(rows.map((r) => r.code)).toEqual([live])
  })

  it("non-owners can't create, list or revoke codes", async () => {
    const code = await invite(OWNER, fid)
    await as(MEMBER, 'select public.redeem_invite_code($1)', [code])
    await expect(as(MEMBER, 'select public.create_invite_code($1)', [fid])).rejects.toThrow(/not_owner/)
    await expect(as(MEMBER, 'select * from public.list_invite_codes($1)', [fid])).rejects.toThrow(/not_owner/)
    await expect(as(MEMBER, 'select public.revoke_invite_code($1)', [code])).rejects.toThrow(/invalid_code/)
    await as(OTHER_OWNER, `select public.create_family('Others')`)
    await expect(as(OTHER_OWNER, 'select public.revoke_invite_code($1)', [code])).rejects.toThrow(/invalid_code/)
  })
})

describe('membership', () => {
  let fid: string
  beforeEach(async () => {
    fid = (await familyOf(OWNER))!
    await as(MEMBER, 'select public.redeem_invite_code($1)', [await invite(OWNER, fid)])
  })

  it('lists members with emails, owner first', async () => {
    const rows = await as<{ email: string; role: string }>(MEMBER, 'select email, role from public.list_family_members($1)', [fid])
    expect(rows).toEqual([
      { email: 'owner@test.local', role: 'owner' },
      { email: 'member@test.local', role: 'member' },
    ])
  })

  it('owner removes a member, who then loses access', async () => {
    await as(OWNER, 'select public.remove_family_member($1, $2)', [fid, MEMBER])
    expect(await familyOf(MEMBER)).toBeNull()
    expect(await as(MEMBER, 'select * from public.birthdays')).toHaveLength(0)
  })

  it("owner can't remove themself; member can't remove anyone", async () => {
    await expect(as(OWNER, 'select public.remove_family_member($1, $2)', [fid, OWNER])).rejects.toThrow(/cannot_remove_self/)
    await expect(as(MEMBER, 'select public.remove_family_member($1, $2)', [fid, OWNER])).rejects.toThrow(/not_owner/)
  })

  it('member leaves, then can start their own family', async () => {
    await as(MEMBER, 'select public.leave_family()')
    expect(await familyOf(MEMBER)).toBeNull()
    await as(MEMBER, `select public.create_family('New')`)
    expect(await familyOf(MEMBER)).not.toBe(fid)
  })

  it("owner can't leave", async () => {
    await expect(as(OWNER, 'select public.leave_family()')).rejects.toThrow(/owner_cannot_leave/)
  })
})
