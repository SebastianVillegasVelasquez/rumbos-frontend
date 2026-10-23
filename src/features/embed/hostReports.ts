import { clampAspectRatio, type AppMessage, type NoContentReason } from './protocol.ts'

// What the app volunteers to the host about what the student sees. Both reports
// are idempotent: the host hears a condition once, and a size only when it
// changes, however often the React tree asks.
export interface HostReports {
  noContent: (reason: NoContentReason) => void
  preferredSize: (aspectRatio: number) => void
}

export const createHostReports = (send: (message: AppMessage) => void): HostReports => {
  const reported = new Set<NoContentReason>()
  let lastRatio: number | null = null
  return {
    noContent: (reason) => {
      if (reported.has(reason)) return
      reported.add(reason)
      send({ type: 'rumbos:no-content', v: 1, reason })
    },
    preferredSize: (aspectRatio) => {
      const ratio = clampAspectRatio(aspectRatio)
      if (ratio === null) return
      // A thousandth is far below anything the host can lay out.
      const rounded = Math.round(ratio * 1000) / 1000
      if (rounded === lastRatio) return
      lastRatio = rounded
      send({ type: 'rumbos:preferred-size', v: 1, aspectRatio: rounded })
    },
  }
}
