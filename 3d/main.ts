// Entry of the 3D page (/3d/). Connects the world (world.js) to the host app
// through the postMessage protocol in src/features/view3d/protocol.ts, or runs
// it on built-in demo data with /3d/?demo=1. The world itself never talks to
// the network or to the host.
import {
  PROTOCOL_VERSION,
  isHostMessage,
  type CssVars,
  type HostMessage,
  type Locale3d,
  type PageMessage,
  type PinState,
  type Point3D,
} from '../src/features/view3d/protocol.ts'
import scene from './scenes/region-encuentros.json'

const params = new URLSearchParams(window.location.search)
const demo = params.get('demo') === '1'
const hostWindow = window.parent
const embedded = hostWindow !== window
// Same origin only: the page is our own and the host is the app that framed it.
const hostOrigin = window.location.origin

const log = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.warn('[3d]', ...args)
}

const post = (message: PageMessage) => {
  if (embedded) hostWindow.postMessage(message, hostOrigin)
}

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

const webglAvailable = () => {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return gl !== null
  } catch {
    return false
  }
}

const COPY = {
  es: {
    noWebgl: 'Tu navegador o tu dispositivo no puede mostrar el mundo 3D. Usa la vista 2D.',
    loadFailed: 'No se pudo cargar el mundo 3D. Vuelve a intentarlo o usa la vista 2D.',
    unknownScene: 'La escena 3D de este mapa no está disponible.',
  },
  en: {
    noWebgl: 'Your browser or device cannot show the 3D world. Use the 2D view.',
    loadFailed: 'The 3D world could not be loaded. Try again or use the 2D view.',
    unknownScene: 'The 3D scene for this map is not available.',
  },
}
let locale: Locale3d = params.get('lang') === 'en' ? 'en' : 'es'

const fail = (code: string, key: keyof (typeof COPY)['es']) => {
  const box = document.getElementById('fallback')
  if (box) {
    box.textContent = COPY[locale][key]
    box.hidden = false
  }
  document.getElementById('loading')?.remove()
  post({ type: 'rumbos:error', v: PROTOCOL_VERSION, code, message: COPY.es[key] })
}

// Theme: the host passes our own --r3d-* custom properties (validated by the
// protocol guard); anything it stops sending is removed again.
const appliedVars = new Set<string>()
const applyTheme = (cssVars: CssVars) => {
  const style = document.documentElement.style
  for (const name of appliedVars) if (!(name in cssVars)) style.removeProperty(name)
  appliedVars.clear()
  for (const [name, value] of Object.entries(cssVars)) {
    style.setProperty(name, value)
    appliedVars.add(name)
  }
}

const DEMO_STATES: PinState[] = [
  'complete', // 0
  'complete', // 1
  'next', // 2
  'available', // 3
  'locked', // 4
  'available', // 5
  'teaser', // 6
  'locked', // 7
  'missing', // 8
]
const demoPoints = (): Point3D[] =>
  scene.zones.map((zone) => ({
    id: `demo-${zone.id}`,
    zoneId: zone.id,
    title: null,
    description: null,
    state: DEMO_STATES[zone.id] ?? 'available',
  }))

type World = typeof import('./world.js')

// Loads the world (textures, the procedural build: several seconds on a slow
// tablet). Resolves to null after reporting why it could not.
async function loadWorld(): Promise<World | null> {
  if (!webglAvailable()) {
    fail('webgl_unavailable', 'noWebgl')
    return null
  }
  let world: World
  try {
    world = await import('./world.js')
  } catch (error) {
    log('world failed to load', error)
    fail('load_failed', 'loadFailed')
    return null
  }
  // The host removes the iframe when leaving 3D; free the GL context explicitly.
  window.addEventListener('pagehide', () => world.dispose(), { once: true })
  world.setCallbacks({
    onPinClick: (pointId) => post({ type: 'rumbos:pin-click', v: PROTOCOL_VERSION, pointId }),
    onOpenActivity: (pointId) =>
      post({ type: 'rumbos:open-activity', v: PROTOCOL_VERSION, pointId }),
    onCameraState: ({ canZoomIn, canZoomOut }) =>
      post({ type: 'rumbos:camera-state', v: PROTOCOL_VERSION, canZoomIn, canZoomOut }),
  })
  return world
}

const apply = (world: World, message: HostMessage) => {
  switch (message.type) {
    case 'rumbos:init':
      if (message.scene !== scene.id) return fail('scene_unknown', 'unknownScene')
      locale = message.locale
      applyTheme(message.theme.cssVars)
      world.setBare(message.ui === 'bare')
      world.setReducedMotion(message.reducedMotion || prefersReducedMotion())
      world.setLocale(message.locale)
      world.setPoints(message.points)
      world.releaseIntro()
      break
    case 'rumbos:states':
      world.setStates(message.states)
      break
    case 'rumbos:locale':
      locale = message.locale
      world.setLocale(message.locale)
      break
    case 'rumbos:theme':
      applyTheme(message.cssVars)
      break
    case 'rumbos:focus':
      world.focusPoint(message.pointId)
      break
    case 'rumbos:layout':
      world.setInsets(message.insets)
      break
    case 'rumbos:camera':
      world.cameraCommand(message.action)
      break
  }
}

function boot() {
  const worldReady = loadWorld()

  if (demo) {
    void worldReady.then((world) => {
      if (!world) return
      world.setReducedMotion(prefersReducedMotion())
      world.setLocale(locale)
      world.setPoints(demoPoints())
      world.releaseIntro()
    })
    return
  }

  // Host messages are applied in arrival order once the world exists.
  let queue: Promise<void> = Promise.resolve()
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.origin !== hostOrigin || event.source !== hostWindow) return
    const message: unknown = event.data
    if (!isHostMessage(message)) return log('ignored malformed message', message)
    queue = queue.then(async () => {
      const world = await worldReady
      if (world) apply(world, message)
    })
  })
  // `ready` means "the bridge is listening", not "the world is built": the
  // build can outlast the host's 10 s handshake on a slow device, and the page
  // shows its own loading screen meanwhile. Failures follow as `error`.
  post({ type: 'rumbos:ready', v: PROTOCOL_VERSION })
}

boot()
