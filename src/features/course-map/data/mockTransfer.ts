// The mock backend's half of export and import of levels (dev and the mock
// host only). The scenario is chosen from the mock host ("Import scenario"),
// so every branch of the wizard can be driven without a real archive.
import type { ImportDescriptor, ImportPreview, ImportStaged } from '../../transfer/types.ts'

export const TRANSFER_SCENARIOS = [
  'perfect',
  'doubtful',
  'placed',
  'widgets',
  'audio',
  'expired',
  'invalid',
  'too-large',
  'version',
  'rate-limited',
  'unsupported',
  'export-never-saved',
  'export-too-large',
] as const

export type TransferScenario = (typeof TRANSFER_SCENARIOS)[number]

let scenario: TransferScenario = 'perfect'

export const setTransferScenario = (next: string) => {
  if ((TRANSFER_SCENARIOS as readonly string[]).includes(next)) scenario = next as TransferScenario
}

export const getTransferScenario = () => scenario

const descriptor = (
  key: string,
  name: string,
  modname: string,
  sectionNumber: number,
  positionInSection: number
): ImportDescriptor => ({
  key,
  mapRef: 'map-1',
  bubbleRef: `bubble-${key}`,
  modname,
  name,
  sectionNumber,
  sectionName: `Semana ${sectionNumber}`,
  positionInSection,
})

// The names the mock host's course uses (cmids 101-109).
const EXACT: ImportDescriptor[] = [
  descriptor('d1', 'Quiz de introducción', 'quiz', 1, 1),
  descriptor('d2', 'Video de bienvenida', 'url', 1, 2),
  descriptor('d3', 'Taller 1: configuración del entorno', 'assign', 2, 1),
]

const DOUBTFUL: ImportDescriptor[] = [
  descriptor('d1', 'QUIZ de introduccion', 'quiz', 1, 1),
  descriptor('d2', 'Cuestionario inicial', 'url', 1, 2),
  descriptor('d3', 'Taller 1 - configuracion del entorno de trabajo', 'assign', 2, 3),
  descriptor('d4', 'Foro de dudas', 'forum', 2, 4),
]

export const mockPreview = (): ImportPreview => {
  const descriptors = scenario === 'doubtful' ? DOUBTFUL : EXACT
  const preview: ImportPreview = {
    formatVersion: 1,
    maps: [
      {
        ref: 'map-1',
        title: 'Nivel importado',
        bubbleCount: descriptors.length + 1,
        activityBubbles: descriptors.length,
        contentBubbles: 1,
        hasWelcome: true,
        hasAudio: scenario === 'audio',
        hasView3d: scenario === 'widgets',
      },
    ],
    descriptors,
    assets: { count: 4, bytes: 2_300_000 },
    audio: { ownTracks: [], libraryTracks: [] },
    customSkins: 1,
    warnings: [],
  }
  if (scenario === 'widgets')
    preview.warnings.push(
      {
        code: 'widgets_disabled',
        message: 'Widgets are disabled for this site.',
      },
      { code: 'scene_unknown', message: 'Unknown 3D scene.' }
    )
  if (scenario === 'audio') {
    preview.audio = {
      ownTracks: [
        { title: 'Tema del nivel', credit: 'Ana Pérez', license: 'CC BY 4.0' },
        { title: 'Ambiente del bosque', credit: null, license: null },
      ],
      libraryTracks: [
        { title: 'Pista de la biblioteca', available: true },
        { title: 'Pista retirada', available: false },
      ],
    }
    preview.warnings.push({
      code: 'library_track_unavailable',
      message: 'A library track is not available.',
    })
  }
  return preview
}

export const mockStaged = (): ImportStaged => ({
  importId: 'mock-import-1',
  expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
  preview: mockPreview(),
})

// What `exportMaps` hands back: not a real archive, but a blob with the right
// type so the download path can be exercised.
export const mockArchive = (includeOwnAudio: boolean): Blob =>
  new Blob([`PK mock archive audio=${includeOwnAudio}`], { type: 'application/zip' })
