import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import type { Family } from './useFamily'

// Creates an invite code (owner only, enforced by the RPC) and copies its link.
export function useInviteLink(family: Family, onError: (message: string | null) => void) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  async function copy() {
    setBusy(true)
    onError(null)
    const { data: code, error } = await supabase.rpc('create_invite_code', {
      p_family_id: family.id,
    })
    if (error || !code) {
      onError(error?.message ?? 'Could not create invite code')
      setBusy(false)
      return
    }
    void queryClient.invalidateQueries({ queryKey: ['invites', family.id] })
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/?invite=${code}`)
      setCopied(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 2000)
    } catch {
      onError(`Invite created (code ${code}), but copying the link to the clipboard failed.`)
    }
    setBusy(false)
  }

  return { copy, busy, copied }
}
