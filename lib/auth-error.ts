type AuthErrorLike = {
  code?: string
  message: string
  status?: number
}

export function getAuthEmailErrorMessage(
  error: AuthErrorLike,
  action: 'sign-up' | 'password-reset'
): string {
  const isEmailRateLimit =
    error.code === 'over_email_send_rate_limit'
    || (error.status === 429 && /email|rate limit/i.test(error.message))

  if (isEmailRateLimit) {
    return action === 'sign-up'
      ? 'Too many confirmation emails were requested. Please wait about an hour before trying again.'
      : 'Too many account emails were requested. Please wait about an hour before trying again.'
  }

  if (error.code === 'email_address_not_authorized') {
    return action === 'sign-up'
      ? 'Email sign-up is not configured for this address yet. Please contact the league owner.'
      : 'Password-reset emails are not configured for this address yet. Please contact the league owner.'
  }

  if (error.code === 'over_request_rate_limit' || error.status === 429) {
    return 'Too many attempts were made. Please wait a few minutes and try again.'
  }

  return error.message
}
