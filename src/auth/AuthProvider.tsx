import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { AuthContext, type AuthContextValue } from './authContext'

// Preserve an invite code across the OAuth redirect (consumed in 1f).
// Runs at module load so it happens before any auth work.
const invite = new URLSearchParams(window.location.search).get('invite')
if (invite) sessionStorage.setItem('pending_invite', invite)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isRecovering, setIsRecovering] = useState(false)

  useEffect(() => {
    let mounted = true

    const apply = (next: Session | null) => {
      if (!mounted) return
      setSession(next)
      setLoading(false)
      // Drop the OAuth #access_token from the address bar once we have a session.
      if (next && window.location.hash.includes('access_token')) {
        window.history.replaceState(
          null,
          '',
          window.location.pathname + window.location.search,
        )
      }
    }

    // Listener first, so a session parsed from the URL hash isn't missed.
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      // Set before apply() so the recovery screen wins over the signed-in app.
      if (event === 'PASSWORD_RECOVERY') setIsRecovering(true)
      apply(next)
    })

    supabase.auth.getSession().then(({ data }) => apply(data.session))

    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      isRecovering,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return { error }
      },
      signUp: async (email, password) => {
        const { data, error } = await supabase.auth.signUp({ email, password })
        // No session back means Supabase is waiting for the user to confirm their email.
        return { error, needsConfirmation: !error && !data.session }
      },
      signInWithGoogle: async () => {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin },
        })
        return { error }
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut()
        return { error }
      },
      resetPassword: async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        })
        return { error }
      },
      updatePassword: async (newPassword) => {
        const { error } = await supabase.auth.updateUser({ password: newPassword })
        if (!error) setIsRecovering(false)
        return { error }
      },
      // Abandon the reset: drop the session the emailed link created and go back to sign-in.
      cancelRecovery: async () => {
        const { error } = await supabase.auth.signOut()
        setIsRecovering(false)
        return { error }
      },
    }),
    [session, loading, isRecovering],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
