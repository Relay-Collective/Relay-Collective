// An email link (confirmation, reset) that the auth provider turned down comes back with the reason in the
// address, e.g. #error=access_denied&error_code=otp_expired. Nothing secret is in it; only the kind is used.
export type LinkError = 'EXPIRED' | 'INVALID'

export function linkError(): LinkError | undefined {
  const params = new URLSearchParams(`${window.location.search.slice(1)}&${window.location.hash.replace(/^#/, '')}`)
  const code = params.get('error_code')
  if (!code && !params.get('error')) return undefined
  return code === 'otp_expired' ? 'EXPIRED' : 'INVALID'
}
