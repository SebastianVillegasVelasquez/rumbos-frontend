const LOCAL_HOSTS: readonly string[] = ['localhost', '127.0.0.1']

// The host origin comes from the iframe URL (`?host=`), so it is untrusted
// input too. It must be an exact origin: the string given has to equal the
// origin it parses to, so no path, query, hash, userinfo or trailing slash.
// The scheme must be https; plain http is accepted only for localhost and
// 127.0.0.1, and only when the caller says this is a development build.
// Returns the origin, or null.
export const parseHostOrigin = (raw: string | null, allowLocalHttp = false): string | null => {
  if (!raw) return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.origin !== raw) return null
  if (url.protocol === 'https:') return url.origin
  if (url.protocol === 'http:' && allowLocalHttp && LOCAL_HOSTS.includes(url.hostname)) {
    return url.origin
  }
  return null
}

// A reported origin (from the backend) in its normalized form, ignoring a
// trailing slash or path: http(s) only, no userinfo. Used to compare, never to
// decide what to trust.
export const normalizeOrigin = (raw: string): string | null => {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (url.username || url.password) return null
    return url.origin
  } catch {
    return null
  }
}
