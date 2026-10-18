// A stand-in for the plugin's RS256 launch assertion, for the mock host and the
// mock API only. The real app treats the assertion as an opaque string; only
// the mock backend decodes this one. It carries no secret and proves nothing.

export interface MockAssertionClaims {
  role: 'editor' | 'student'
  course: number
  // The origin the mock backend reports back as the tenant's registered host.
  host: string
  jti: string
  // Seconds since the epoch.
  exp: number
  // Seconds an access token issued from this assertion lives (default 900).
  ttl?: number
  tenantDisabled?: boolean
}

const toBase64Url = (text: string) =>
  btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const fromBase64Url = (text: string) =>
  atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4))

export const encodeMockAssertion = (claims: MockAssertionClaims) =>
  `mock.${toBase64Url(JSON.stringify(claims))}.sig`

export const decodeMockAssertion = (assertion: string): MockAssertionClaims | null => {
  const parts = assertion.split('.')
  if (parts.length !== 3 || parts[0] !== 'mock') return null
  try {
    const claims = JSON.parse(fromBase64Url(parts[1])) as Partial<MockAssertionClaims>
    if (
      (claims.role !== 'editor' && claims.role !== 'student') ||
      typeof claims.course !== 'number' ||
      typeof claims.host !== 'string' ||
      typeof claims.jti !== 'string' ||
      typeof claims.exp !== 'number'
    )
      return null
    return claims as MockAssertionClaims
  } catch {
    return null
  }
}
