import { courseMapApi } from '../course-map/data/index.ts'
import { ApiError, setAuthHooks } from '../course-map/data/client.ts'
import type { AuthRole, LaunchResult } from '../course-map/data/types.ts'
import type { HostBridge } from './hostBridge.ts'
import { setHostState } from './hostState.ts'
import { hostOriginMatches, parseLaunchResult } from './launch.ts'
import type { EmbedErrorCode, HostInitMessage, HostMessage } from './protocol.ts'

export type EmbedPhase =
  | { name: 'connecting' }
  | { name: 'ready'; role: AuthRole; courseId: number }
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
  constructor(code: EmbedErrorCode) {
    super(code)
    this.code = code
  }
}

// What went wrong in POST /auth/launch, as the code the host should hear.
const failureCodeFor = (error: unknown): EmbedErrorCode => {
  if (error instanceof LaunchFailure) return error.code
  if (error instanceof ApiError) {
    if (error.status === 0 || error.status >= 500) return 'backend_unreachable'
    if (error.status === 403 && error.detail.code === 'tenant_disabled') return 'tenant_disabled'
  }
  return 'launch_invalid'
}

// Owns the conversation with the host and the access token. The token lives in
// this closure only: never in storage, a URL, a log or an error message, and it
// is handed to the data layer through the auth hooks, nowhere else.
export const createEmbedSession = (bridge: HostBridge): EmbedSession => {
  let phase: EmbedPhase = { name: 'connecting' }
  const listeners = new Set<() => void>()
  let token: string | null = null
  let identity: { role: AuthRole; courseId: number } | null = null
  let initHandled = false
  let handshakeTimer: ReturnType<typeof setTimeout> | undefined
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

  const failHandshake = (code: EmbedErrorCode) => {
    clearAuth()
    setPhase({ name: 'failed', code })
    bridge.send({ type: 'rumbos:error', v: 1, code })
  }

  const expire = () => {
    clearAuth()
    setPhase({ name: 'expired' })
    bridge.send({ type: 'rumbos:error', v: 1, code: 'session_expired' })
  }

  const exchange = async (assertion: string): Promise<LaunchResult> => {
    const result = parseLaunchResult(await courseMapApi.launch(assertion))
    if (!result) throw new LaunchFailure('launch_invalid')
    // The backend names the one origin allowed to embed this tenant; it must be
    // the page that actually embeds us.
    if (!hostOriginMatches(result.hostOrigin, bridge.hostOrigin)) {
      throw new LaunchFailure('origin_mismatch')
    }
    return result
  }

  const handleInit = async (message: HostInitMessage) => {
    if (initHandled) return
    initHandled = true
    clearTimeout(handshakeTimer)
    try {
      const result = await exchange(message.assertion)
      if (result.courseId !== message.courseId) throw new LaunchFailure('course_mismatch')
      token = result.accessToken
      identity = { role: result.role, courseId: result.courseId }
      setAuthHooks({ getToken: () => token, refresh })
      setHostState(message.state)
      setPhase({ name: 'ready', role: result.role, courseId: result.courseId })
    } catch (error) {
      failHandshake(failureCodeFor(error))
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
      expire()
      return false
    }
    try {
      const result = await exchange(assertion)
      // A different person or course than before is not a refresh.
      if (!identity || result.role !== identity.role || result.courseId !== identity.courseId) {
        expire()
        return false
      }
      token = result.accessToken
      return true
    } catch {
      expire()
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
        if (!initHandled) failHandshake('handshake_timeout')
      }, HANDSHAKE_TIMEOUT_MS)
      bridge.send({ type: 'rumbos:embed-ready', v: 1 })
      return () => {
        unsubscribe()
        clearTimeout(handshakeTimer)
        relaunchWaiter?.(null)
        relaunchWaiter = null
        clearAuth()
        setHostState(null)
        initHandled = false
        identity = null
        phase = { name: 'connecting' }
      }
    },
  }
}
