import { Logo } from '../components/Logo'

export function AuthHeader() {
  return (
    <header className="auth-header">
      <h1>
        <Logo className="auth-logo" tight animated />
        Family Birthdays
      </h1>
      <p>Remember the special days of the ones you love.</p>
    </header>
  )
}
