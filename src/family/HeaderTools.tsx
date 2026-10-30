import { useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { CheckIcon, InfoIcon, MenuIcon, SignOutIcon, UserPlusIcon, UsersIcon } from '../components/Icons'
import type { Family, FamilyRole } from './useFamily'
import { useInviteLink } from './useInviteLink'

// __APP_VERSION__ is "<package version>+<commit>" (vite.config.ts).
const [version, build = 'local'] = __APP_VERSION__.split('+')

// Header menu: account info, invite / family / sign-out actions, and build info.
export function HeaderTools({
  user,
  family,
  role,
  onOpenFamily,
  onSignOut,
  onError,
}: {
  user: User
  family: Family
  role: FamilyRole | null
  onOpenFamily: () => void
  onSignOut: () => void
  onError: (message: string | null) => void
}) {
  const invite = useInviteLink(family, onError)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function pick(action: () => void) {
    setOpen(false)
    action()
  }

  return (
    <div className="tools" ref={ref}>
      <button
        className={`tool${invite.copied ? ' primary' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label={invite.copied ? 'Invite link copied. Menu' : 'Menu'}
        title={invite.copied ? 'Invite link copied' : 'Menu'}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {invite.copied ? <CheckIcon /> : <MenuIcon />}
      </button>
      {open && (
        <div className="tool-menu" role="menu">
          <div className="tool-menu-head">
            <small>Signed in as</small>
            <span>{user.email}</span>
          </div>
          {role === 'owner' && (
            <button role="menuitem" onClick={() => pick(invite.copy)} disabled={invite.busy}>
              <UserPlusIcon /> Copy invite link
            </button>
          )}
          <button role="menuitem" onClick={() => pick(onOpenFamily)}>
            <UsersIcon /> Family members
          </button>
          <button role="menuitem" onClick={() => pick(onSignOut)}>
            <SignOutIcon /> Sign out
          </button>
          <div className="tool-menu-about">
            <InfoIcon />
            <span>
              About
              <small>
                v{version} · {build}
              </small>
            </span>
            <i className={import.meta.env.DEV ? 'dev' : 'prod'}>
              {import.meta.env.DEV ? 'Dev' : 'Production'}
            </i>
          </div>
        </div>
      )}
    </div>
  )
}
