import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { Loader2 } from 'lucide-react'
import { AppShell } from '../../App.tsx'
import { Button } from '../../components/ui/Button.tsx'
import { ToastProvider } from '../../components/ui/Toast.tsx'
import { es } from '../../i18n/es.ts'
import { WriteSyncHost } from '../course-map/components/WriteSyncHost.tsx'
import { MoodleStateContext } from '../course-map/moodle/moodleState.ts'
import { EmbedErrorToasts } from './EmbedErrorToasts.tsx'
import { EmbedErrorBoundary } from './EmbedErrorBoundary.tsx'
import { EmbedContext, type EmbedContextValue } from './EmbedContext.ts'
import {
  createHostBridge,
  isEmbeddedInHost,
  parseHostOrigin,
  type HostBridge,
} from './hostBridge.ts'
import { useHostMoodleState } from './hostMoodleState.ts'
import { isHostOverlayOpen, subscribeHostOverlay } from './hostOverlay.ts'
import { getHostStateReceivedCount } from './hostState.ts'
import { createHostReports } from './hostReports.ts'
import { createStateRequester } from './stateRequester.ts'
import type { EmbedErrorCode } from './protocol.ts'
import { createEmbedSession, type EmbedPhase } from './session.ts'

// Refreshing the host's CourseState: when the tab comes back into view, on a
// gentle interval while it is visible, after the person returns from an
// activity (which brings the page back into view or focus) and after the host's
// overlay closes. Requests are throttled and coalesced (see stateRequester): a
// burst is one message and the last trigger is never dropped.
const REFRESH_INTERVAL_MS = 60_000
const clock = () => Date.now()

const useHostStateRefresh = (bridge: HostBridge, enabled: boolean) => {
  const requester = useMemo(
    () =>
      createStateRequester({
        send: () => bridge.send({ type: 'rumbos:request-state', v: 1 }),
        now: clock,
        schedule: (run, delayMs) => {
          const timer = window.setTimeout(run, delayMs)
          return () => window.clearTimeout(timer)
        },
        receivedCount: getHostStateReceivedCount,
      }),
    [bridge]
  )

  useEffect(() => {
    if (!enabled) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') requester.request()
    }
    const timer = window.setInterval(onVisible, REFRESH_INTERVAL_MS)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    window.addEventListener('pageshow', onVisible)
    let wasOpen = isHostOverlayOpen()
    const unsubscribeOverlay = subscribeHostOverlay(() => {
      const open = isHostOverlayOpen()
      if (wasOpen && !open) requester.afterOverlayClosed()
      wasOpen = open
    })
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.removeEventListener('pageshow', onVisible)
      unsubscribeOverlay()
      requester.dispose()
    }
  }, [enabled, requester])

  return requester.request
}

const EmbedMessage = ({
  title,
  detail,
  hint,
  action,
}: {
  title: string
  detail?: string
  hint?: string
  action?: { label: string; onClick: () => void }
}) => (
  <div className="flex h-dvh items-center justify-center p-4">
    <div role="alert" className="border-soft max-w-md space-y-3 rounded-lg bg-surface p-5">
      <p className="font-heading text-lg font-extrabold text-ink">{title}</p>
      {detail && <p className="text-sm font-semibold text-ink">{detail}</p>}
      {hint && <p className="text-sm text-ink-soft">{hint}</p>}
      {action && (
        <Button variant="secondary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  </div>
)

const reasonFor = (code: EmbedErrorCode) => es.embed.reasons[code]

const EmbedSessionView = ({ hostOrigin, bridge }: { hostOrigin: string; bridge: HostBridge }) => {
  const session = useMemo(() => createEmbedSession(bridge), [bridge])
  useEffect(() => session.start(), [session])
  useEffect(() => {
    if (!import.meta.env.DEV || import.meta.env.VITE_USE_MOCK_API !== 'true') return
    let uninstall: (() => void) | undefined
    let cancelled = false
    void import('./devHooks.ts').then((dev) => {
      if (!cancelled) uninstall = dev.installDevHooks(hostOrigin)
    })
    return () => {
      cancelled = true
      uninstall?.()
    }
  }, [hostOrigin])
  const phase: EmbedPhase = useSyncExternalStore(session.subscribe, session.getPhase)

  const ready = phase.name === 'ready'
  const requestState = useHostStateRefresh(bridge, ready)

  const role = phase.name === 'ready' ? phase.role : null
  const courseId = phase.name === 'ready' ? phase.courseId : null
  // The host's mode never grants more than the token's role does.
  const mode = phase.name === 'ready' && phase.role === 'editor' ? phase.mode : 'student'
  const reports = useMemo(() => createHostReports(bridge.send), [bridge])
  const context = useMemo<EmbedContextValue | null>(
    () =>
      role && courseId
        ? {
            role,
            mode,
            courseId,
            openActivity: (cmid) => bridge.send({ type: 'rumbos:open-activity', v: 1, cmid }),
            openActivitySettings: (cmid) => {
              // Editor mode only; a student session never asks for this.
              if (mode === 'editor')
                bridge.send({ type: 'rumbos:open-activity-settings', v: 1, cmid })
            },
            requestState,
            requestFullscreen: (on) => bridge.send({ type: 'rumbos:request-fullscreen', v: 1, on }),
            requestStats: (groupId) => {
              // Editor mode only; the host would refuse a student anyway.
              if (mode === 'editor')
                bridge.send({
                  type: 'rumbos:request-stats',
                  v: 1,
                  ...(groupId !== undefined && { groupId }),
                })
            },
            reportNoContent: reports.noContent,
            reportPreferredSize: reports.preferredSize,
          }
        : null,
    [role, mode, courseId, bridge, requestState, reports]
  )

  if (phase.name === 'failed') {
    return (
      <EmbedMessage
        title={es.embed.failureTitle}
        detail={reasonFor(phase.code)}
        hint={es.embed.failureHint}
      />
    )
  }

  // The map goes away with the session: nothing it could still send would be
  // accepted, and a clear message beats a map that silently stops saving.
  if (phase.name === 'expired') {
    return (
      <EmbedMessage
        title={es.embed.expiredTitle}
        hint={es.embed.expiredHint}
        action={{ label: es.embed.reload, onClick: () => window.location.reload() }}
      />
    )
  }

  if (!context) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <p role="status" className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
          <Loader2 size={16} className="motion-safe:animate-spin" aria-hidden />
          {es.embed.connecting}
        </p>
      </div>
    )
  }

  return (
    <EmbedContext value={context}>
      <MoodleStateContext value={useHostMoodleState}>
        <ToastProvider>
          <EmbedErrorToasts />
          <AppShell />
          <WriteSyncHost />
        </ToastProvider>
      </MoodleStateContext>
    </EmbedContext>
  )
}

const ConnectedEmbed = ({ hostOrigin }: { hostOrigin: string }) => {
  const bridge = useMemo(() => createHostBridge(hostOrigin), [hostOrigin])
  return (
    <EmbedErrorBoundary bridge={bridge}>
      <EmbedSessionView hostOrigin={hostOrigin} bridge={bridge} />
    </EmbedErrorBoundary>
  )
}

// Printed once per page load so a console screenshot says which build runs.
let buildLogged = false
const logBuildOnce = () => {
  if (buildLogged) return
  buildLogged = true
  const stamp = document.querySelector('meta[name="rumbos-build"]')?.getAttribute('content')
  console.info(`[rumbos-embed] build ${stamp ?? 'unknown'}`)
}

// The /embed route: the app as a guest inside a Moodle page. It talks to the
// host only through the origin-pinned bridge and gets its identity from a
// token the backend issues for the host's launch assertion.
const EmbedRoot = () => {
  logBuildOnce()
  const hostOrigin = useMemo(
    () =>
      parseHostOrigin(new URLSearchParams(window.location.search).get('host'), import.meta.env.DEV),
    []
  )

  if (!isEmbeddedInHost()) {
    return <EmbedMessage title={es.embed.failureTitle} detail={reasonFor('not_embedded')} />
  }
  if (!hostOrigin) {
    // Without a valid host origin there is no one safe to tell.
    return (
      <EmbedMessage
        title={es.embed.failureTitle}
        detail={reasonFor('invalid_host')}
        hint={es.embed.failureHint}
      />
    )
  }
  return <ConnectedEmbed hostOrigin={hostOrigin} />
}

export default EmbedRoot
