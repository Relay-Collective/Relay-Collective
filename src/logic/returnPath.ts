// Where to send someone after they sign in. Only a page on this site.
export function returnPath(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  if (!value.startsWith('/') || value.startsWith('//')) return undefined
  if (
    value.startsWith('/signin') ||
    value.startsWith('/signed-in') ||
    value.startsWith('/register') ||
    value.startsWith('/forgot-password') ||
    value.startsWith('/reset-password') ||
    value.startsWith('/welcome')
  ) {
    return undefined
  }
  return value
}
