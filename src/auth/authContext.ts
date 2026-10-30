import { createContext } from 'react'
import type { AuthError, Session, User } from '@supabase/supabase-js'

export type AuthResult = { error: AuthError | null }

export interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  isRecovering: boolean
  signIn: (email: string, password: string) => Promise<AuthResult>
  signUp: (email: string, password: string) => Promise<AuthResult & { needsConfirmation?: boolean }>
  signInWithGoogle: () => Promise<AuthResult>
  signOut: () => Promise<AuthResult>
  resetPassword: (email: string) => Promise<AuthResult>
  updatePassword: (newPassword: string) => Promise<AuthResult>
  cancelRecovery: () => Promise<AuthResult>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
