import type { VideoProvider } from '../features/content/contentTypes.ts'
import { signalOf } from '../features/welcome/videoPlayer.ts'

// The log of the "Probar eventos de video" field of the ?diag=1 panel: what the
// real player page says to its embedder, with the time. For testing a real
// browser (a Mac in Safari, an iPhone) without opening the developer tools.
// Pure so it can be tested; the panel only feeds it.

export const MAX_PROBE_LINES = 200

export interface ProbeLine {
  at: number
  label: string
}

const asObject = (data: unknown): Record<string, unknown> | null => {
  if (typeof data === 'string') {
    try {
      const parsed: unknown = JSON.parse(data)
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : null
    } catch {
      return null
    }
  }
  return typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : null
}

// A short, safe name for what a message from the player says: the signal we
// understand (ready, playing, paused, ended, error) or the raw event name when we
// do not, so an unknown message is visible instead of silently missing.
export const describeMessage = (provider: VideoProvider, data: unknown): string | null => {
  const signal = signalOf(provider, data)
  const message = asObject(data)
  const raw = message && typeof message.event === 'string' ? message.event.slice(0, 40) : null
  if (signal) return raw && raw !== signal ? `${signal} (${raw})` : signal
  return raw ? `other: ${raw.replace(/[^\w.:-]/g, '?')}` : null
}

export const pushLine = (lines: readonly ProbeLine[], line: ProbeLine): ProbeLine[] =>
  [...lines, line].slice(-MAX_PROBE_LINES)

const pad = (value: number, size = 2) => String(value).padStart(size, '0')

// 14:03:07.412 (+1.8 s) label
export const formatLine = (line: ProbeLine, startedAt: number): string => {
  const date = new Date(line.at)
  const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
  return `${clock} (+${((line.at - startedAt) / 1000).toFixed(1)} s) ${line.label}`
}

export const formatLog = (
  provider: VideoProvider,
  videoId: string,
  startedAt: number,
  lines: readonly ProbeLine[],
  environment: string
): string =>
  [
    `Provider: ${provider}  Video: ${videoId}`,
    `Browser: ${environment}`,
    ...lines.map((line) => formatLine(line, startedAt)),
  ].join('\n')
