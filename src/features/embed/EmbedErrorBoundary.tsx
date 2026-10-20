import { Component, type ReactNode } from 'react'
import { es } from '../../i18n/es.ts'
import type { HostBridge } from './hostBridge.ts'

// A render crash anywhere in the embedded tree must not leave a blank iframe:
// the host is told once (so the plugin can fall back to the standard course
// content) and the student sees a message. The detail is only the error's
// class name: never its message or stack, which could carry URLs or tokens.
export class EmbedErrorBoundary extends Component<
  { bridge: HostBridge; children: ReactNode },
  { crashed: boolean }
> {
  state = { crashed: false }

  static getDerivedStateFromError() {
    return { crashed: true }
  }

  componentDidCatch(error: unknown) {
    const name = error instanceof Error ? error.name : 'Error'
    this.props.bridge.send({
      type: 'rumbos:error',
      v: 1,
      code: 'app_crashed',
      detail: `Unhandled ${name} while rendering`,
    })
  }

  render() {
    if (!this.state.crashed) return this.props.children
    return (
      <div className="flex h-dvh items-center justify-center p-4">
        <div role="alert" className="border-soft max-w-md space-y-3 rounded-lg bg-surface p-5">
          <p className="font-heading text-lg font-extrabold text-ink">{es.embed.crashedTitle}</p>
          <p className="text-sm text-ink-soft">{es.embed.failureHint}</p>
        </div>
      </div>
    )
  }
}
