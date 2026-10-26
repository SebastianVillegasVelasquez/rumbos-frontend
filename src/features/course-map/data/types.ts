// Mirrors the backend's camelCase JSON contract (app/schemas in rumbos-backend).
// Contract v4: an optional 3D view per map (scenes, zone bindings, view3d on the
// draft and the published read). Contract v3: draft vs published, optimistic concurrency (revision/version +
// If-Match), an asset library. Contract v2: several maps ("levels") per course, map settings/appearance,
// procedural and image skins, and an asset store for backgrounds/bubble art.

import type { BubbleKind, Content } from '../../content/contentTypes.ts'

export type BubbleStatus = 'locked' | 'no_complete' | 'in_progress' | 'complete'

export type BubbleIcon =
  'question' | 'chest' | 'star' | 'flag' | 'book' | 'video' | 'trophy' | 'lock'

export interface Bubble {
  id: string
  courseMapId: string
  // Absent on a backend that predates content bubbles: an activity bubble.
  kind?: BubbleKind
  // The Moodle cmid; null for a content bubble.
  activityId: number | null
  content?: Content | null
  x: number
  y: number
  icon: BubbleIcon | null
  status: BubbleStatus
  skinId: string | null
  sequence: number
  // Optimistic-concurrency counter; bumped by every content edit (not by
  // status-only updates, which are live demo data).
  version: number
  createdAt: string
  updatedAt: string
}

// What the canvas, the HUD and the overview actually read from a bubble. A
// draft Bubble and a published bubble both satisfy it, which is what lets one
// renderer serve editors and students.
export type RenderableBubble = Pick<
  Bubble,
  'id' | 'kind' | 'activityId' | 'content' | 'x' | 'y' | 'icon' | 'skinId' | 'sequence' | 'status'
> & {
  // False when Moodle does not track the activity's completion (embed mode,
  // completion "none"): it can never become complete, so it is neither "next"
  // nor part of the progress. Absent means tracked (the backend source).
  tracked?: boolean
}

export type PublicationStatus = 'never_published' | 'up_to_date' | 'unpublished_changes'

export interface PublicationBadge {
  status: PublicationStatus
  number: number | null
  publishedAt: string | null
}

export interface CourseMapSummary {
  id: string
  title: string
  moodleCourseId: number
  moodleSectionId: number | null
  position: number
  imageUrl: string
  bubbleCount: number
  completeCount: number
  publication: PublicationBadge
  createdAt: string
  updatedAt: string
}

export type MapFit = 'original' | 'fit-width' | 'fit-height' | 'contain'

export type MapMode = 'explorative' | 'guided'

export type PathStyle = 'dashed' | 'solid' | 'dotted'

export type AmbientKind = 'none' | 'fireflies' | 'snow' | 'leaves' | 'clouds' | 'sparkles'

export type MapIntro = 'none' | 'flyin'

export interface MapInitialView {
  x: number
  y: number
  zoom: number
}

export interface MapSettings {
  schemaVersion: 1
  mode: MapMode
  fit: MapFit
  initialView: MapInitialView | null
  path: {
    visible: boolean
    style: PathStyle
    color: string | null
    animated: boolean
  }
  ambient: {
    kind: AmbientKind
    intensity: number
  }
  intro: MapIntro
  // Background music. Absent or null: none.
  audio?: MapAudio | null
  // The welcome curtain. Null or absent means all defaults; a backend that
  // predates it never sends the key (the editor then hides the tab).
  welcome?: MapWelcome | null
}

export type WelcomeShow = 'first_visit' | 'always'

export interface MapWelcome {
  enabled: boolean
  // At most 120 characters; the only placeholder allowed is {curso}.
  title: string | null
  // At most 300 characters.
  message: string | null
  video: { provider: 'youtube' | 'vimeo'; videoId: string } | null
  // Start the video when the viewer enters (default true).
  playOnEnter: boolean
  show: WelcomeShow
}

export const WELCOME_LIMITS = { titleMax: 120, messageMax: 300 } as const

export interface MapAudio {
  assetId: string
  // 0..1, the volume the viewer starts with (default 0.4).
  volume: number
  loop: boolean
  // Start by itself after the viewer's first tap or key press. The editor
  // pre-selects it when music is first added (the wire default stays false).
  startAfterInteraction: boolean
}

export const DEFAULT_MAP_AUDIO = {
  volume: 0.4,
  loop: true,
  startAfterInteraction: true,
} as const

// Read-only on CourseMapRead and PublishedMapRead: what to show as credit.
export interface AudioInfo {
  title: string
  credit: string
  durationSeconds: number
  // Absent on an older backend: that means "unknown", never "false".
  available?: boolean
}

export interface SkinRule {
  modname: string
  skinId: string
}

// ---- 3D view (contract v4) ---------------------------------------------------

// A scene is a hand-authored 3D world with a fixed number of zones; the
// backend lists the ones it accepts, the frontend registry the ones it can draw.
export interface Scene3d {
  id: string
  zoneCount: number
}

export interface Scene3dListResult {
  items: Scene3d[]
}

// Plain text per language; a missing language falls back to the scene's own
// built-in text. Limits: TITLE3D_MAX_LENGTH / DESCRIPTION3D_MAX_LENGTH.
export interface LocalizedText3d {
  es?: string
  en?: string
}

export interface View3dBinding {
  // 0 <= zoneId < the scene's zoneCount; one bubble per zone and vice versa.
  zoneId: number
  bubbleId: string
  title: LocalizedText3d | null
  description: LocalizedText3d | null
}

export interface View3d {
  scene: string
  bindings: View3dBinding[]
}

export interface CourseMapRead {
  id: string
  title: string
  moodleCourseId: number
  moodleSectionId: number | null
  position: number
  imageUrl: string
  settings: MapSettings
  defaultSkinId: string | null
  skinRules: SkinRule[]
  // null: the map has no 3D view (and students get no 2D/3D selector).
  view3d: View3d | null
  audioInfo?: AudioInfo | null
  bubbles: Bubble[]
  revision: number
  createdAt: string
  updatedAt: string
}

// Kept as an alias: most of the existing code refers to the single-map detail
// shape by this name.
export type CourseMapDetail = CourseMapRead

export interface CourseMapListParams {
  moodleCourseId?: number
  q?: string
  limit?: number
  offset?: number
}

export interface CourseMapListResult {
  items: CourseMapSummary[]
  total: number
  limit: number
  offset: number
}

export interface CourseMapPatch {
  title?: string
  imageUrl?: string
}

export interface ReorderCourseMapsInput {
  moodleCourseId: number
  mapIds: string[]
}

export interface ReorderCourseMapsResult {
  items: CourseMapSummary[]
}

export type MoodleStatus = 'live' | 'cached' | 'unavailable'

// 'restricted' (embed mode only): the activity exists and the user can see it,
// but a Moodle access restriction currently keeps them out.
export type Availability = 'available' | 'hidden' | 'restricted' | 'missing' | 'unknown'

export interface ResolvedBubble {
  bubbleId: string
  availability: Availability
  activity: Activity | null
}

export interface ResolvedCourseMap {
  moodleStatus: MoodleStatus
  bubbles: ResolvedBubble[]
}

export interface Activity {
  activityId: number
  name: string
  modname: string
  url: string
  sectionId: number
  sectionName: string
  sectionNumber: number
  hidden: boolean
  // True when placed on ANY map of the course, not just the current one.
  placed: boolean
  bubbleId: string | null
  placedInMapId: string | null
  // Embed mode, restricted activities: why the user cannot open it yet. Plain
  // text from Moodle, shown as a tooltip.
  availabilityInfo?: string | null
}

export interface CourseMapCreate {
  title: string
  moodleCourseId: number
  imageUrl: string
  moodleSectionId?: number
}

export type BubbleCreate =
  | { activityId: number; x: number; y: number; icon?: BubbleIcon }
  | { kind: 'content'; content: Content; x: number; y: number; icon?: BubbleIcon }

// Partial update. x and y always travel together, and every field is non-null
// except icon/skinId, where null clears the override. `sequence` only
// changes through the bubble-order endpoint.
export type BubbleUpdate =
  | { x: number; y: number }
  | { icon: BubbleIcon | null }
  | { status: BubbleStatus }
  | { skinId: string | null }
  // Content bubbles only; guarded like every other content edit.
  | { content: Content }

export interface ReorderBubblesInput {
  bubbleIds: string[]
}

export interface ReorderBubblesResult {
  bubbles: Bubble[]
}

export interface AppearanceUpdate {
  settings: MapSettings
  defaultSkinId: string | null
  skinRules: SkinRule[]
}

// ---- Skins ----------------------------------------------------------------

export type SkinShape = 'circle' | 'hexagon' | 'badge' | 'pin'

export type SkinIdleEffect = 'none' | 'float' | 'pulse' | 'breathe'

export type SkinCompletionEffect = 'none' | 'ripple' | 'burst'

export type SkinIconMode = 'auto' | 'preset' | 'none'

export type SkinLabelMode = 'hover' | 'always' | 'never'

export interface SkinPaletteEntry {
  fill: string
  accent: string
  glow: string
}

export interface SkinPalette {
  locked: SkinPaletteEntry
  available: SkinPaletteEntry
  inProgress: SkinPaletteEntry
  complete: SkinPaletteEntry
}

export interface ProceduralSkin {
  schemaVersion: 1
  kind: 'procedural'
  shape: SkinShape
  size: number
  palette: SkinPalette
  icon: {
    mode: SkinIconMode
    preset: BubbleIcon | null
    color: 'auto' | string
  }
  label: {
    mode: SkinLabelMode
  }
  effects: {
    idle: SkinIdleEffect
    ring: boolean
    glow: boolean
    completion: SkinCompletionEffect
  }
}

export type ImageSkinState = 'available' | 'locked' | 'next' | 'inProgress' | 'complete' | 'hover'

export interface ImageSkin {
  schemaVersion: 1
  kind: 'image'
  size: number
  anchor: 'center' | 'bottom'
  states: {
    available: string
    locked: string | null
    next: string | null
    inProgress: string | null
    complete: string | null
    hover: string | null
  }
  label: {
    mode: SkinLabelMode
  }
  effects: {
    idle: 'none' | 'float' | 'breathe'
    completion: SkinCompletionEffect
  }
}

export type SkinConfig = ProceduralSkin | ImageSkin

export interface Skin {
  id: string
  name: string
  builtin: boolean
  isDefault: boolean
  config: SkinConfig
  createdAt: string
  updatedAt: string
}

export interface SkinCreate {
  name: string
  config: SkinConfig
}

export interface SkinPatch {
  name?: string
  config?: SkinConfig
}

export interface SkinListResult {
  items: Skin[]
}

// ---- Assets -----------------------------------------------------------------

export type ImageAssetKind = 'background' | 'bubble' | 'image'

// Contract: audio assets (background music). Their `url` is "/assets/{id}" and
// supports HTTP Range requests (iOS Safari will not play audio without them).
export type AssetKind = ImageAssetKind | 'audio'

export type AudioMime = 'audio/mpeg' | 'audio/mp4'

// "library" is curated by OBJ Digital and global; "tenant" is what this site's
// editors uploaded.
export type AssetScope = 'library' | 'tenant'

export interface Asset {
  id: string
  kind: AssetKind
  mime: string
  width: number
  height: number
  bytes: number
  url: string
  thumbUrl: string | null
  // Audio only.
  durationSeconds?: number | null
  title: string
  credit: string | null
  originalFilename: string | null
  createdAt: string
}

export interface AssetUsage {
  maps: number
  skins: number
  publications: number
}

export interface AssetListItem extends Asset {
  usage: AssetUsage
  // False when the file is missing on the server. Absent on an older backend:
  // that means "unknown", never "false".
  available?: boolean
}

export interface AssetListParams {
  kind?: AssetKind
  scope?: AssetScope
  q?: string
  limit?: number
  offset?: number
}

export interface AssetListResult {
  items: AssetListItem[]
  total: number
  limit: number
  offset: number
}

export interface AssetCreate {
  file: File
  kind: AssetKind
  title?: string
  credit?: string
  // Audio only. The editor must tick the rights declaration; it is sent as
  // rightsDeclared="true".
  license?: string
  rightsDeclared?: boolean
  // Upload progress as a 0..1 fraction (real client only).
  onProgress?: (fraction: number) => void
}

// `created` is false when the backend answered 200: identical content already
// existed and that asset was returned instead of storing a duplicate.
export interface AssetCreateResult {
  asset: Asset
  created: boolean
}

export interface AssetPatch {
  title?: string
  credit?: string | null
}

// ---- Draft vs published -------------------------------------------------------

export interface Warning {
  code: string
  message: string
}

export interface PublicationChanges {
  backgroundChanged: boolean
  titleChanged: boolean
  settingsChanged: boolean
  skinsChanged: boolean
  view3dChanged: boolean
  // Absent on a backend that predates audio.
  audioChanged?: boolean
  // Absent on a backend that predates content bubbles.
  contentChanged?: boolean
  bubblesAdded: number
  bubblesRemoved: number
  bubblesMoved: number
  bubblesRestyled: number
}

export interface PublicationState {
  status: PublicationStatus
  currentNumber: number | null
  currentPublishedAt: string | null
  currentNote: string | null
  draftHash: string
  changes: PublicationChanges | null
}

export interface PublishInput {
  draftHash: string
  note?: string
}

export interface PublicationSummary {
  number: number
  createdAt: string
  note: string | null
  title: string
  bubbleCount: number
}

export interface PublicationListResult {
  items: PublicationSummary[]
}

// Result of discard-changes / restore: the new draft plus anything the server
// had to adjust on the way (e.g. a skin that no longer exists was reset).
export interface DraftReplaceResult {
  map: CourseMapRead
  warnings: Warning[]
}

// ---- Published (student) read API ------------------------------------------------

export interface PublishedMapSummary {
  id: string
  title: string
  moodleCourseId: number
  moodleSectionId: number | null
  position: number
  imageUrl: string
  bubbleCount: number
  completeCount: number
  publicationNumber: number
  publishedAt: string
}

export interface PublishedMapListParams {
  moodleCourseId?: number
  limit?: number
  offset?: number
}

export interface PublishedMapListResult {
  items: PublishedMapSummary[]
  total: number
  limit: number
  offset: number
}

export interface PublishedSkin {
  name: string
  isDefault: boolean
  config: SkinConfig
}

export interface PublishedBubble {
  id: string
  kind?: BubbleKind
  activityId: number | null
  content?: Content | null
  x: number
  y: number
  icon: BubbleIcon | null
  skinId: string | null
  sequence: number
  // Always live, not part of a publication.
  status: BubbleStatus
}

export interface PublishedMapRead {
  id: string
  title: string
  moodleCourseId: number
  moodleSectionId: number | null
  position: number
  imageUrl: string
  settings: MapSettings
  defaultSkinId: string | null
  skinRules: SkinRule[]
  // What students see in 3D; frozen at publish time like everything below.
  view3d: View3d | null
  audioInfo?: AudioInfo | null
  // Frozen copies taken at publish time.
  skins: Record<string, PublishedSkin>
  bubbles: PublishedBubble[]
  publicationNumber: number
  publishedAt: string
}

// ---- Auth (embed mode) --------------------------------------------------------

export type AuthRole = 'editor' | 'student'

// POST /auth/launch. The access token is kept in memory only.
export interface LaunchResult {
  accessToken: string
  tokenType: 'Bearer'
  expiresIn: number
  role: AuthRole
  courseId: number
  hostOrigin: string
}

// GET /auth/me. `features` is absent on a backend that predates it: no widgets.
export interface AuthMe {
  role: AuthRole
  courseId: number
  features?: { widgets?: boolean }
}

// ---- Errors -----------------------------------------------------------------

// Business errors use `detail = { code, message, ...extras }`.
export interface ApiErrorDetail {
  code: string
  message: string
  [extra: string]: unknown
}
