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
// Each distinct failure reason is worth one console line, not one per retry.
const warned = new Set<string>()
const warnOnce = (message: AppMessage) => {
  if (message.type !== 'rumbos:error') return
  const wire = toWireMessage(message) as { code: string; detail?: string }
  const line = `${wire.code}${wire.detail ? `: ${wire.detail}` : ''}`
  if (warned.has(line)) return
  warned.add(line)
  console.warn(`[rumbos-embed] reporting to host: ${line}`)
}

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
      warnOnce(message)
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
