import { useEffect, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'

const KEY = 'pending_invite'

// Redeems a pending invite code (saved by AuthProvider) once the user is signed in.
export function InviteRedeemer({ user, children }: { user: User; children: ReactNode }) {
  const queryClient = useQueryClient()
  const [redeeming, setRedeeming] = useState(() => !!sessionStorage.getItem(KEY))

  useEffect(() => {
    const code = sessionStorage.getItem(KEY)
    if (!code) return
    // Clear up front so a StrictMode re-run or reload can't redeem the same code twice.
    sessionStorage.removeItem(KEY)

    void (async () => {
      const { error } = await supabase.rpc('redeem_invite_code', { p_code: code })
      if (error) {
        window.alert(`Could not join family: ${error.message}`)
      } else {
        const url = new URL(window.location.href)
        if (url.searchParams.has('invite')) {
          url.searchParams.delete('invite')
          window.history.replaceState(null, '', url.pathname + url.search + url.hash)
        }
        await queryClient.invalidateQueries({ queryKey: ['family'] })
      }
      setRedeeming(false)
    })()
  }, [user.id, queryClient])

  if (redeeming) return <div className="auth-shell">Joining family…</div>
  return <>{children}</>
}
