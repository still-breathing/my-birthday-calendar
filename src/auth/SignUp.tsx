import { useState, type FormEvent } from 'react'
import { useAuth } from './useAuth'
import { AuthHeader } from './AuthHeader'
import { authMessage } from './authMessage'

export function SignUp({ onSwitch }: { onSwitch: () => void }) {
  const { signUp, signInWithGoogle } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error, needsConfirmation } = await signUp(email, password)
    if (error) setError(authMessage(error))
    else if (needsConfirmation) setSent(true)
    setBusy(false)
  }

  async function onGoogle() {
    setError(null)
    const { error } = await signInWithGoogle()
    if (error) setError(authMessage(error))
  }

  if (sent) {
    return (
      <div className="auth-layout">
        <AuthHeader />
        <div className="auth-panel">
          <h1>Check your email</h1>
          <p>We sent a confirmation link to {email}. Open it, then sign in.</p>
          <p className="auth-switch">
            <button type="button" className="auth-link" onClick={onSwitch}>
              Back to sign in
            </button>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-layout">
      <AuthHeader />
      <div className="auth-panel">
        <h1>Create account</h1>
        <form onSubmit={onSubmit}>
          <input
            type="email"
            autoComplete="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="auth-btn-primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </form>
        <button type="button" className="auth-btn-secondary" onClick={onGoogle}>
          Continue with Google
        </button>
        <div className="auth-divider">or</div>
        <p className="auth-switch">
          Already have an account?{' '}
          <button type="button" className="auth-link" onClick={onSwitch}>
            Sign in
          </button>
        </p>
      </div>
    </div>
  )
}
