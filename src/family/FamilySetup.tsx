import { useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import { useAuth } from '../auth/useAuth'
import { APP_MODE } from '../config'

// Shown to a signed-in user who isn't in a family yet.
export function FamilySetup({ user }: { user: User }) {
  const { signOut } = useAuth()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true)
    setError(null)
    const { error } = await fn()
    if (error) setError(error.message)
    else await queryClient.invalidateQueries({ queryKey: ['family'] })
    setBusy(false)
  }

  function onCreate(e: FormEvent) {
    e.preventDefault()
    void run(() => supabase.rpc('create_family', { p_name: name }))
  }

  function onJoin(e: FormEvent) {
    e.preventDefault()
    void run(() => supabase.rpc('redeem_invite_code', { p_code: code.trim().toUpperCase() }))
  }

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        {APP_MODE === 'public' && (
          <>
            <h1>Create your family</h1>
            <form onSubmit={onCreate}>
              <input
                placeholder="Family name"
                required
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button type="submit" className="auth-btn-primary" disabled={busy}>
                Create family
              </button>
            </form>
            <div className="auth-divider">or</div>
          </>
        )}
        <h1>Join with an invite code</h1>
        {APP_MODE === 'family' && <p>Ask a family member for an invite link or code.</p>}
        <form onSubmit={onJoin}>
          <input
            placeholder="Invite code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button type="submit" className="auth-btn-secondary" disabled={busy}>
            Join family
          </button>
        </form>
        {error && <p className="auth-error">{error}</p>}
        <p>Signed in as {user.email}</p>
        <button className="auth-btn-secondary" onClick={() => signOut()}>
          Sign out
        </button>
      </div>
    </div>
  )
}
