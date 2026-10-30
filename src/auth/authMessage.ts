import type { AuthError } from '@supabase/supabase-js'

// Plain-language versions of the Supabase auth errors people actually hit.
const MESSAGES: Record<string, string> = {
  invalid_credentials:
    'Wrong email or password. Check them and try again, or reset your password.',
  email_not_confirmed:
    'Please confirm your email first. Open the link we sent you, then sign in.',
  user_already_exists:
    'An account with this email already exists. Sign in instead.',
  weak_password: 'That password is too weak. Use at least 6 characters.',
  over_email_send_rate_limit:
    'Too many emails sent. Please wait a minute and try again.',
  over_request_rate_limit:
    'Too many attempts. Please wait a minute and try again.',
}

export function authMessage(error: AuthError): string {
  return (error.code && MESSAGES[error.code]) || error.message
}
