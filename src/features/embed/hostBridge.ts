import { parseHostMessage, type AppMessage, type HostMessage } from './protocol.ts'

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

export const isEmbeddedInHost = () => window.parent !== window

export interface HostBridge {
  readonly hostOrigin: string
  // Always to the host origin, never "*".
  send(message: AppMessage): void
  // Delivers only well-formed messages from the host window and origin.
  subscribe(listener: (message: HostMessage) => void): () => void
}

// Both directions are pinned: outgoing messages name the host origin as the
// target, incoming ones must come from that origin AND from window.parent
// itself (a sibling frame or a popup on the same origin does not count).
export const createHostBridge = (hostOrigin: string): HostBridge => {
  const listeners = new Set<(message: HostMessage) => void>()

  const onMessage = (event: MessageEvent) => {
    if (event.origin !== hostOrigin || event.source !== window.parent) return
    const message = parseHostMessage(event.data)
    if (!message) {
      if (import.meta.env.DEV) console.debug('[rumbos-embed] ignored a malformed host message')
      return
    }
    listeners.forEach((listener) => listener(message))
  }

  return {
    hostOrigin,
    send: (message) => {
      if (window.parent === window) return
      window.parent.postMessage(message, hostOrigin)
    },
    subscribe: (listener) => {
      if (listeners.size === 0) window.addEventListener('message', onMessage)
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) window.removeEventListener('message', onMessage)
      }
    },
  }
}
