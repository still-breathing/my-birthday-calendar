import { useState, type FormEvent } from 'react'
import { useAuth } from './useAuth'
import { AuthHeader } from './AuthHeader'
import { authMessage } from './authMessage'

export function SignIn({ onSwitch }: { onSwitch: () => void }) {
  const { signIn, signInWithGoogle, resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showReset, setShowReset] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await signIn(email, password)
    if (error) setError(authMessage(error))
    setBusy(false)
  }

  async function onReset(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setResetSent(false)
    const { error } = await resetPassword(email)
    if (error) setError(authMessage(error))
    else setResetSent(true)
    setBusy(false)
  }

  async function onGoogle() {
    setError(null)
    const { error } = await signInWithGoogle()
    if (error) setError(authMessage(error))
  }

  function toggleReset(next: boolean) {
    setShowReset(next)
    setError(null)
    setResetSent(false)
  }

  if (showReset) {
    return (
      <div className="auth-layout">
        <AuthHeader />
        <div className="auth-panel">
          <h1>Reset password</h1>
          <form onSubmit={onReset}>
            <input
              type="email"
              autoComplete="email"
              placeholder="Email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setError(null)
              }}
            />
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="auth-btn-primary" disabled={busy}>
              {busy ? 'Sending…' : 'Send Reset Link'}
            </button>
          </form>
          {resetSent && (
            <p className="auth-success">Check your email for a reset link.</p>
          )}
          <p className="auth-switch">
            Remembered it?{' '}
            <button
              type="button"
              className="auth-link"
              onClick={() => toggleReset(false)}
            >
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
        <h1>Sign in</h1>
        <form onSubmit={onSubmit}>
          <input
            type="email"
            autoComplete="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError(null)
            }}
          />
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            required
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError(null)
            }}
          />
          <button
            type="button"
            className="auth-link auth-forgot"
            onClick={() => toggleReset(true)}
          >
            Forgot password?
          </button>
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="auth-btn-primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <button type="button" className="auth-btn-secondary" onClick={onGoogle}>
          Continue with Google
        </button>
        <div className="auth-divider">or</div>
        <p className="auth-switch">
          <button type="button" className="auth-link" onClick={onSwitch}>
            Create an account
          </button>
        </p>
      </div>
    </div>
  )
}
