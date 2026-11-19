import { API_BASE_URL, apiRequest } from '../course-map/data/client.ts'

// A clip's `url` comes from the API already prefixed (`/api/v1/trainer/audio/<id>?v=..`)
// and needs the bearer token, which an <audio src> cannot send. So the bytes are fetched
// with the token and played from a blob URL.

// Where the clip lives. The `url` is host-relative; when the API is on another origin
// (an absolute API base) the clip is there too, not on the page's origin.
export const clipRequestUrl = (url: string, apiBase: string = API_BASE_URL): string => {
  if (/^[a-z][a-z\d+.-]*:/i.test(url)) return url
  if (/^https?:\/\//i.test(apiBase)) return new URL(url, apiBase).href
  return url
}

// The clip as a blob URL (revoke it when done). Rejects with an ApiError on a missing
// clip (404), a failed network or a refused token: the player turns it into a retry.
export const loadClip = async (url: string): Promise<string> => {
  const blob = await apiRequest<Blob>(clipRequestUrl(url), { blob: true, absolute: true })
  return URL.createObjectURL(blob)
}
