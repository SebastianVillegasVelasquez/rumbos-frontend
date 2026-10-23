import type { Block } from '../contentTypes.ts'

// The editor's list of blocks: each carries a key that never changes, so moving
// a block keeps its fields (and the focus on its buttons) where they were.
export interface EditorBlock {
  key: string
  block: Block
  // What the author typed in a video block's address field, kept as typed so a
  // half-written link is not lost while the block is invalid.
  rawVideo?: string
}

let counter = 0
export const newKey = () => `b${++counter}`

export const toEditorBlocks = (blocks: readonly Block[]): EditorBlock[] =>
  blocks.map((block) => ({ key: newKey(), block }))

export const fromEditorBlocks = (items: readonly EditorBlock[]): Block[] =>
  items.map((item) => item.block)

export const blankBlock = (type: Block['type']): Block => {
  switch (type) {
    case 'heading':
      return { type, text: '', level: 2 }
    case 'paragraph':
      return { type, text: '' }
    case 'image':
      return { type, assetId: '', alt: '' }
    case 'video':
      return { type, provider: 'youtube', videoId: '', title: '' }
    case 'link':
      return { type, text: '', url: 'https://' }
    case 'divider':
      return { type }
  }
}

// Moves one item by one place; out-of-range moves leave the list as it was.
export const moveItem = <T>(items: readonly T[], from: number, by: -1 | 1): T[] => {
  const to = from + by
  if (from < 0 || from >= items.length || to < 0 || to >= items.length) return [...items]
  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}
