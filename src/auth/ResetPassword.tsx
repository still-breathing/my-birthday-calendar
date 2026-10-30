import { useState, type FormEvent } from 'react'
import { useAuth } from './useAuth'
import { AuthHeader } from './AuthHeader'
import { authMessage } from './authMessage'

// Shown after the user follows the emailed reset link (isRecovering). They are
// already signed in by the link, so on success updatePassword clears the
// recovery flag and they continue into the app.
export function ResetPassword() {
  const { updatePassword, cancelRecovery } = useAuth()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await updatePassword(password)
    if (error) {
      setError(authMessage(error))
      setBusy(false)
    }
  }

  return (
    <div className="auth-layout">
      <AuthHeader />
      <div className="auth-panel">
        <h1>Set new password</h1>
        <form onSubmit={onSubmit}>
          <input
            type="password"
            autoComplete="new-password"
            placeholder="New password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" className="auth-btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Update password'}
          </button>
        </form>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <p className="auth-switch">
          <button
            type="button"
            className="auth-link"
            onClick={() => cancelRecovery()}
            disabled={busy}
          >
            Cancel and back to sign in
          </button>
        </p>
      </div>
    </div>
  )
}
