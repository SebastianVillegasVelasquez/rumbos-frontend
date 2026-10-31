import type { CourseMapSummary } from '../course-map/data/types.ts'

// The wire shapes of the export and import routes (backend contract: export and
// import of maps as a `.rumbos` archive).

export type ExportSource = 'draft' | 'saved'

// What the app says about an activity a selected map uses, so whoever imports
// the archive into another course can match it with theirs.
export interface ExportActivityDescriptor {
  cmid: number
  name: string
  modname: string
  sectionNumber: number
  sectionName: string
  positionInSection: number
}

export interface ExportRequest {
  mapIds: string[]
  source: ExportSource
  includeOwnAudio: boolean
  activities: ExportActivityDescriptor[]
}

export interface ImportMapPreview {
  ref: string
  title: string
  bubbleCount: number
  activityBubbles: number
  contentBubbles: number
  hasWelcome: boolean
  hasAudio: boolean
  hasView3d: boolean
}

export interface ImportDescriptor {
  key: string
  mapRef: string
  bubbleRef: string
  modname: string
  name: string
  sectionNumber: number
  sectionName: string
  positionInSection: number
}

export type ImportWarningCode =
  | 'widgets_disabled'
  | 'scene_unknown'
  | 'audio_skipped'
  | 'library_track_unavailable'
  | 'audio_uploads_disabled'

export interface ImportWarning {
  code: ImportWarningCode | (string & {})
  message: string
}

export interface ImportPreview {
  formatVersion: number
  maps: ImportMapPreview[]
  descriptors: ImportDescriptor[]
  assets: { count: number; bytes: number }
  audio: {
    ownTracks: { title: string; credit: string | null; license: string | null }[]
    libraryTracks: { title: string; available: boolean }[]
  }
  customSkins: number
  warnings: ImportWarning[]
}

export interface ImportStaged {
  importId: string
  expiresAt: string
  preview: ImportPreview
}

export interface ImportApplyInput {
  mapping: Record<string, number | null>
  audioRightsDeclared?: boolean
}

export interface ImportApplyResult {
  maps: CourseMapSummary[]
  skippedBubbles: number
  warnings: ImportWarning[]
}
