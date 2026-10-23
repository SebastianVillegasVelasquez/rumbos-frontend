import type { VideoProvider } from './contentTypes.ts'
import { isVideoId } from './validateContent.ts'

export interface VideoRef {
  provider: VideoProvider
  videoId: string
}

const youtubeIdFromPath = (url: URL): string => {
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts[0] === 'watch') return url.searchParams.get('v') ?? ''
  if (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') return parts[1] ?? ''
  return ''
}

// A pasted YouTube or Vimeo link, or a bare id, into a provider and an id. The
// id is extracted strictly: anything that is not exactly an id of that
// provider is refused, so no author text ever reaches an embed address.
export const parseVideoInput = (input: string, fallback?: VideoProvider): VideoRef | null => {
  const raw = input.trim()
  if (raw === '') return null

  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    let url: URL
    try {
      url = new URL(raw)
    } catch {
      return null
    }
    if (url.protocol !== 'https:') return null
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    if (host === 'youtu.be') {
      const id = url.pathname.split('/')[1] ?? ''
      return isVideoId('youtube', id) ? { provider: 'youtube', videoId: id } : null
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      const id = youtubeIdFromPath(url)
      return isVideoId('youtube', id) ? { provider: 'youtube', videoId: id } : null
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const parts = url.pathname.split('/').filter(Boolean)
      const id = host === 'player.vimeo.com' ? (parts[1] ?? '') : (parts[parts.length - 1] ?? '')
      return isVideoId('vimeo', id) ? { provider: 'vimeo', videoId: id } : null
    }
    return null
  }

  // A bare id: the provider decides which shape it may have.
  if (fallback) return isVideoId(fallback, raw) ? { provider: fallback, videoId: raw } : null
  if (isVideoId('vimeo', raw)) return { provider: 'vimeo', videoId: raw }
  if (isVideoId('youtube', raw)) return { provider: 'youtube', videoId: raw }
  return null
}

// The only two places a video may load from. Built from a validated id, never
// from author text.
export const videoEmbedUrl = (provider: VideoProvider, videoId: string): string | null => {
  if (!isVideoId(provider, videoId)) return null
  return provider === 'youtube'
    ? `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`
    : `https://player.vimeo.com/video/${videoId}?dnt=1`
}
