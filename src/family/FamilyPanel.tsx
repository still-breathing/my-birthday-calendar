import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Family, FamilyRole } from './useFamily'
import { useInvites, useLeaveFamily, useMembers, useRemoveMember, useRevokeInvite } from './useMembers'

const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

// Members and invites: the owner manages them, a member can leave.
export function FamilyPanel({
  user,
  family,
  role,
  onClose,
}: {
  user: User
  family: Family
  role: FamilyRole | null
  onClose: () => void
}) {
  const isOwner = role === 'owner'
  const members = useMembers(family.id)
  const invites = useInvites(family.id, isOwner)
  const removeMember = useRemoveMember(family.id)
  const revokeInvite = useRevokeInvite(family.id)
  const leaveFamily = useLeaveFamily()
  // Destructive actions need a second tap, like Delete in the birthday modal.
  const [armed, setArmed] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function confirmThen(key: string, action: () => void) {
    if (armed !== key) return setArmed(key)
    setArmed(null)
    action()
  }

  const error =
    members.error ?? invites.error ?? removeMember.error ?? revokeInvite.error ?? leaveFamily.error

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fp"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="sheet">
        <h3 id="fp">{family.name}</h3>

        <h4>Members</h4>
        {members.isLoading && <p className="hint">Loading…</p>}
        <ul className="rows">
          {members.data?.map((m) => (
            <li key={m.user_id}>
              <span>
                {m.email} {m.user_id === user.id && <small>(you)</small>}
                <br />
                <small>
                  {m.role} · joined {fmt(m.joined_at)}
                </small>
              </span>
              {isOwner && m.user_id !== user.id && (
                <button
                  disabled={removeMember.isPending}
                  onClick={() => confirmThen(`m:${m.user_id}`, () => removeMember.mutate(m.user_id))}
                >
                  {armed === `m:${m.user_id}` ? 'Tap again' : 'Remove'}
                </button>
              )}
            </li>
          ))}
        </ul>

        {isOwner && (
          <>
            <h4>Active invite codes</h4>
            {invites.data?.length === 0 && <p className="hint">None. Use “Generate Invite Link”.</p>}
            <ul className="rows">
              {invites.data?.map((i) => (
                <li key={i.code}>
                  <span>
                    <code>{i.code}</code>
                    <br />
                    <small>
                      {i.uses}/{i.max_uses} used · expires {fmt(i.expires_at)}
                    </small>
                  </span>
                  <button
                    disabled={revokeInvite.isPending}
                    onClick={() => confirmThen(`i:${i.code}`, () => revokeInvite.mutate(i.code))}
                  >
                    {armed === `i:${i.code}` ? 'Tap again' : 'Revoke'}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {error && (
          <p className="err" role="alert">
            {error.message}
          </p>
        )}

        <div className="acts">
          {!isOwner && (
            <button
              type="button"
              className="del"
              disabled={leaveFamily.isPending}
              onClick={() => confirmThen('leave', () => leaveFamily.mutate())}
            >
              {armed === 'leave' ? 'Tap again to leave' : 'Leave family'}
            </button>
          )}
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
