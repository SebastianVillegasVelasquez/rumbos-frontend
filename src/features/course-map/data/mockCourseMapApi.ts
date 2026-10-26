import { ApiError } from './client.ts'
import { mockFeatures, mockLaunch, mockMe, withMockAuth } from './mockAuth.ts'
import { CONTENT_LIMITS, isContentBubble, type Content } from '../../content/contentTypes.ts'
import { contentBytes, validateContent } from '../../content/validateContent.ts'
import { assetObjectUrls } from './mockAssetUrls.ts'
import { LIBRARY_TRACKS, makeToneWav, readAudioDuration } from './mockAudio.ts'
import {
  ASSET_LIMITS,
  ALLOWED_IMAGE_MIME,
  CREDIT_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  checkDimensions,
} from './assetLimits.ts'
import { canonicalJson, sha256Hex } from './canonicalJson.ts'
import { DESCRIPTION3D_MAX_LENGTH, TITLE3D_MAX_LENGTH } from './view3dLimits.ts'
import { DEFAULT_BACKGROUND_URL } from '../../../assets/backgrounds/index.ts'
import { validateWelcome } from '../../welcome/welcome.ts'
import type { CourseMapApi } from './courseMapApi.ts'
import type {
  Activity,
  AppearanceUpdate,
  Asset,
  AssetCreate,
  AssetCreateResult,
  AssetListItem,
  AssetListParams,
  AssetListResult,
  AssetPatch,
  AssetUsage,
  AudioInfo,
  Availability,
  Bubble,
  BubbleCreate,
  BubbleUpdate,
  CourseMapCreate,
  CourseMapListParams,
  CourseMapListResult,
  CourseMapPatch,
  CourseMapRead,
  CourseMapSummary,
  DraftReplaceResult,
  MapSettings,
  MoodleStatus,
  PublicationBadge,
  PublicationChanges,
  PublicationListResult,
  PublicationState,
  PublicationSummary,
  PublishedBubble,
  PublishedMapListParams,
  PublishedMapListResult,
  PublishedMapRead,
  PublishedMapSummary,
  PublishedSkin,
  PublishInput,
  ReorderBubblesInput,
  ReorderBubblesResult,
  ReorderCourseMapsInput,
  ReorderCourseMapsResult,
  ResolvedBubble,
  ResolvedCourseMap,
  Scene3d,
  Scene3dListResult,
  Skin,
  SkinConfig,
  SkinCreate,
  SkinListResult,
  SkinPatch,
  SkinRule,
  View3d,
  View3dBinding,
  Warning,
} from './types.ts'

// In-memory stand-in for the backend, enabled with VITE_USE_MOCK_API=true so
// demos run without a server. Mirrors contract v4 (v3 plus the optional 3D view): several maps ("levels") per
// Moodle course, settings/appearance, skins, an asset library, optimistic
// concurrency (revision/version + If-Match with 428/412), draft vs published
// with immutable snapshots, the student-facing /published read API, and the
// optional 3D view (scene registry, zone bindings, view3d on draft and published).
//
// Query-string switches for demoing states without a real backend:
//   ?mockMoodle=down|hidden|missing|cached   outcome of /resolved
//   ?mockAssets=quota|down                   asset-upload failure modes
//   ?mockLatency=<ms>                        artificial latency on every call
// In dev, window.__rumbosMock simulates "another editor" changing a bubble or a
// map, which is how the 412 conflict flows are exercised from a single tab.

const DEFAULT_IMAGE_URL = DEFAULT_BACKGROUND_URL
const MOCK_MODULE_URL = 'https://moodle.example.com/mod/'
const DEFAULT_LIMIT = 24
const MAX_LIMIT = 100
const ASSET_QUOTA = 50

const ALLOWED_MIME = new Set<string>(ALLOWED_IMAGE_MIME)
const TITLE_MAX = TITLE_MAX_LENGTH
const CREDIT_MAX = CREDIT_MAX_LENGTH
const NOTE_MAX = 200

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `mock-${Date.now()}-${Math.random().toString(16).slice(2)}`

const now = () => new Date().toISOString()

const queryParam = (name: string) =>
  typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get(name)

const mockMoodleOverride = (): 'down' | 'hidden' | 'missing' | 'cached' | null => {
  const value = queryParam('mockMoodle')
  return value === 'down' || value === 'hidden' || value === 'missing' || value === 'cached'
    ? value
    : null
}

// ?mockAudio=off: a backend that predates audio (the endpoints answer 404).
// ?mockAudio=uploads-off: the library works, uploads answer 503.
// ?mockAudio=missing: every audio file is gone from the server (available: false).
// ?mockAudio=legacy: a backend that predates `available` (the field is absent).
const mockAudioOverride = (): 'off' | 'uploads-off' | 'missing' | 'legacy' | null => {
  const value = queryParam('mockAudio')
  return value === 'off' || value === 'uploads-off' || value === 'missing' || value === 'legacy'
    ? value
    : null
}

// What `available` says about an audio asset; undefined (absent) on "legacy".
const availableOf = (kind: string): { available?: boolean } => {
  if (kind !== 'audio' || mockAudioOverride() === 'legacy') return {}
  return { available: mockAudioOverride() !== 'missing' }
}

// ?mockWelcome=off: a backend that predates the welcome curtain (the settings
// carry no `welcome` key). Otherwise a seeded welcome to demo each variant:
// video | video-optional | always | message | disabled.
const mockWelcomeOverride = () => queryParam('mockWelcome')

const mockWelcomeSeed = (): MapSettings['welcome'] | undefined => {
  const base = {
    enabled: true,
    title: null,
    message: null,
    video: null,
    playOnEnter: true,
    show: 'first_visit' as const,
  }
  const video = { provider: 'youtube' as const, videoId: 'jNQXAC9IVRw' }
  switch (mockWelcomeOverride()) {
    case 'off':
      return undefined
    case 'video':
      return { ...base, message: 'Mira este video antes de empezar.', video }
    case 'video-optional':
      return { ...base, message: 'El video es opcional.', video, playOnEnter: false }
    case 'always':
      return { ...base, show: 'always' }
    case 'message':
      return { ...base, title: 'Tu viaje por {curso}', message: 'Explora cada burbuja a tu ritmo.' }
    case 'disabled':
      return { ...base, enabled: false }
    default:
      return null
  }
}

const mockAssetsOverride = (): 'quota' | 'down' | null => {
  const value = queryParam('mockAssets')
  return value === 'quota' || value === 'down' ? value : null
}

const mockLatency = () => {
  const value = Number(queryParam('mockLatency'))
  return Number.isFinite(value) && value > 0 ? value : 0
}

interface MockActivity {
  activityId: number
  name: string
  modname: string
  sectionId: number
  sectionName: string
  sectionNumber: number
  hidden: boolean
}

const mockModules: MockActivity[] = [
  {
    activityId: 101,
    name: 'Quiz de introducción',
    modname: 'quiz',
    sectionId: 1,
    sectionName: 'Semana 1',
    sectionNumber: 1,
    hidden: false,
  },
  {
    activityId: 102,
    name: 'Video de bienvenida',
    modname: 'url',
    sectionId: 1,
    sectionName: 'Semana 1',
    sectionNumber: 1,
    hidden: false,
  },
  {
    activityId: 103,
    name: 'Taller 1: configuración del entorno',
    modname: 'assign',
    sectionId: 2,
    sectionName: 'Semana 2',
    sectionNumber: 2,
    hidden: false,
  },
  {
    activityId: 104,
    name: 'Guía del curso',
    modname: 'resource',
    sectionId: 2,
    sectionName: 'Semana 2',
    sectionNumber: 2,
    hidden: false,
  },
  {
    activityId: 105,
    name: 'Quiz de mitad de curso',
    modname: 'quiz',
    sectionId: 3,
    sectionName: 'Semana 3',
    sectionNumber: 3,
    hidden: false,
  },
  {
    activityId: 106,
    name: 'Grabación: Semana 3',
    modname: 'url',
    sectionId: 3,
    sectionName: 'Semana 3',
    sectionNumber: 3,
    hidden: false,
  },
  {
    activityId: 107,
    name: 'Entrega de proyecto final',
    modname: 'assign',
    sectionId: 4,
    sectionName: 'Semana 4',
    sectionNumber: 4,
    hidden: true,
  },
  {
    activityId: 108,
    name: 'Certificado del curso',
    modname: 'customcert',
    sectionId: 4,
    sectionName: 'Semana 4',
    sectionNumber: 4,
    hidden: false,
  },
  {
    activityId: 109,
    name: 'Contenido SCORM: fundamentos',
    modname: 'scorm',
    sectionId: 2,
    sectionName: 'Semana 2',
    sectionNumber: 2,
    hidden: false,
  },
]

// ---- Built-in skins ---------------------------------------------------------

const palette = (fill: string, accent: string, glow: string) => ({ fill, accent, glow })

const builtinPalette = {
  locked: palette('#8A94A6', '#5B6577', '#B4BCCB'),
  available: palette('#FFB703', '#E08E00', '#FFD866'),
  inProgress: palette('#0E9AA7', '#087680', '#5ED3DD'),
  complete: palette('#2FBF71', '#1E8E52', '#7DE3A8'),
}

const skinTimestamp = now()

const builtinSkinSeed: ReadonlyArray<{
  id: string
  name: string
  isDefault: boolean
  config: SkinConfig
}> = [
  {
    id: 'skin-orbe',
    name: 'Orbe',
    isDefault: true,
    config: {
      schemaVersion: 1,
      kind: 'procedural',
      shape: 'circle',
      size: 64,
      palette: builtinPalette,
      icon: { mode: 'auto', preset: null, color: 'auto' },
      label: { mode: 'hover' },
      effects: { idle: 'breathe', ring: true, glow: true, completion: 'ripple' },
    },
  },
  {
    id: 'skin-insignia',
    name: 'Insignia',
    isDefault: false,
    config: {
      schemaVersion: 1,
      kind: 'procedural',
      shape: 'badge',
      size: 72,
      palette: builtinPalette,
      icon: { mode: 'auto', preset: null, color: 'auto' },
      label: { mode: 'hover' },
      effects: { idle: 'pulse', ring: true, glow: true, completion: 'burst' },
    },
  },
  {
    id: 'skin-pin',
    name: 'Pin',
    isDefault: false,
    config: {
      schemaVersion: 1,
      kind: 'procedural',
      shape: 'pin',
      size: 60,
      palette: builtinPalette,
      icon: { mode: 'auto', preset: null, color: 'auto' },
      label: { mode: 'hover' },
      effects: { idle: 'float', ring: false, glow: true, completion: 'ripple' },
    },
  },
  {
    id: 'skin-hexagono',
    name: 'Hexágono',
    isDefault: false,
    config: {
      schemaVersion: 1,
      kind: 'procedural',
      shape: 'hexagon',
      size: 68,
      palette: builtinPalette,
      icon: { mode: 'auto', preset: null, color: 'auto' },
      label: { mode: 'hover' },
      effects: { idle: 'breathe', ring: true, glow: false, completion: 'burst' },
    },
  },
]

let skins: Skin[] = builtinSkinSeed.map((seed) => ({
  id: seed.id,
  name: seed.name,
  builtin: true,
  isDefault: seed.isDefault,
  config: seed.config,
  createdAt: skinTimestamp,
  updatedAt: skinTimestamp,
}))

const defaultSkinId = () => skins.find((skin) => skin.isDefault)?.id ?? skins[0].id

const defaultSettings = (mode: MapSettings['mode']): MapSettings => ({
  schemaVersion: 1,
  mode,
  fit: 'fit-width',
  initialView: null,
  path: { visible: true, style: 'dashed', color: null, animated: mode === 'guided' },
  ambient: { kind: 'none', intensity: 0 },
  intro: 'none',
  ...(mockWelcomeSeed() === undefined ? {} : { welcome: mockWelcomeSeed() }),
})

// The scenes this "backend" accepts. A scene is hand-authored with a fixed
// number of zones, so the list is a registry, not something maps can extend.
const SCENES: Scene3d[] = [{ id: 'region-encuentros', zoneCount: 9 }]

// ---- Maps -------------------------------------------------------------------

type SnapshotBubble = Pick<
  PublishedBubble,
  'id' | 'activityId' | 'x' | 'y' | 'icon' | 'skinId' | 'sequence' | 'kind' | 'content'
>

// The publishable content of a map. Hashing this is what defines "the draft
// changed"; status and level position are live and deliberately absent.
interface Snapshot {
  title: string
  imageUrl: string
  settings: MapSettings
  defaultSkinId: string | null
  skinRules: SkinRule[]
  skins: Record<string, PublishedSkin>
  bubbles: SnapshotBubble[]
  // Omitted (not null) when the map has no 3D view, so snapshots taken before
  // contract v4 keep hashing exactly as they did.
  view3d?: View3d
}

interface MockPublication {
  number: number
  createdAt: string
  note: string | null
  snapshot: Snapshot
  hash: string
  // Last known status per bubble, only used when a published bubble no
  // longer exists in the draft. Not part of the hash.
  statusAtPublish: Record<string, Bubble['status']>
}

interface MockMap {
  id: string
  title: string
  moodleCourseId: number
  moodleSectionId: number | null
  position: number
  imageUrl: string
  settings: MapSettings
  defaultSkinId: string | null
  skinRules: SkinRule[]
  view3d: View3d | null
  bubbles: Bubble[]
  revision: number
  publications: MockPublication[]
  createdAt: string
  updatedAt: string
}

const seedBubble = (
  courseMapId: string,
  timestamp: string,
  sequence: number,
  spec: { activityId: number; x: number; y: number; status: Bubble['status'] }
): Bubble => ({
  id: newId(),
  courseMapId,
  activityId: spec.activityId,
  x: spec.x,
  y: spec.y,
  icon: null,
  status: spec.status,
  skinId: null,
  sequence,
  version: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
})

const seedMap = (
  title: string,
  moodleCourseId: number,
  bubbleSpecs: ReadonlyArray<{
    activityId: number
    x: number
    y: number
    status: Bubble['status']
  }>,
  options: {
    imageUrl?: string
    moodleSectionId?: number | null
    position?: number
    mode?: MapSettings['mode']
    // Content bubbles, after the activity ones.
    content?: ReadonlyArray<{ x: number; y: number; content: Content }>
    // Bindings refer to bubbles by their index in `bubbleSpecs`.
    view3d?: {
      scene: string
      bindings: ReadonlyArray<
        Pick<View3dBinding, 'zoneId'> & {
          bubbleIndex: number
          title?: View3dBinding['title']
          description?: View3dBinding['description']
        }
      >
    }
  } = {}
): MockMap => {
  const timestamp = now()
  const id = newId()
  const bubbles = bubbleSpecs.map((spec, index) => seedBubble(id, timestamp, index, spec))
  for (const item of options.content ?? []) {
    bubbles.push({
      ...seedBubble(id, timestamp, bubbles.length, {
        activityId: 0,
        x: item.x,
        y: item.y,
        status: 'no_complete',
      }),
      kind: 'content',
      activityId: null,
      content: item.content,
    })
  }
  return {
    id,
    title,
    moodleCourseId,
    moodleSectionId: options.moodleSectionId ?? null,
    position: options.position ?? 0,
    imageUrl: options.imageUrl ?? DEFAULT_IMAGE_URL,
    settings: defaultSettings(options.mode ?? 'explorative'),
    defaultSkinId: defaultSkinId(),
    skinRules: [],
    view3d: options.view3d
      ? {
          scene: options.view3d.scene,
          bindings: options.view3d.bindings.map((binding) => ({
            zoneId: binding.zoneId,
            bubbleId: bubbles[binding.bubbleIndex].id,
            title: binding.title ?? null,
            description: binding.description ?? null,
          })),
        }
      : null,
    revision: 1,
    publications: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    bubbles,
  }
}

const createInitialMaps = (): MockMap[] => [
  // One course with three levels, different bubble counts/modes/statuses,
  // to demo the carousel and guided-vs-explorative sequencing. Level 1 ends
  // up published and up to date, level 2 has unpublished changes on top of
  // three publications, level 3 was never published.
  seedMap(
    'Fundamentos de programación — Nivel 1',
    1,
    [
      { activityId: 101, x: 0.18, y: 0.72, status: 'complete' },
      { activityId: 102, x: 0.5, y: 0.45, status: 'complete' },
      { activityId: 103, x: 0.82, y: 0.6, status: 'in_progress' },
    ],
    {
      moodleSectionId: 1,
      position: 0,
      mode: 'explorative',
      content: [
        {
          x: 0.08,
          y: 0.2,
          content: {
            type: 'blocks',
            title: 'Bienvenida al curso',
            autoOpen: 'first_visit',
            body: {
              schemaVersion: 1,
              blocks: [
                { type: 'heading', text: 'Antes de empezar', level: 2 },
                {
                  type: 'paragraph',
                  text: 'Este curso se recorre como un mapa.\nAbre las burbujas en el orden que prefieras.',
                },
                {
                  type: 'video',
                  provider: 'youtube',
                  videoId: 'dQw4w9WgXcQ',
                  title: 'Presentación del curso',
                },
                { type: 'divider' },
                { type: 'link', text: 'Guía del estudiante', url: 'https://example.org/guia' },
              ],
            },
          },
        },
        {
          x: 0.92,
          y: 0.2,
          content: {
            type: 'widget',
            title: 'Juego de memoria',
            autoOpen: 'never',
            altText: 'Un contador de clics para practicar; no es necesario para avanzar.',
            html: '<main style="font:16px system-ui;padding:12px"><h1>Contador</h1><p id="n">0</p><button id="b">Sumar</button> <button id="c">Cerrar</button></main><script>var n=0;document.getElementById("b").onclick=function(){n++;document.getElementById("n").textContent=n};document.getElementById("c").onclick=function(){rumbos.close()};rumbos.setHeight(220)</script>',
          },
        },
      ],
    }
  ),
  seedMap(
    'Fundamentos de programación — Nivel 2',
    1,
    [
      { activityId: 104, x: 0.15, y: 0.5, status: 'no_complete' },
      { activityId: 109, x: 0.38, y: 0.3, status: 'locked' },
      { activityId: 105, x: 0.62, y: 0.55, status: 'locked' },
      { activityId: 106, x: 0.85, y: 0.35, status: 'locked' },
    ],
    {
      moodleSectionId: 2,
      position: 1,
      mode: 'guided',
      // The one seeded map with a 3D view; every other map has none.
      view3d: {
        scene: 'region-encuentros',
        bindings: [
          { zoneId: 1, bubbleIndex: 0 },
          {
            zoneId: 2,
            bubbleIndex: 1,
            title: { es: 'Antes de salir', en: 'Before you set off' },
            description: { es: 'Repasa lo esencial antes de seguir el camino.' },
          },
          { zoneId: 3, bubbleIndex: 2 },
          { zoneId: 4, bubbleIndex: 3 },
        ],
      },
    }
  ),
  seedMap(
    'Fundamentos de programación — Nivel 3',
    1,
    [
      { activityId: 107, x: 0.3, y: 0.5, status: 'locked' },
      { activityId: 108, x: 0.7, y: 0.5, status: 'locked' },
    ],
    { position: 2, mode: 'guided' }
  ),
  seedMap('Matemáticas para datos', 2, [
    { activityId: 101, x: 0.22, y: 0.4, status: 'complete' },
    { activityId: 104, x: 0.5, y: 0.55, status: 'no_complete' },
  ]),
  seedMap('Historia regional', 3, [
    { activityId: 102, x: 0.3, y: 0.5, status: 'in_progress' },
    { activityId: 106, x: 0.55, y: 0.3, status: 'locked' },
    { activityId: 108, x: 0.75, y: 0.65, status: 'locked' },
  ]),
  seedMap('Ciudadanía digital', 4, [{ activityId: 109, x: 0.4, y: 0.5, status: 'no_complete' }]),
  // Published with no bubbles: what a student sees when a teacher saved a
  // level before placing anything (mock host course 5).
  seedMap('Taller en construcción', 5, []),
]

let maps: MockMap[] = createInitialMaps()

// ---- Assets -----------------------------------------------------------------

interface MockAsset extends Asset {
  sha256: string
  // Curated by OBJ Digital, global (audio only).
  library?: boolean
}

let assets: MockAsset[] = []

const ASSET_PATH = /^\/assets\/([0-9a-f-]{36})$/i
const assetIdFromUrl = (imageUrl: string) => ASSET_PATH.exec(imageUrl)?.[1] ?? null

// ---- Errors -----------------------------------------------------------------

const notFound = (code: string, message: string) => new ApiError(404, { code, message })
const businessError = (
  status: number,
  code: string,
  message: string,
  extras: Record<string, unknown> = {}
) => new ApiError(status, { code, message, ...extras })

const requireMap = (courseMapId: string) => {
  const map = maps.find((item) => item.id === courseMapId)
  if (!map) throw notFound('course_map_not_found', 'Mapa no encontrado')
  return map
}

// What the backend does with a content body: widgets are a tenant feature,
// the shape is validated (422 with the problems), and the sizes have their own
// code (413).
const checkContent = (map: MockMap, content: Content, replacing: string | null) => {
  if (content.type === 'widget' && !mockFeatures().widgets) {
    throw businessError(403, 'widgets_disabled', 'Los widgets no están habilitados en este sitio')
  }
  const problems = validateContent(content)
  if (content.type === 'blocks') {
    for (const [index, block] of content.body.blocks.entries()) {
      if (block.type !== 'image') continue
      const asset = assets.find((item) => item.id === block.assetId)
      if (!asset || asset.kind !== 'image')
        problems.push({ path: `blocks.${index}.assetId`, code: 'invalid' })
    }
  }
  if (problems.some((problem) => problem.code === 'too_large')) {
    throw businessError(413, 'content_too_large', 'El contenido es demasiado grande')
  }
  if (problems.length > 0) {
    throw businessError(422, 'content_invalid', 'El contenido no es válido', { problems })
  }
  const others = map.bubbles
    .filter((bubble) => bubble.id !== replacing && bubble.content)
    .reduce((sum, bubble) => sum + contentBytes(bubble.content!), 0)
  if (others + contentBytes(content) > CONTENT_LIMITS.maxContentBytesPerMap) {
    throw businessError(413, 'content_too_large', 'Este nivel ya tiene demasiado contenido')
  }
}

// A backend that predates content bubbles has none to send.
const wireBubbles = <T extends { kind?: Bubble['kind']; content?: Bubble['content'] }>(
  bubbles: readonly T[]
): T[] =>
  (mockFeatures().contentSupport ? [...bubbles] : bubbles.filter((b) => !isContentBubble(b))).map(
    wireBubble
  )

// The shape of a bubble on the wire: a backend that predates content bubbles
// sends neither `kind` nor `content`.
const wireBubble = <T extends { kind?: Bubble['kind']; content?: Bubble['content'] }>(
  bubble: T
): T => {
  if (!mockFeatures().contentSupport) {
    const { kind: _kind, content: _content, ...rest } = bubble
    void _kind
    void _content
    return rest as T
  }
  return { ...bubble, kind: bubble.kind ?? 'activity' }
}

const requireBubble = (map: MockMap, bubbleId: string) => {
  const bubble = map.bubbles.find((item) => item.id === bubbleId)
  if (!bubble) throw notFound('bubble_not_found', 'Burbuja no encontrada')
  return bubble
}

const requireSkin = (skinId: string) => {
  const skin = skins.find((item) => item.id === skinId)
  if (!skin) throw businessError(422, 'skin_not_found', 'El skin seleccionado no existe')
  return skin
}

// If-Match for the guarded endpoints: 428 when absent, 412 when stale.
const checkIfMatch = (
  ifMatch: number | undefined,
  current: number,
  extra: 'currentRevision' | 'currentVersion'
) => {
  if (ifMatch === undefined) {
    throw businessError(
      428,
      'precondition_required',
      'Falta la cabecera If-Match en una escritura protegida'
    )
  }
  if (ifMatch !== current) {
    throw businessError(412, 'version_conflict', 'El recurso cambió desde que lo cargaste', {
      [extra]: current,
    })
  }
}

// imageUrl "/assets/{uuid}" must reference an existing background asset;
// anything else (a bundled frontend path) is accepted as-is.
const checkBackgroundUrl = (imageUrl: string) => {
  const id = assetIdFromUrl(imageUrl)
  if (!id) return
  const asset = assets.find((item) => item.id === id)
  if (!asset) throw businessError(422, 'background_asset_not_found', 'La imagen de fondo no existe')
  if (asset.kind !== 'background') {
    throw businessError(422, 'background_asset_wrong_kind', 'La imagen elegida no es un fondo')
  }
}

const replaceMap = (updated: MockMap) => {
  maps = maps.map((item) => (item.id === updated.id ? updated : item))
  return updated
}

// ---- Publishing helpers --------------------------------------------------------

const referencedSkinIds = (map: MockMap): string[] => {
  const ids = new Set<string>()
  if (map.defaultSkinId) ids.add(map.defaultSkinId)
  for (const rule of map.skinRules) ids.add(rule.skinId)
  for (const bubble of map.bubbles) if (bubble.skinId) ids.add(bubble.skinId)
  const globalDefault = skins.find((skin) => skin.isDefault)
  if (globalDefault) ids.add(globalDefault.id)
  return [...ids].filter((id) => skins.some((skin) => skin.id === id)).sort()
}

// Binding order carries no meaning, so the canonical form sorts by zone.
const canonicalView3d = (view3d: View3d): View3d => ({
  scene: view3d.scene,
  bindings: [...view3d.bindings].sort((a, b) => a.zoneId - b.zoneId),
})

const draftSnapshot = (map: MockMap): Snapshot => ({
  title: map.title,
  imageUrl: map.imageUrl,
  settings: map.settings,
  defaultSkinId: map.defaultSkinId,
  skinRules: map.skinRules,
  skins: Object.fromEntries(
    referencedSkinIds(map).map((id) => {
      const skin = skins.find((item) => item.id === id)!
      return [id, { name: skin.name, isDefault: skin.isDefault, config: skin.config }]
    })
  ),
  bubbles: [...map.bubbles]
    .sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id))
    .map(({ id, kind, activityId, content, x, y, icon, skinId, sequence }) => ({
      id,
      activityId,
      x,
      y,
      icon,
      skinId,
      sequence,
      // Only content bubbles carry them, so activity-only snapshots keep
      // hashing exactly as before.
      ...(kind === 'content' ? { kind, content } : {}),
    })),
  ...(map.view3d ? { view3d: canonicalView3d(map.view3d) } : {}),
})

const hashSnapshot = (snapshot: Snapshot) => sha256Hex(canonicalJson(snapshot))

const latestPublication = (map: MockMap): MockPublication | null =>
  map.publications.length > 0 ? map.publications[map.publications.length - 1] : null

// Music has its own change flag (audioChanged), so it is not a settings change.
const withoutAudio = (settings: MapSettings): MapSettings => ({ ...settings, audio: undefined })

const diffSnapshots = (published: Snapshot, draft: Snapshot): PublicationChanges => {
  const before = new Map(published.bubbles.map((bubble) => [bubble.id, bubble]))
  const after = new Map(draft.bubbles.map((bubble) => [bubble.id, bubble]))
  let moved = 0
  let restyled = 0
  for (const [id, next] of after) {
    const prev = before.get(id)
    if (!prev) continue
    if (prev.x !== next.x || prev.y !== next.y) moved++
    if (prev.icon !== next.icon || prev.skinId !== next.skinId) restyled++
  }
  return {
    backgroundChanged: published.imageUrl !== draft.imageUrl,
    titleChanged: published.title !== draft.title,
    settingsChanged:
      canonicalJson([
        withoutAudio(published.settings),
        published.defaultSkinId,
        published.skinRules,
      ]) !== canonicalJson([withoutAudio(draft.settings), draft.defaultSkinId, draft.skinRules]),
    skinsChanged: canonicalJson(published.skins) !== canonicalJson(draft.skins),
    view3dChanged: canonicalJson(published.view3d ?? null) !== canonicalJson(draft.view3d ?? null),
    contentChanged:
      canonicalJson(published.bubbles.map((b) => b.content ?? null)) !==
      canonicalJson(draft.bubbles.map((b) => b.content ?? null)),
    audioChanged:
      canonicalJson(published.settings.audio ?? null) !==
      canonicalJson(draft.settings.audio ?? null),
    bubblesAdded: [...after.keys()].filter((id) => !before.has(id)).length,
    bubblesRemoved: [...before.keys()].filter((id) => !after.has(id)).length,
    bubblesMoved: moved,
    bubblesRestyled: restyled,
  }
}

const computePublicationState = async (map: MockMap): Promise<PublicationState> => {
  const draft = draftSnapshot(map)
  const draftHash = await hashSnapshot(draft)
  const latest = latestPublication(map)
  if (!latest) {
    return {
      status: 'never_published',
      currentNumber: null,
      currentPublishedAt: null,
      currentNote: null,
      draftHash,
      changes: null,
    }
  }
  return {
    status: latest.hash === draftHash ? 'up_to_date' : 'unpublished_changes',
    currentNumber: latest.number,
    currentPublishedAt: latest.createdAt,
    currentNote: latest.note,
    draftHash,
    changes: diffSnapshots(latest.snapshot, draft),
  }
}

const publicationBadge = async (map: MockMap): Promise<PublicationBadge> => {
  const state = await computePublicationState(map)
  return {
    status: state.status,
    number: state.currentNumber,
    publishedAt: state.currentPublishedAt,
  }
}

// Appends an immutable snapshot of the current draft.
const createPublication = async (
  map: MockMap,
  note: string | null,
  createdAt = now()
): Promise<MockMap> => {
  const snapshot = draftSnapshot(map)
  const publication: MockPublication = {
    number: (latestPublication(map)?.number ?? 0) + 1,
    createdAt,
    note,
    snapshot,
    hash: await hashSnapshot(snapshot),
    statusAtPublish: Object.fromEntries(map.bubbles.map((bubble) => [bubble.id, bubble.status])),
  }
  return replaceMap({ ...map, publications: [...map.publications, publication] })
}

const publishProblems = (map: MockMap): { code: string; message: string }[] => {
  const problems: { code: string; message: string }[] = []
  if (map.bubbles.length === 0) {
    problems.push({ code: 'no_bubbles', message: 'El nivel no tiene actividades colocadas.' })
  }
  return problems
}

// Loads a snapshot into the draft (restore / discard). Anything that no
// longer exists is adjusted and reported as a warning instead of failing.
const loadSnapshotIntoDraft = (map: MockMap, snapshot: Snapshot): DraftReplaceResult => {
  const warnings: Warning[] = []
  const timestamp = now()
  const skinOrNull = (id: string | null, what: string) => {
    if (id === null || skins.some((skin) => skin.id === id)) return id
    const name = snapshot.skins[id]?.name ?? id
    warnings.push({
      code: 'skin_missing',
      message: `El skin «${name}» ya no existe; se restableció ${what}.`,
    })
    return null
  }
  const defaultSkin = skinOrNull(snapshot.defaultSkinId, 'el skin por defecto del mapa')
  const skinRules = snapshot.skinRules.filter(
    (rule) => skinOrNull(rule.skinId, `la regla de «${rule.modname}»`) !== null
  )

  const takenElsewhere = new Set<number>()
  for (const other of maps) {
    if (other.moodleCourseId !== map.moodleCourseId || other.id === map.id) continue
    for (const bubble of other.bubbles)
      if (bubble.activityId !== null) takenElsewhere.add(bubble.activityId)
  }

  const bubbles: Bubble[] = []
  for (const saved of snapshot.bubbles) {
    if (saved.activityId !== null && takenElsewhere.has(saved.activityId)) {
      warnings.push({
        code: 'activity_already_placed',
        message: `La actividad ${saved.activityId} ya está en otro nivel; se omitió su burbuja.`,
      })
      continue
    }
    const existing = map.bubbles.find((bubble) => bubble.id === saved.id)
    bubbles.push({
      id: saved.id,
      courseMapId: map.id,
      activityId: saved.activityId,
      ...(saved.kind === 'content' ? { kind: saved.kind, content: saved.content } : {}),
      x: saved.x,
      y: saved.y,
      icon: saved.icon,
      skinId: skinOrNull(saved.skinId, 'el skin de una burbuja'),
      sequence: saved.sequence,
      status: existing?.status ?? 'locked',
      version: (existing?.version ?? 0) + 1,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    })
  }

  // A scene the backend no longer knows cannot be shown: the view is dropped
  // and reported. Bindings of bubbles that were skipped above go with them.
  let view3d: View3d | null = snapshot.view3d ?? null
  if (view3d && !SCENES.some((scene) => scene.id === view3d!.scene)) {
    warnings.push({
      code: 'scene_unknown',
      message: `La escena 3D «${view3d.scene}» ya no existe; se desactivó la vista 3D.`,
    })
    view3d = null
  }
  if (view3d) {
    const kept = new Set(bubbles.map((bubble) => bubble.id))
    view3d = { ...view3d, bindings: view3d.bindings.filter((b) => kept.has(b.bubbleId)) }
  }

  const updated = replaceMap({
    ...map,
    title: snapshot.title,
    imageUrl: snapshot.imageUrl,
    settings: snapshot.settings,
    defaultSkinId: defaultSkin,
    skinRules,
    view3d,
    bubbles,
    revision: map.revision + 1,
    updatedAt: timestamp,
  })
  return { map: toRead(updated), warnings }
}

// ---- Mapping helpers ---------------------------------------------------------

const toSummary = async (map: MockMap): Promise<CourseMapSummary> => ({
  id: map.id,
  title: map.title,
  moodleCourseId: map.moodleCourseId,
  moodleSectionId: map.moodleSectionId,
  position: map.position,
  imageUrl: map.imageUrl,
  bubbleCount: map.bubbles.length,
  completeCount: map.bubbles.filter((bubble) => bubble.status === 'complete').length,
  publication: await publicationBadge(map),
  createdAt: map.createdAt,
  updatedAt: map.updatedAt,
})

const audioInfoOf = (settings: MapSettings): AudioInfo | null => {
  const assetId = settings.audio?.assetId
  const asset = assetId ? assets.find((item) => item.id === assetId) : undefined
  if (!asset || asset.kind !== 'audio') return null
  return {
    title: asset.title,
    credit: asset.credit ?? '',
    durationSeconds: asset.durationSeconds ?? 0,
    ...availableOf(asset.kind),
  }
}

const toRead = (map: MockMap): CourseMapRead => ({
  id: map.id,
  title: map.title,
  moodleCourseId: map.moodleCourseId,
  moodleSectionId: map.moodleSectionId,
  position: map.position,
  imageUrl: map.imageUrl,
  settings: map.settings,
  defaultSkinId: map.defaultSkinId,
  skinRules: map.skinRules,
  view3d: map.view3d,
  audioInfo: audioInfoOf(map.settings),
  bubbles: wireBubbles(map.bubbles),
  revision: map.revision,
  createdAt: map.createdAt,
  updatedAt: map.updatedAt,
})

const toPublicationSummary = (publication: MockPublication): PublicationSummary => ({
  number: publication.number,
  createdAt: publication.createdAt,
  note: publication.note,
  title: publication.snapshot.title,
  bubbleCount: publication.snapshot.bubbles.length,
})

const liveStatus = (
  map: MockMap,
  publication: MockPublication,
  bubbleId: string
): Bubble['status'] =>
  map.bubbles.find((bubble) => bubble.id === bubbleId)?.status ??
  publication.statusAtPublish[bubbleId] ??
  'locked'

const toPublishedSummary = (map: MockMap, publication: MockPublication): PublishedMapSummary => ({
  id: map.id,
  title: publication.snapshot.title,
  moodleCourseId: map.moodleCourseId,
  moodleSectionId: map.moodleSectionId,
  position: map.position,
  imageUrl: publication.snapshot.imageUrl,
  bubbleCount: publication.snapshot.bubbles.length,
  completeCount: publication.snapshot.bubbles.filter(
    (bubble) => liveStatus(map, publication, bubble.id) === 'complete'
  ).length,
  publicationNumber: publication.number,
  publishedAt: publication.createdAt,
})

const toPublishedRead = (map: MockMap, publication: MockPublication): PublishedMapRead => ({
  id: map.id,
  title: publication.snapshot.title,
  moodleCourseId: map.moodleCourseId,
  moodleSectionId: map.moodleSectionId,
  position: map.position,
  imageUrl: publication.snapshot.imageUrl,
  settings: publication.snapshot.settings,
  defaultSkinId: publication.snapshot.defaultSkinId,
  skinRules: publication.snapshot.skinRules,
  view3d: publication.snapshot.view3d ?? null,
  audioInfo: audioInfoOf(publication.snapshot.settings),
  skins: publication.snapshot.skins,
  bubbles: wireBubbles(
    publication.snapshot.bubbles.map((bubble) => ({
      ...bubble,
      status: liveStatus(map, publication, bubble.id),
    }))
  ),
  publicationNumber: publication.number,
  publishedAt: publication.createdAt,
})

const requirePublished = (courseMapId: string) => {
  const map = maps.find((item) => item.id === courseMapId)
  const publication = map ? latestPublication(map) : null
  if (!map || !publication) throw notFound('not_published', 'Este nivel aún no está publicado')
  return { map, publication }
}

const mapsForCourse = (moodleCourseId: number) =>
  maps.filter((map) => map.moodleCourseId === moodleCourseId)

const activityFor = (activityId: number): Activity | null => {
  const module = mockModules.find((item) => item.activityId === activityId)
  if (!module) return null
  return {
    activityId: module.activityId,
    name: module.name,
    modname: module.modname,
    url: `${MOCK_MODULE_URL}${module.modname}/view.php?id=${module.activityId}`,
    sectionId: module.sectionId,
    sectionName: module.sectionName,
    sectionNumber: module.sectionNumber,
    hidden: module.hidden,
    placed: false,
    bubbleId: null,
    placedInMapId: null,
  }
}

const resolveBubbles = (
  mapId: string,
  bubbles: ReadonlyArray<{ id: string; activityId: number | null }>,
  includeHidden: boolean
): ResolvedCourseMap => {
  const override = mockMoodleOverride()

  if (override === 'down') {
    return {
      moodleStatus: 'unavailable',
      bubbles: bubbles.map((bubble) => ({
        bubbleId: bubble.id,
        availability: bubble.activityId === null ? 'available' : 'unknown',
        activity: null,
      })),
    }
  }

  const moodleStatus: MoodleStatus = override === 'cached' ? 'cached' : 'live'

  const resolved: ResolvedBubble[] = bubbles.map((bubble) => {
    if (bubble.activityId === null)
      return { bubbleId: bubble.id, availability: 'available', activity: null }
    const module = mockModules.find((item) => item.activityId === bubble.activityId)

    let availability: Availability
    if (override === 'hidden') availability = 'hidden'
    else if (override === 'missing') availability = 'missing'
    else if (!module) availability = 'missing'
    else if (module.hidden) availability = 'hidden'
    else availability = 'available'

    const showActivity =
      availability === 'available' || (includeHidden && availability === 'hidden')
    const activity = showActivity ? activityFor(bubble.activityId) : null
    if (activity) {
      activity.bubbleId = bubble.id
      activity.placed = true
      activity.placedInMapId = mapId
    }

    return { bubbleId: bubble.id, availability, activity }
  })

  return { moodleStatus, bubbles: resolved }
}

const readImageSize = async (file: Blob): Promise<{ width: number; height: number }> => {
  try {
    const bitmap = await createImageBitmap(file)
    const size = { width: bitmap.width, height: bitmap.height }
    bitmap.close?.()
    return size
  } catch {
    throw businessError(422, 'asset_invalid_image', 'El archivo no es una imagen válida')
  }
}

const assetUsage = (assetId: string): AssetUsage => {
  const url = `/assets/${assetId}`
  const skinUses = (config: SkinConfig) =>
    config.kind === 'image' && Object.values(config.states).includes(assetId)
  let publications = 0
  for (const map of maps) {
    for (const publication of map.publications) {
      const snapshot = publication.snapshot
      if (
        snapshot.imageUrl === url ||
        Object.values(snapshot.skins).some((skin) => skinUses(skin.config))
      ) {
        publications++
      }
    }
  }
  return {
    maps: maps.filter((map) => map.imageUrl === url).length,
    skins: skins.filter((skin) => skinUses(skin.config)).length,
    publications,
  }
}

const toAsset = (asset: MockAsset): Asset => {
  const { sha256: _sha256, ...rest } = asset
  void _sha256
  return rest
}

const toListItem = (asset: MockAsset): AssetListItem => ({
  ...toAsset(asset),
  usage: assetUsage(asset.id),
  ...availableOf(asset.kind),
})

const validateAssetMetadata = (title: string | undefined, credit: string | null | undefined) => {
  if (title !== undefined && (title.trim().length < 1 || title.trim().length > TITLE_MAX)) {
    throw businessError(
      422,
      'invalid_asset_metadata',
      `El título debe tener entre 1 y ${TITLE_MAX} caracteres`
    )
  }
  if (credit && credit.length > CREDIT_MAX) {
    throw businessError(
      422,
      'invalid_asset_metadata',
      `El crédito admite hasta ${CREDIT_MAX} caracteres`
    )
  }
}

const storeAsset = async (
  file: Blob,
  meta: Pick<MockAsset, 'kind' | 'width' | 'height' | 'title' | 'credit' | 'originalFilename'>
) => {
  const id = newId()
  const asset: MockAsset = {
    ...meta,
    id,
    mime: file.type,
    bytes: file.size,
    url: `/assets/${id}`,
    thumbUrl: meta.kind === 'background' ? `/assets/${id}/thumb` : null,
    durationSeconds: null,
    createdAt: now(),
    sha256: await sha256Hex(await file.arrayBuffer()),
  }
  assetObjectUrls.set(id, URL.createObjectURL(file))
  assets = [asset, ...assets]
  return asset
}

// ---- Audio (mock) -------------------------------------------------------------

const AUDIO_MAX_BYTES = 8 * 1024 * 1024
const AUDIO_MAX_SECONDS = 10 * 60
const AUDIO_MIMES = new Set(['audio/mpeg', 'audio/mp4'])

let libraryReady: Promise<void> | null = null

// The curated library, generated once: short tones standing in for music.
const ensureLibraryTracks = (): Promise<void> => {
  libraryReady ??= (async () => {
    for (const seed of LIBRARY_TRACKS) {
      const id = newId()
      const blob = makeToneWav(seed.frequency, seed.seconds)
      assetObjectUrls.set(id, URL.createObjectURL(blob))
      assets = [
        ...assets,
        {
          id,
          kind: 'audio',
          mime: 'audio/mpeg',
          width: 0,
          height: 0,
          bytes: blob.size,
          url: `/assets/${id}`,
          thumbUrl: null,
          durationSeconds: seed.seconds,
          title: seed.title,
          credit: seed.credit,
          originalFilename: null,
          createdAt: now(),
          sha256: `library-${id}`,
          library: true,
        },
      ]
    }
  })()
  return libraryReady
}

// POST /assets with kind=audio, in the order the contract lists the failures.
const createAudioAsset = async ({
  file,
  title,
  credit,
  license,
  rightsDeclared,
  onProgress,
}: Pick<
  AssetCreate,
  'file' | 'title' | 'credit' | 'license' | 'rightsDeclared' | 'onProgress'
>): Promise<AssetCreateResult> => {
  if (mockAudioOverride() === 'off')
    throw notFound('not_found', 'Este servidor todavía no admite música')
  if (mockAudioOverride() === 'uploads-off')
    throw businessError(503, 'audio_uploads_disabled', 'Las subidas de audio están deshabilitadas')
  if (!rightsDeclared)
    throw businessError(
      422,
      'audio_rights_declaration_required',
      'Debes declarar que tienes derecho a usar este audio'
    )
  if (!credit?.trim())
    throw businessError(422, 'audio_credit_required', 'El crédito del audio es obligatorio')
  if (file.size > AUDIO_MAX_BYTES)
    throw businessError(413, 'asset_too_large', 'El archivo supera el tamaño máximo permitido')
  if (!AUDIO_MIMES.has(file.type))
    throw businessError(422, 'audio_invalid', 'El archivo no es un audio válido (MP3 o M4A)')
  const duration = await readAudioDuration(file)
  if (duration === null)
    throw businessError(422, 'audio_invalid', 'El archivo no es un audio válido (MP3 o M4A)')
  if (duration > AUDIO_MAX_SECONDS)
    throw businessError(422, 'audio_too_long', 'El audio dura más de 10 minutos')
  onProgress?.(1)
  void license
  const asset = await storeAsset(file, {
    kind: 'audio',
    width: 0,
    height: 0,
    title: title?.trim() || file.name.replace(/\.[^.]+$/, '') || 'Audio sin título',
    credit: credit.trim(),
    originalFilename: file.name || null,
  })
  asset.durationSeconds = duration
  return { asset: toAsset(asset), created: true }
}

// ---- Implementation -------------------------------------------------------------

// 422s of PUT /view3d, checked per binding in the order the contract lists them.
const validateView3d = (map: MockMap, view3d: View3d) => {
  const scene = SCENES.find((item) => item.id === view3d.scene)
  if (!scene) {
    throw businessError(422, 'scene_unknown', 'La escena 3D no existe', { scene: view3d.scene })
  }
  const bubbleIds = new Set(map.bubbles.map((bubble) => bubble.id))
  const zones = new Set<number>()
  const bubbles = new Set<string>()
  for (const binding of view3d.bindings) {
    if (
      !Number.isInteger(binding.zoneId) ||
      binding.zoneId < 0 ||
      binding.zoneId >= scene.zoneCount
    ) {
      throw businessError(422, 'zone_out_of_range', 'La zona está fuera de la escena', {
        zoneId: binding.zoneId,
      })
    }
    if (zones.has(binding.zoneId)) {
      throw businessError(422, 'duplicate_zone', 'Hay dos actividades en la misma zona', {
        zoneId: binding.zoneId,
      })
    }
    if (bubbles.has(binding.bubbleId)) {
      throw businessError(422, 'duplicate_bubble', 'Una actividad está en dos zonas', {
        bubbleId: binding.bubbleId,
      })
    }
    if (!bubbleIds.has(binding.bubbleId)) {
      throw businessError(422, 'bubble_not_in_map', 'La actividad no pertenece a este nivel', {
        bubbleId: binding.bubbleId,
      })
    }
    zones.add(binding.zoneId)
    bubbles.add(binding.bubbleId)
    for (const [text, max] of [
      [binding.title, TITLE3D_MAX_LENGTH],
      [binding.description, DESCRIPTION3D_MAX_LENGTH],
    ] as const) {
      for (const value of Object.values(text ?? {})) {
        if (typeof value === 'string' && value.length > max) {
          throw businessError(422, 'validation_error', `El texto admite hasta ${max} caracteres`)
        }
      }
    }
  }
}

const impl: CourseMapApi = {
  async launch(assertion: string) {
    return mockLaunch(assertion)
  },

  async getMe() {
    return mockMe()
  },

  async listCourseMaps(params: CourseMapListParams): Promise<CourseMapListResult> {
    const limit = Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT)
    const offset = params.offset ?? 0
    const q = params.q?.trim().toLowerCase()
    const filtered = maps
      .filter(
        (map) => params.moodleCourseId === undefined || map.moodleCourseId === params.moodleCourseId
      )
      .filter((map) => !q || map.title.toLowerCase().includes(q))
      .sort((a, b) =>
        params.moodleCourseId !== undefined
          ? a.position - b.position || a.createdAt.localeCompare(b.createdAt)
          : b.updatedAt.localeCompare(a.updatedAt)
      )
    return {
      items: await Promise.all(filtered.slice(offset, offset + limit).map(toSummary)),
      total: filtered.length,
      limit,
      offset,
    }
  },

  async createCourseMap(input: CourseMapCreate): Promise<CourseMapSummary> {
    const sectionId = input.moodleSectionId ?? null
    if (
      sectionId !== null &&
      mapsForCourse(input.moodleCourseId).some((map) => map.moodleSectionId === sectionId)
    ) {
      throw businessError(
        409,
        'map_already_exists_for_section',
        'Ya existe un nivel para esta sección',
        {
          moodleCourseId: input.moodleCourseId,
          moodleSectionId: sectionId,
        }
      )
    }
    checkBackgroundUrl(input.imageUrl)
    const title = input.title.trim().slice(0, 120)
    const position =
      mapsForCourse(input.moodleCourseId).reduce((max, map) => Math.max(max, map.position), -1) + 1
    const map = seedMap(title, input.moodleCourseId, [], {
      imageUrl: input.imageUrl,
      moodleSectionId: sectionId,
      position,
    })
    maps = [...maps, map]
    return toSummary(map)
  },

  async getCourseMap(courseMapId: string): Promise<CourseMapRead> {
    return toRead(requireMap(courseMapId))
  },

  async patchCourseMap(
    courseMapId: string,
    input: CourseMapPatch,
    ifMatch: number
  ): Promise<CourseMapRead> {
    const map = requireMap(courseMapId)
    checkIfMatch(ifMatch, map.revision, 'currentRevision')
    if (input.imageUrl !== undefined) checkBackgroundUrl(input.imageUrl)
    return toRead(
      replaceMap({
        ...map,
        title: input.title !== undefined ? input.title.trim().slice(0, 120) : map.title,
        imageUrl: input.imageUrl ?? map.imageUrl,
        revision: map.revision + 1,
        updatedAt: now(),
      })
    )
  },

  async deleteCourseMap(courseMapId: string): Promise<void> {
    requireMap(courseMapId)
    maps = maps.filter((item) => item.id !== courseMapId)
  },

  async reorderCourseMaps(input: ReorderCourseMapsInput): Promise<ReorderCourseMapsResult> {
    const current = mapsForCourse(input.moodleCourseId)
    const currentIds = new Set(current.map((map) => map.id))
    const inputIds = new Set(input.mapIds)
    if (currentIds.size !== inputIds.size || current.some((map) => !inputIds.has(map.id))) {
      throw businessError(422, 'order_mismatch', 'El orden no coincide con los niveles del curso')
    }
    const timestamp = now()
    const positionById = new Map(input.mapIds.map((id, index) => [id, index]))
    maps = maps.map((map) =>
      positionById.has(map.id)
        ? { ...map, position: positionById.get(map.id)!, updatedAt: timestamp }
        : map
    )
    return {
      items: await Promise.all(
        mapsForCourse(input.moodleCourseId)
          .sort((a, b) => a.position - b.position)
          .map(toSummary)
      ),
    }
  },

  async updateAppearance(
    courseMapId: string,
    input: AppearanceUpdate,
    ifMatch: number
  ): Promise<CourseMapRead> {
    const map = requireMap(courseMapId)
    checkIfMatch(ifMatch, map.revision, 'currentRevision')
    if (input.defaultSkinId !== null) requireSkin(input.defaultSkinId)
    if (validateWelcome(input.settings.welcome).length > 0)
      throw businessError(422, 'welcome_invalid', 'La bienvenida no es válida')
    const seenModnames = new Set<string>()
    for (const rule of input.skinRules) {
      if (seenModnames.has(rule.modname)) {
        throw businessError(
          422,
          'duplicate_skin_rule',
          'Hay una regla duplicada para este tipo de actividad',
          {
            modname: rule.modname,
          }
        )
      }
      seenModnames.add(rule.modname)
      requireSkin(rule.skinId)
    }
    return toRead(
      replaceMap({
        ...map,
        settings: input.settings,
        defaultSkinId: input.defaultSkinId,
        skinRules: input.skinRules,
        revision: map.revision + 1,
        updatedAt: now(),
      })
    )
  },

  async updateView3d(
    courseMapId: string,
    input: View3d | null,
    ifMatch: number
  ): Promise<CourseMapRead> {
    const map = requireMap(courseMapId)
    checkIfMatch(ifMatch, map.revision, 'currentRevision')
    if (input) validateView3d(map, input)
    return toRead(
      replaceMap({ ...map, view3d: input, revision: map.revision + 1, updatedAt: now() })
    )
  },

  async listView3dScenes(): Promise<Scene3dListResult> {
    return { items: SCENES.map((scene) => ({ ...scene })) }
  },

  async getResolvedCourseMap(
    courseMapId: string,
    includeHidden: boolean
  ): Promise<ResolvedCourseMap> {
    const map = requireMap(courseMapId)
    return resolveBubbles(map.id, map.bubbles, includeHidden)
  },

  async getActivities(
    courseMapId: string,
    includeHidden: boolean,
    onlySection: boolean
  ): Promise<Activity[]> {
    const map = requireMap(courseMapId)
    const courseMaps = mapsForCourse(map.moodleCourseId)
    const placementByActivity = new Map<number, { bubbleId: string; mapId: string }>()
    for (const courseMap of courseMaps) {
      for (const bubble of courseMap.bubbles) {
        if (bubble.activityId === null) continue
        placementByActivity.set(bubble.activityId, { bubbleId: bubble.id, mapId: courseMap.id })
      }
    }
    return mockModules
      .filter((module) => includeHidden || !module.hidden)
      .filter(
        (module) =>
          !onlySection || map.moodleSectionId === null || module.sectionId === map.moodleSectionId
      )
      .map((module) => {
        const placement = placementByActivity.get(module.activityId)
        const bubbleId = placement && placement.mapId === map.id ? placement.bubbleId : null
        return {
          activityId: module.activityId,
          name: module.name,
          modname: module.modname,
          url: `${MOCK_MODULE_URL}${module.modname}/view.php?id=${module.activityId}`,
          sectionId: module.sectionId,
          sectionName: module.sectionName,
          sectionNumber: module.sectionNumber,
          hidden: module.hidden,
          placed: placement !== undefined,
          bubbleId,
          placedInMapId: placement?.mapId ?? null,
        }
      })
  },

  async createBubble(courseMapId: string, input: BubbleCreate): Promise<Bubble> {
    const map = requireMap(courseMapId)
    if ('kind' in input) {
      // A backend that predates content bubbles does not know the field and
      // rejects the body for the missing activityId.
      if (!mockFeatures().contentSupport) {
        throw businessError(422, 'validation_error', 'Field required: activityId')
      }
      checkContent(map, input.content, null)
      const timestamp = now()
      const created: Bubble = {
        id: newId(),
        courseMapId: map.id,
        kind: 'content',
        activityId: null,
        content: input.content,
        x: input.x,
        y: input.y,
        icon: input.icon ?? null,
        status: 'no_complete',
        skinId: null,
        sequence: map.bubbles.length,
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      replaceMap({ ...map, bubbles: [...map.bubbles, created], updatedAt: timestamp })
      return wireBubble(created)
    }
    for (const courseMap of mapsForCourse(map.moodleCourseId)) {
      if (courseMap.bubbles.some((bubble) => bubble.activityId === input.activityId)) {
        throw businessError(
          409,
          'activity_already_placed',
          'Esta actividad ya está en un nivel de este curso',
          {
            courseMapId: courseMap.id,
            courseMapTitle: courseMap.title,
          }
        )
      }
    }
    const timestamp = now()
    const bubble: Bubble = {
      id: newId(),
      courseMapId: map.id,
      activityId: input.activityId,
      x: input.x,
      y: input.y,
      icon: input.icon ?? null,
      status: 'locked',
      skinId: null,
      sequence: map.bubbles.length,
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    replaceMap({ ...map, bubbles: [...map.bubbles, bubble], updatedAt: timestamp })
    return wireBubble(bubble)
  },

  async updateBubble(
    courseMapId: string,
    bubbleId: string,
    input: BubbleUpdate,
    ifMatch?: number
  ): Promise<Bubble> {
    const map = requireMap(courseMapId)
    const current = requireBubble(map, bubbleId)
    // A status-only PATCH is live demo data: unguarded, and it does not
    // bump the version. Any body that mixes in content fields is guarded.
    const statusOnly = Object.keys(input).every((key) => key === 'status')
    if (!statusOnly) checkIfMatch(ifMatch, current.version, 'currentVersion')
    if ('skinId' in input && input.skinId !== null) requireSkin(input.skinId)
    if ('content' in input) {
      if (!isContentBubble(current)) {
        throw businessError(422, 'not_a_content_bubble', 'Esta burbuja no es de contenido')
      }
      checkContent(map, input.content, current.id)
    }
    const updated: Bubble = {
      ...current,
      ...input,
      version: statusOnly ? current.version : current.version + 1,
      updatedAt: now(),
    }
    replaceMap({
      ...map,
      bubbles: map.bubbles.map((bubble) => (bubble.id === bubbleId ? updated : bubble)),
      updatedAt: updated.updatedAt,
    })
    return wireBubble(updated)
  },

  async deleteBubble(courseMapId: string, bubbleId: string, ifMatch: number): Promise<void> {
    const map = requireMap(courseMapId)
    const bubble = requireBubble(map, bubbleId)
    checkIfMatch(ifMatch, bubble.version, 'currentVersion')
    // The server removes the bubble's 3D binding with it.
    replaceMap({
      ...map,
      view3d: map.view3d && {
        ...map.view3d,
        bindings: map.view3d.bindings.filter((binding) => binding.bubbleId !== bubbleId),
      },
      bubbles: map.bubbles.filter((item) => item.id !== bubbleId),
      updatedAt: now(),
    })
  },

  async reorderBubbles(
    courseMapId: string,
    input: ReorderBubblesInput
  ): Promise<ReorderBubblesResult> {
    const map = requireMap(courseMapId)
    const currentIds = new Set(map.bubbles.map((bubble) => bubble.id))
    const inputIds = new Set(input.bubbleIds)
    if (
      currentIds.size !== inputIds.size ||
      map.bubbles.some((bubble) => !inputIds.has(bubble.id))
    ) {
      throw businessError(422, 'order_mismatch', 'El orden no coincide con las burbujas del nivel')
    }
    const timestamp = now()
    const sequenceById = new Map(input.bubbleIds.map((id, index) => [id, index]))
    // Reordering is not guarded, so it does not bump versions either.
    const bubbles = map.bubbles.map((bubble) => ({
      ...bubble,
      sequence: sequenceById.get(bubble.id)!,
      updatedAt: timestamp,
    }))
    replaceMap({ ...map, bubbles, updatedAt: timestamp })
    return { bubbles: bubbles.slice().sort((a, b) => a.sequence - b.sequence) }
  },

  async listSkins(): Promise<SkinListResult> {
    return { items: skins }
  },

  async createSkin(input: SkinCreate): Promise<Skin> {
    const timestamp = now()
    const skin: Skin = {
      id: newId(),
      name: input.name.trim().slice(0, 60),
      builtin: false,
      isDefault: false,
      config: input.config,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    skins = [...skins, skin]
    return skin
  },

  async patchSkin(skinId: string, input: SkinPatch): Promise<Skin> {
    const skin = requireSkin(skinId)
    const updated: Skin = {
      ...skin,
      name: input.name !== undefined ? input.name.trim().slice(0, 60) : skin.name,
      config: input.config ?? skin.config,
      updatedAt: now(),
    }
    skins = skins.map((item) => (item.id === skinId ? updated : item))
    return updated
  },

  async deleteSkin(skinId: string): Promise<void> {
    const skin = requireSkin(skinId)
    if (skin.builtin)
      throw businessError(403, 'skin_is_builtin', 'No se pueden eliminar los skins predefinidos')
    skins = skins.filter((item) => item.id !== skinId)
  },

  // ---- Asset library ----

  async listAssets(params: AssetListParams): Promise<AssetListResult> {
    const limit = Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT)
    const offset = params.offset ?? 0
    const q = params.q?.trim().toLowerCase()
    if (params.kind === 'audio') {
      if (mockAudioOverride() === 'off')
        throw notFound('not_found', 'Este servidor todavía no admite música')
      await ensureLibraryTracks()
    }
    const filtered = assets
      .filter((asset) => !params.kind || asset.kind === params.kind)
      .filter(
        (asset) =>
          asset.kind !== 'audio' ||
          !params.scope ||
          (params.scope === 'library' ? asset.library === true : asset.library !== true)
      )
      .filter(
        (asset) =>
          !q ||
          asset.title.toLowerCase().includes(q) ||
          (asset.credit ?? '').toLowerCase().includes(q)
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return {
      items: filtered.slice(offset, offset + limit).map(toListItem),
      total: filtered.length,
      limit,
      offset,
    }
  },

  async createAsset({
    file,
    kind,
    title,
    credit,
    license,
    rightsDeclared,
    onProgress,
  }: AssetCreate): Promise<AssetCreateResult> {
    if (kind === 'audio')
      return createAudioAsset({ file, title, credit, license, rightsDeclared, onProgress })
    const override = mockAssetsOverride()
    if (override === 'down')
      throw businessError(503, 'uploads_disabled', 'Las subidas están deshabilitadas temporalmente')
    if (override === 'quota' || assets.length >= ASSET_QUOTA) {
      throw businessError(
        507,
        'asset_quota_exceeded',
        'Se alcanzó el límite de almacenamiento de imágenes'
      )
    }
    if (!ALLOWED_MIME.has(file.type) || (kind === 'image' && file.type === 'image/avif')) {
      throw businessError(
        422,
        'asset_type_not_allowed',
        'Formato de imagen no permitido (usa PNG, JPEG, WebP o AVIF)'
      )
    }
    validateAssetMetadata(title, credit)
    if (file.size > ASSET_LIMITS[kind].maxBytes) {
      throw businessError(413, 'asset_too_large', 'El archivo supera el tamaño máximo permitido')
    }
    const { width, height } = await readImageSize(file)
    if (checkDimensions(width, height, kind) !== null) {
      throw businessError(
        422,
        'asset_dimensions_too_large',
        'La imagen supera las dimensiones máximas permitidas'
      )
    }
    onProgress?.(1)
    // Identical content is stored once: 200 with the existing asset.
    const digest = await sha256Hex(await file.arrayBuffer())
    const existing = assets.find((asset) => asset.kind === kind && asset.sha256 === digest)
    if (existing) return { asset: toAsset(existing), created: false }

    const asset = await storeAsset(file, {
      kind,
      width,
      height,
      title:
        title?.trim() ||
        file.name.replace(/\.[^.]+$/, '').slice(0, TITLE_MAX) ||
        'Imagen sin título',
      credit: credit?.trim() || null,
      originalFilename: file.name || null,
    })
    return { asset: toAsset(asset), created: true }
  },

  async patchAsset(assetId: string, input: AssetPatch): Promise<Asset> {
    const asset = assets.find((item) => item.id === assetId)
    if (!asset) throw notFound('asset_not_found', 'Imagen no encontrada')
    validateAssetMetadata(input.title, input.credit)
    const updated: MockAsset = {
      ...asset,
      title: input.title !== undefined ? input.title.trim() : asset.title,
      credit: input.credit !== undefined ? input.credit?.trim() || null : asset.credit,
    }
    assets = assets.map((item) => (item.id === assetId ? updated : item))
    return toAsset(updated)
  },

  async deleteAsset(assetId: string): Promise<void> {
    const asset = assets.find((item) => item.id === assetId)
    if (!asset) throw notFound('asset_not_found', 'Imagen no encontrada')
    const usage = assetUsage(assetId)
    if (usage.maps + usage.skins + usage.publications > 0) {
      throw businessError(409, 'asset_in_use', 'La imagen está en uso y no se puede eliminar', {
        usage,
      })
    }
    const objectUrl = assetObjectUrls.get(assetId)
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    assetObjectUrls.delete(assetId)
    assets = assets.filter((item) => item.id !== assetId)
  },

  // ---- Draft vs published ----

  async getPublicationState(courseMapId: string): Promise<PublicationState> {
    return computePublicationState(requireMap(courseMapId))
  },

  async publish(courseMapId: string, input: PublishInput): Promise<PublicationSummary> {
    const map = requireMap(courseMapId)
    if (input.note && input.note.length > NOTE_MAX) {
      throw businessError(422, 'invalid_note', `La nota admite hasta ${NOTE_MAX} caracteres`)
    }
    const state = await computePublicationState(map)
    if (state.draftHash !== input.draftHash) {
      throw businessError(
        409,
        'draft_changed_since_review',
        'El borrador cambió mientras lo revisabas',
        {
          currentHash: state.draftHash,
        }
      )
    }
    if (state.status === 'up_to_date') {
      throw businessError(409, 'no_changes_to_publish', 'No hay cambios para publicar')
    }
    const problems = publishProblems(map)
    if (problems.length > 0) {
      throw businessError(422, 'publish_invalid', 'El borrador no se puede publicar', { problems })
    }
    const published = await createPublication(map, input.note?.trim() || null)
    return toPublicationSummary(latestPublication(published)!)
  },

  async listPublications(courseMapId: string, limit?: number): Promise<PublicationListResult> {
    const map = requireMap(courseMapId)
    const items = [...map.publications].reverse().map(toPublicationSummary)
    return { items: limit ? items.slice(0, limit) : items }
  },

  async discardChanges(courseMapId: string, ifMatch: number): Promise<DraftReplaceResult> {
    const map = requireMap(courseMapId)
    checkIfMatch(ifMatch, map.revision, 'currentRevision')
    const latest = latestPublication(map)
    if (!latest) throw businessError(409, 'never_published', 'Este nivel nunca se ha publicado')
    return loadSnapshotIntoDraft(map, latest.snapshot)
  },

  async restorePublication(
    courseMapId: string,
    publicationNumber: number,
    ifMatch: number
  ): Promise<DraftReplaceResult> {
    const map = requireMap(courseMapId)
    checkIfMatch(ifMatch, map.revision, 'currentRevision')
    const publication = map.publications.find((item) => item.number === publicationNumber)
    if (!publication) throw notFound('publication_not_found', 'Versión no encontrada')
    return loadSnapshotIntoDraft(map, publication.snapshot)
  },

  // ---- Published (student) read API ----

  async listPublishedCourseMaps(params: PublishedMapListParams): Promise<PublishedMapListResult> {
    const limit = Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT)
    const offset = params.offset ?? 0
    const published = maps
      .filter(
        (map) => params.moodleCourseId === undefined || map.moodleCourseId === params.moodleCourseId
      )
      .filter((map) => latestPublication(map) !== null)
      .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt))
    return {
      items: published
        .slice(offset, offset + limit)
        .map((map) => toPublishedSummary(map, latestPublication(map)!)),
      total: published.length,
      limit,
      offset,
    }
  },

  async getPublishedCourseMap(courseMapId: string): Promise<PublishedMapRead> {
    const { map, publication } = requirePublished(courseMapId)
    return toPublishedRead(map, publication)
  },

  async getPublishedResolvedCourseMap(
    courseMapId: string,
    includeHidden: boolean
  ): Promise<ResolvedCourseMap> {
    const { map, publication } = requirePublished(courseMapId)
    return resolveBubbles(map.id, publication.snapshot.bubbles, includeHidden)
  },
}

// ---- Seed data ------------------------------------------------------------------

// Procedurally drawn so the library has varied aspect ratios to demo without
// shipping (or licensing) extra artwork.
const drawSeedBackground = (
  width: number,
  height: number,
  hues: [number, number],
  label: string
): Promise<Blob> => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, `hsl(${hues[0]} 55% 62%)`)
  gradient.addColorStop(1, `hsl(${hues[1]} 60% 38%)`)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  for (let i = 0; i < 9; i++) {
    ctx.beginPath()
    ctx.arc(
      ((i * 0.37 + 0.1) % 1) * width,
      ((i * 0.53 + 0.2) % 1) * height,
      Math.min(width, height) * (0.08 + (i % 3) * 0.05),
      0,
      Math.PI * 2
    )
    ctx.fill()
  }
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.font = `600 ${Math.round(height / 12)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText(`${label} · ${width}×${height}`, width / 2, height / 2)
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob!), 'image/png'))
}

const seedAssets = async (): Promise<MockAsset[]> => {
  if (typeof document === 'undefined') return []
  const specs: {
    title: string
    credit: string | null
    width: number
    height: number
    hues: [number, number]
  }[] = [
    {
      title: 'Archipiélago (panorámico)',
      credit: 'Ilustración propia, uso interno',
      width: 2400,
      height: 800,
      hues: [195, 225],
    },
    {
      title: 'Torre del bosque (vertical)',
      credit: null,
      width: 900,
      height: 1400,
      hues: [110, 160],
    },
    {
      title: 'Desierto al atardecer',
      credit: 'Autor: Equipo Rumbos · CC BY 4.0',
      width: 1920,
      height: 1080,
      hues: [25, 340],
    },
  ]
  const created: MockAsset[] = []
  for (const spec of specs) {
    const file = new File(
      [await drawSeedBackground(spec.width, spec.height, spec.hues, spec.title)],
      `${spec.title}.png`,
      {
        type: 'image/png',
      }
    )
    created.push(
      await storeAsset(file, {
        kind: 'background',
        width: spec.width,
        height: spec.height,
        title: spec.title,
        credit: spec.credit,
        originalFilename: file.name,
      })
    )
  }
  return created
}

const mutateMap = (id: string, change: (map: MockMap) => MockMap) => {
  const map = maps.find((item) => item.id === id)!
  return replaceMap(change({ ...map, revision: map.revision + 1, updatedAt: now() }))
}

const seedPublications = async (library: MockAsset[]) => {
  const byTitle = (prefix: string) => maps.find((map) => map.title.startsWith(prefix))!
  const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()
  const editBubble = (map: MockMap, index: number, patch: Partial<Bubble>): MockMap => ({
    ...map,
    bubbles: map.bubbles.map((bubble, i) =>
      i === index ? { ...bubble, ...patch, version: bubble.version + 1 } : bubble
    ),
  })

  // Level 1: published, nothing pending.
  await createPublication(
    byTitle('Fundamentos de programación — Nivel 1'),
    'Primera versión',
    daysAgo(6)
  )

  // Level 2: three publications, then edits on top of the last one.
  const level2 = byTitle('Fundamentos de programación — Nivel 2')
  await createPublication(level2, 'Versión inicial', daysAgo(12))
  await createPublication(
    mutateMap(level2.id, (map) => editBubble(map, 0, { x: 0.2, y: 0.55 })),
    'Ajusto posiciones',
    daysAgo(8)
  )
  await createPublication(
    mutateMap(level2.id, (map) => editBubble(map, 1, { icon: 'star' })),
    'Icono de estrella',
    daysAgo(3)
  )
  mutateMap(level2.id, (map) => ({
    ...editBubble(editBubble(map, 2, { x: 0.58, y: 0.62 }), 3, { x: 0.88, y: 0.28 }),
    imageUrl: library[0] ? `/assets/${library[0].id}` : map.imageUrl,
  }))

  // Level 3 and "Ciudadanía digital" stay never published; the other demo
  // courses are published so the student view has something to show.
  await createPublication(byTitle('Matemáticas para datos'), null, daysAgo(2))
  await createPublication(byTitle('Historia regional'), 'Lanzamiento del curso', daysAgo(1))
  await createPublication(byTitle('Taller en construcción'), null, daysAgo(1))
}

const ready: Promise<void> = (async () => {
  const library = await seedAssets()
  await seedPublications(library)
})()

// Every call waits for the seed (it hashes with crypto.subtle, so it is async)
// and then for the optional artificial latency.
const delay = () => {
  const ms = mockLatency()
  return ms > 0 ? new Promise<void>((resolve) => setTimeout(resolve, ms)) : Promise.resolve()
}

const withSeedAndLatency = (api: CourseMapApi): CourseMapApi =>
  Object.fromEntries(
    Object.entries(api).map(([name, fn]) => [
      name,
      async (...args: unknown[]) => {
        await ready
        await delay()
        return (fn as (...a: unknown[]) => unknown)(...args)
      },
    ])
  ) as unknown as CourseMapApi

export const mockCourseMapApi: CourseMapApi = withMockAuth(
  withSeedAndLatency(impl),
  (courseMapId) => {
    return maps.find((map) => map.id === courseMapId)?.moodleCourseId ?? null
  }
)

// Dev-only: act as "another editor" so conflicts can be provoked from one tab.
//   __rumbosMock.editBubbleElsewhere(mapId, bubbleId)  bumps that bubble's version and nudges it
//   __rumbosMock.editMapElsewhere(mapId)               bumps the map revision and renames it
//   __rumbosMock.maps() / .bubbles(mapId)              ids and current revisions/versions
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __rumbosMock: unknown }).__rumbosMock = {
    editBubbleElsewhere: (mapId: string, bubbleId: string) => {
      const map = requireMap(mapId)
      replaceMap({
        ...map,
        bubbles: map.bubbles.map((bubble) =>
          bubble.id === bubbleId
            ? {
                ...bubble,
                x: Math.min(0.95, bubble.x + 0.05),
                version: bubble.version + 1,
                updatedAt: now(),
              }
            : bubble
        ),
      })
    },
    editMapElsewhere: (mapId: string) => {
      const map = requireMap(mapId)
      replaceMap({
        ...map,
        title: `${map.title.replace(/ \(otra persona\)$/, '')} (otra persona)`,
        revision: map.revision + 1,
        updatedAt: now(),
      })
    },
    maps: () => maps.map(({ id, title, revision }) => ({ id, title, revision })),
    bubbles: (mapId: string) =>
      requireMap(mapId).bubbles.map(({ id, x, y, version }) => ({ id, x, y, version })),
  }
}
