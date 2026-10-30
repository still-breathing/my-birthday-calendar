import { useQuery } from '@tanstack/react-query'
import { supabase } from '../supabase'

export interface Family {
  id: string
  name: string
}

export type FamilyRole = 'owner' | 'member'

interface MembershipRow {
  role: FamilyRole
  families: Family | Family[] | null
}

export function useFamily(userId: string | undefined) {
  const query = useQuery({
    queryKey: ['family', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('family_members')
        .select('role, families(id, name)')
        .eq('user_id', userId!)
        .maybeSingle()
      if (error) throw error
      const row = data as MembershipRow | null
      const family = Array.isArray(row?.families) ? row.families[0] : row?.families
      if (!row || !family) return { family: null, role: null }
      return { family, role: row.role }
    },
  })

  return {
    family: query.data?.family ?? null,
    role: query.data?.role ?? null,
    loading: query.isLoading,
    error: query.error,
  }
}
