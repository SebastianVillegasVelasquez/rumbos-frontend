// Content bubbles (backend contract): bubbles that are not Moodle activities,
// such as an introduction. Blocks are structured data and never HTML; a widget
// is author-written HTML that only ever runs inside the sandbox (see sandbox.ts).

export type AutoOpen = 'never' | 'first_visit'

export type Block =
  | { type: 'heading'; text: string; level: 2 | 3 }
  | { type: 'paragraph'; text: string }
  | { type: 'image'; assetId: string; alt: string; caption?: string }
  | { type: 'video'; provider: VideoProvider; videoId: string; title: string }
  | { type: 'link'; text: string; url: string }
  | { type: 'divider' }

export type VideoProvider = 'youtube' | 'vimeo'

export interface BlocksBody {
  schemaVersion: 1
  blocks: Block[]
}

export interface BlocksContent {
  type: 'blocks'
  title: string
  autoOpen: AutoOpen
  body: BlocksBody
}

export interface WidgetContent {
  type: 'widget'
  title: string
  autoOpen: AutoOpen
  altText: string
  html: string
}

export type Content = BlocksContent | WidgetContent

export type BubbleKind = 'activity' | 'content'

export const CONTENT_LIMITS = {
  titleMax: 120,
  headingMax: 120,
  paragraphMax: 1500,
  altMax: 200,
  captionMax: 200,
  videoTitleMax: 120,
  linkTextMax: 80,
  maxBlocks: 40,
  maxBodyBytes: 20 * 1024,
  widgetAltMax: 300,
  widgetHtmlMaxBytes: 200 * 1024,
  maxContentBytesPerMap: 1024 * 1024,
} as const

// A bubble from a backend that predates content bubbles has no `kind`: it is an
// activity.
export const isContentBubble = (bubble: { kind?: BubbleKind }): boolean => bubble.kind === 'content'
