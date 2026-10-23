import type { Content } from './contentTypes.ts'

// Which content bubbles this viewer has opened. A per-viewer convenience only
// (it dims the entry in Información and keeps a first-visit content from
// opening twice); localStorage can be empty, blocked or hold anything, so every
// read is validated and every write may silently not happen. Nothing is ever
// sent to the server.

const KEY = 'rumbos.content.seen'
const MAX_ENTRIES = 500

type Seen = Record<string, string>

// FNV-1a, enough to notice that the content was edited; not a security measure.
export const contentHash = (content: Content): string => {
  const text = JSON.stringify(content)
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

const readSeen = (storage: Pick<Storage, 'getItem'> | null): Seen => {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(KEY) ?? '{}')
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    const seen: Seen = {}
    for (const [id, hash] of Object.entries(parsed)) {
      if (typeof hash === 'string' && hash.length <= 16) seen[id] = hash
    }
    return seen
  } catch {
    return {}
  }
}

// Keyed by bubble id plus the content's hash: editing the content makes it new
// again.
export const isContentSeen = (
  storage: Pick<Storage, 'getItem'> | null,
  bubbleId: string,
  content: Content
): boolean => readSeen(storage)[bubbleId] === contentHash(content)

export const markContentSeen = (
  storage: Pick<Storage, 'getItem' | 'setItem'> | null,
  bubbleId: string,
  content: Content
) => {
  try {
    const seen = readSeen(storage)
    delete seen[bubbleId]
    seen[bubbleId] = contentHash(content)
    const entries = Object.entries(seen).slice(-MAX_ENTRIES)
    storage?.setItem(KEY, JSON.stringify(Object.fromEntries(entries)))
  } catch {
    // Not remembered; the content just looks new next time.
  }
}

// Whether opening the level should open this content by itself.
export const shouldAutoOpen = (
  storage: Pick<Storage, 'getItem'> | null,
  bubbleId: string,
  content: Content
): boolean => content.autoOpen === 'first_visit' && !isContentSeen(storage, bubbleId, content)
