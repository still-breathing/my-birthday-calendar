import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'

export interface Birthday {
  id: string
  family_id: string
  name: string
  month: number
  day: number
  birth_year: number | null
  is_kid: boolean
  note: string | null
  created_by: string | null
}

export type BirthdayInput = Pick<
  Birthday,
  'name' | 'month' | 'day' | 'birth_year' | 'is_kid' | 'note'
>

// A birthday plus days until its next occurrence.
export type Person = Birthday & { u: number }

export function useBirthdays(familyId: string | undefined) {
  return useQuery({
    queryKey: ['birthdays', familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('birthdays')
        .select('id, family_id, name, month, day, birth_year, is_kid, note, created_by')
        .eq('family_id', familyId!)
        .eq('deleted', false)
        .order('month')
        .order('day')
      if (error) throw error
      return data as Birthday[]
    },
  })
}

function useInvalidate(familyId: string) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['birthdays', familyId] })
}

export function useAddBirthday(familyId: string) {
  const invalidate = useInvalidate(familyId)
  return useMutation({
    mutationFn: async (input: BirthdayInput) => {
      const { error } = await supabase
        .from('birthdays')
        .insert({ ...input, family_id: familyId })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useUpdateBirthday(familyId: string) {
  const invalidate = useInvalidate(familyId)
  return useMutation({
    mutationFn: async ({ id, ...input }: BirthdayInput & { id: string }) => {
      const { error } = await supabase.from('birthdays').update(input).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useDeleteBirthday(familyId: string) {
  const invalidate = useInvalidate(familyId)
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('birthdays').update({ deleted: true }).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}
