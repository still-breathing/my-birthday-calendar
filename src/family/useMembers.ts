import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import type { FamilyRole } from './useFamily'

export interface Member {
  user_id: string
  email: string
  role: FamilyRole
  joined_at: string
}

export interface Invite {
  code: string
  created_at: string
  expires_at: string
  uses: number
  max_uses: number
}

export function useMembers(familyId: string) {
  return useQuery({
    queryKey: ['members', familyId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_family_members', { p_family_id: familyId })
      if (error) throw error
      return data as Member[]
    },
  })
}

export function useInvites(familyId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['invites', familyId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_invite_codes', { p_family_id: familyId })
      if (error) throw error
      return data as Invite[]
    },
  })
}

export function useRemoveMember(familyId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('remove_family_member', {
        p_family_id: familyId,
        p_user_id: userId,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members', familyId] }),
  })
}

export function useRevokeInvite(familyId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (code: string) => {
      const { error } = await supabase.rpc('revoke_invite_code', { p_code: code })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invites', familyId] }),
  })
}

export function useLeaveFamily() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('leave_family')
      if (error) throw error
    },
    // Dropping the membership sends the user back to FamilySetup.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['family'] }),
  })
}
