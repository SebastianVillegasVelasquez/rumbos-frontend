import { parseHostOrigin } from './hostOrigin.ts'
import { parseHostMessage, toWireMessage, type AppMessage, type HostMessage } from './protocol.ts'

export { parseHostOrigin }

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
      window.parent.postMessage(toWireMessage(message), hostOrigin)
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
