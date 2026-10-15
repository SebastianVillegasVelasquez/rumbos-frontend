import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import {
  PROTOCOL_VERSION,
  isPageMessage,
  type CssVars,
  type HostMessage,
  type Locale3d,
  type Point3D,
} from './protocol.ts'

export const HANDSHAKE_TIMEOUT_MS = 10_000

export type BridgeStatus = 'loading' | 'ready' | 'error'

export interface View3dBridgeOptions {
  iframeRef: RefObject<HTMLIFrameElement | null>
  scene: string
  locale: Locale3d
  reducedMotion: boolean
  cssVars: CssVars
  points: Point3D[]
  focusPointId: string | null
  onPinClick: (pointId: string) => void
  onOpenActivity: (pointId: string) => void
  onFocusHandled?: () => void
}

export interface View3dBridge {
  status: BridgeStatus
  // 'timeout' when no `ready` arrived, otherwise the code the page reported
  // (for example 'webgl_unavailable').
  errorCode: string | null
}

// Owns the conversation with the 3D page: waits for `rumbos:ready`, answers
// with `init`, then keeps the page in sync (states, locale, theme, focus) and
// turns its messages into callbacks. Only messages from this iframe's own
// window, from our own origin, and of a known shape get through. A retry is a
// remount (the caller changes a React key), which restarts the handshake.
export const useView3dBridge = (options: View3dBridgeOptions): View3dBridge => {
  const { iframeRef, scene, locale, reducedMotion, cssVars, points, focusPointId } = options
  const [state, setState] = useState<View3dBridge>({ status: 'loading', errorCode: null })
  const latest = useRef(options)
  // What the page already has, so each effect only sends real changes.
  const sent = useRef({
    structure: '',
    states: '',
    locale,
    theme: '',
    focus: null as string | null,
  })

  useEffect(() => {
    latest.current = options
  })

  const structureKey = JSON.stringify([
    scene,
    reducedMotion,
    points.map((point) => [point.id, point.zoneId, point.title, point.description]),
  ])
  const statesKey = JSON.stringify(points.map((point) => [point.id, point.state]))
  const themeKey = JSON.stringify(cssVars)
  const ready = state.status === 'ready'

  const send = useCallback(
    (message: HostMessage) => {
      iframeRef.current?.contentWindow?.postMessage(message, window.location.origin)
    },
    [iframeRef]
  )

  useEffect(() => {
    const sendInit = () => {
      const current = latest.current
      send({
        type: 'rumbos:init',
        v: PROTOCOL_VERSION,
        scene: current.scene,
        locale: current.locale,
        reducedMotion: current.reducedMotion,
        theme: { cssVars: current.cssVars },
        points: current.points,
      })
      sent.current = {
        structure: JSON.stringify([
          current.scene,
          current.reducedMotion,
          current.points.map((p) => [p.id, p.zoneId, p.title, p.description]),
        ]),
        states: JSON.stringify(current.points.map((p) => [p.id, p.state])),
        locale: current.locale,
        theme: JSON.stringify(current.cssVars),
        focus: null,
      }
    }

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.source === null || event.source !== iframeRef.current?.contentWindow) return
      const message: unknown = event.data
      if (!isPageMessage(message)) {
        if (import.meta.env.DEV) console.warn('[view3d] ignored message', message)
        return
      }
      switch (message.type) {
        case 'rumbos:ready':
          sendInit()
          setState({ status: 'ready', errorCode: null })
          break
        case 'rumbos:pin-click':
          if (latest.current.points.some((point) => point.id === message.pointId)) {
            latest.current.onPinClick(message.pointId)
          }
          break
        case 'rumbos:open-activity':
          if (latest.current.points.some((point) => point.id === message.pointId)) {
            latest.current.onOpenActivity(message.pointId)
          }
          break
        case 'rumbos:error':
          setState({ status: 'error', errorCode: message.code })
          break
      }
    }

    const timer = window.setTimeout(
      () =>
        setState((current) =>
          current.status === 'loading' ? { status: 'error', errorCode: 'timeout' } : current
        ),
      HANDSHAKE_TIMEOUT_MS
    )
    window.addEventListener('message', onMessage)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('message', onMessage)
    }
  }, [iframeRef, send])

  // Structural changes (another activity bound, a title edited) resend init;
  // it is idempotent on the page side.
  useEffect(() => {
    if (!ready || sent.current.structure === structureKey) return
    const current = latest.current
    send({
      type: 'rumbos:init',
      v: PROTOCOL_VERSION,
      scene: current.scene,
      locale: current.locale,
      reducedMotion: current.reducedMotion,
      theme: { cssVars: current.cssVars },
      points: current.points,
    })
    sent.current = {
      ...sent.current,
      structure: structureKey,
      states: statesKey,
      locale: current.locale,
      theme: themeKey,
    }
  }, [ready, structureKey, statesKey, themeKey, send])

  useEffect(() => {
    if (!ready || sent.current.states === statesKey) return
    const states = Object.fromEntries(latest.current.points.map((p) => [p.id, p.state]))
    send({ type: 'rumbos:states', v: PROTOCOL_VERSION, states })
    sent.current.states = statesKey
  }, [ready, statesKey, send])

  useEffect(() => {
    if (!ready || sent.current.locale === locale) return
    send({ type: 'rumbos:locale', v: PROTOCOL_VERSION, locale })
    sent.current.locale = locale
  }, [ready, locale, send])

  useEffect(() => {
    if (!ready || sent.current.theme === themeKey) return
    send({ type: 'rumbos:theme', v: PROTOCOL_VERSION, cssVars: latest.current.cssVars })
    sent.current.theme = themeKey
  }, [ready, themeKey, send])

  useEffect(() => {
    if (!ready || focusPointId === null) return
    send({ type: 'rumbos:focus', v: PROTOCOL_VERSION, pointId: focusPointId })
    sent.current.focus = focusPointId
    latest.current.onFocusHandled?.()
  }, [ready, focusPointId, send])

  return state
}
