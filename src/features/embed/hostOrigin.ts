// The host origin comes from the iframe URL (`?host=`), so it is untrusted
// input too: only a plain http(s) origin is accepted, never a path, userinfo or
// an opaque scheme. Returns the normalized origin, or null.
export const parseHostOrigin = (raw: string | null): string | null => {
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (url.username || url.password) return null
    return url.origin
  } catch {
    return null
  }
}
