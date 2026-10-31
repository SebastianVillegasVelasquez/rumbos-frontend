import { courseMapApi } from '../course-map/data/index.ts'
import { ApiError, setAuthHooks } from '../course-map/data/client.ts'
import type { AuthRole, LaunchResult } from '../course-map/data/types.ts'
import type { HostBridge } from './hostBridge.ts'
import { setHostCourseName } from './hostCourse.ts'
import { setHostFullscreen } from './hostFullscreen.ts'
import { setHostState } from './hostState.ts'
import { hostOriginMatches, parseLaunchResult } from './launch.ts'
import { describeHttpFailure, REASONS } from './errorReason.ts'
import { reportToHost, type FailureKind } from './escalation.ts'
import { startReadyRetry } from './readyRetry.ts'
import { setHostOverlayOpen } from './hostOverlay.ts'
import { clearHostStats, setHostStatsResult } from './hostStats.ts'
import type { EmbedErrorCode, HostInitMessage, HostMessage, HostMode } from './protocol.ts'

export type EmbedPhase =
  | { name: 'connecting' }
  // `mode` is the host's word on whether the UI is the editor's; the role (from
  // the token) is what the backend authorizes.
  | { name: 'ready'; role: AuthRole; courseId: number; mode: HostMode }
  // The handshake failed: the host has been told, the student sees a message.
  | { name: 'failed'; code: EmbedErrorCode }
  // The token ran out and the host did not (or could not) issue a new one.
  | { name: 'expired' }

export interface EmbedSession {
  getPhase(): EmbedPhase
  subscribe(listener: () => void): () => void
  // Begins the handshake; the returned function tears everything down.
  start(): () => void
}

export const HANDSHAKE_TIMEOUT_MS = 15_000
export const RELAUNCH_TIMEOUT_MS = 10_000

class LaunchFailure extends Error {
  readonly code: EmbedErrorCode
  readonly reason: string
  constructor(code: EmbedErrorCode, reason: string) {
    super(code)
    this.code = code
    this.reason = reason
  }
}

// What went wrong in POST /auth/launch, as the code the host should hear and
// a secret-free reason for its detail.
const failureFor = (error: unknown): { code: EmbedErrorCode; reason: string } => {
  if (error instanceof LaunchFailure) return { code: error.code, reason: error.reason }
  if (error instanceof ApiError) {
    const reason = describeHttpFailure(error.status, error.detail.code)
    if (error.status === 0 || error.status >= 500) return { code: 'backend_unreachable', reason }
    if (error.status === 403 && error.detail.code === 'tenant_disabled') {
      return { code: 'tenant_disabled', reason }
    }
    return { code: 'launch_invalid', reason }
  }
  return { code: 'launch_invalid', reason: REASONS.unexpected }
}

// Owns the conversation with the host and the access token. The token lives in
// this closure only: never in storage, a URL, a log or an error message, and it
// is handed to the data layer through the auth hooks, nowhere else.
export const createEmbedSession = (bridge: HostBridge): EmbedSession => {
  let phase: EmbedPhase = { name: 'connecting' }
  const listeners = new Set<() => void>()
  let token: string | null = null
  let identity: { role: AuthRole; courseId: number } | null = null
  let hostMode: HostMode = 'student'
  let initHandled = false
  let handshakeTimer: ReturnType<typeof setTimeout> | undefined
  let stopReadyRetry: (() => void) | undefined
  let relaunchWaiter: ((assertion: string | null) => void) | null = null
  let refreshInFlight: Promise<boolean> | null = null

  const setPhase = (next: EmbedPhase) => {
    phase = next
    listeners.forEach((listener) => listener())
  }

  const clearAuth = () => {
    token = null
    setAuthHooks(null)
  }

  const failHandshake = (kind: FailureKind, code: EmbedErrorCode, reason: string) => {
    stopReadyRetry?.()
    clearAuth()
    setPhase({ name: 'failed', code })
    reportToHost(bridge, kind, code, reason)
  }

  const expire = (reason: string) => {
    clearAuth()
    setPhase({ name: 'expired' })
    reportToHost(bridge, 'token_refresh', 'session_expired', reason)
  }

  const exchange = async (assertion: string): Promise<LaunchResult> => {
    const result = parseLaunchResult(await courseMapApi.launch(assertion))
    if (!result) throw new LaunchFailure('launch_invalid', REASONS.malformedLaunch)
    // The backend names the one origin allowed to embed this tenant; it must be
    // the page that actually embeds us.
    if (!hostOriginMatches(result.hostOrigin, bridge.hostOrigin)) {
      throw new LaunchFailure('origin_mismatch', REASONS.hostOriginMismatch)
    }
    return result
  }

  const handleInit = async (message: HostInitMessage) => {
    if (initHandled) return
    initHandled = true
    clearTimeout(handshakeTimer)
    stopReadyRetry?.()
    try {
      const result = await exchange(message.assertion)
      if (result.courseId !== message.courseId)
        throw new LaunchFailure('course_mismatch', REASONS.courseMismatch)
      token = result.accessToken
      identity = { role: result.role, courseId: result.courseId }
      hostMode = message.mode
      setAuthHooks({ getToken: () => token, refresh })
      setHostState(message.state)
      setHostCourseName(message.courseName)
      setPhase({ name: 'ready', role: result.role, courseId: result.courseId, mode: message.mode })
    } catch (error) {
      const failure = failureFor(error)
      failHandshake('launch', failure.code, failure.reason)
    }
  }

  // Asks the host for a fresh assertion; null when it does not answer in time.
  const requestAssertion = () =>
    new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => {
        if (relaunchWaiter === done) relaunchWaiter = null
        resolve(null)
      }, RELAUNCH_TIMEOUT_MS)
      const done = (assertion: string | null) => {
        clearTimeout(timer)
        resolve(assertion)
      }
      relaunchWaiter = done
      bridge.send({ type: 'rumbos:request-launch', v: 1 })
    })

  const doRefresh = async (): Promise<boolean> => {
    const assertion = await requestAssertion()
    if (assertion === null) {
      expire(REASONS.hostSilent)
      return false
    }
    try {
      const result = await exchange(assertion)
      // A different person or course than before is not a refresh.
      if (!identity || result.role !== identity.role || result.courseId !== identity.courseId) {
        expire(REASONS.identityChanged)
        return false
      }
      token = result.accessToken
      return true
    } catch (error) {
      expire(failureFor(error).reason)
      return false
    }
  }

  // Concurrent 401s share one round trip to the host.
  function refresh(): Promise<boolean> {
    refreshInFlight ??= doRefresh().finally(() => {
      refreshInFlight = null
    })
    return refreshInFlight
  }

  const onMessage = (message: HostMessage) => {
    switch (message.type) {
      case 'rumbos:host-init':
        void handleInit(message)
        return
      case 'rumbos:host-state':
        // Only the course this session was launched for.
        if (identity && message.state.courseId === identity.courseId) setHostState(message.state)
        return
      case 'rumbos:host-fullscreen':
        // The host's word on whether the iframe is expanded; once launched.
        if (identity) setHostFullscreen(message.on)
        return
      case 'rumbos:host-overlay':
        // Like the other host state messages, only once launched.
        if (identity) setHostOverlayOpen(message.open)
        return
      case 'rumbos:host-stats':
        // Counts are for the editor's UI only; a student session drops them.
        if (identity?.role === 'editor' && hostMode === 'editor') setHostStatsResult(message)
        return
      case 'rumbos:host-launch':
        // Only an answer to our own request-launch counts.
        if (relaunchWaiter) {
          const waiter = relaunchWaiter
          relaunchWaiter = null
          waiter(message.assertion)
        }
        return
    }
  }

  return {
    getPhase: () => phase,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    start: () => {
      const unsubscribe = bridge.subscribe(onMessage)
      handshakeTimer = setTimeout(() => {
        if (!initHandled) failHandshake('handshake', 'handshake_timeout', REASONS.handshakeTimeout)
      }, HANDSHAKE_TIMEOUT_MS)
      // Listener first (above), then announce; repeated until the host answers.
      stopReadyRetry = startReadyRetry(() => bridge.send({ type: 'rumbos:embed-ready', v: 1 }))
      return () => {
        unsubscribe()
        clearTimeout(handshakeTimer)
        stopReadyRetry?.()
        relaunchWaiter?.(null)
        relaunchWaiter = null
        clearAuth()
        setHostState(null)
        setHostFullscreen(false)
        setHostOverlayOpen(false)
        clearHostStats()
        initHandled = false
        identity = null
        phase = { name: 'connecting' }
      }
    },
  }
}
