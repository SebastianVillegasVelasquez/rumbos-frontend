import type { AssessmentItem, ItemResponse, SectionPayload } from './types.ts'

// What an answer is, free of React: whether an item counts as answered, the word
// counter of a written task, the pairing of a matching task and the numbering the
// review screen uses. No keys and no correctness here: only completeness.

export type ItemStatus = 'empty' | 'partial' | 'done'

const text = (response: ItemResponse | undefined, key: string): string => {
  if (!response || !('values' in response)) return ''
  return response.values[key] ?? ''
}

// Words as a reader counts them: a run of non-space characters with at least one
// letter or digit. "don't" and "check-in" are one word; a lone dash is none.
export const countWords = (value: string): number =>
  value
    .trim()
    .split(/\s+/)
    .filter((token) => /[\p{L}\p{N}]/u.test(token)).length

const BLANK = /\{([A-Za-z0-9_]+)\}/g

export interface TemplatePiece {
  kind: 'text' | 'blank'
  value: string
}

// The template as alternating pieces; blanks are written {id}.
export const splitTemplate = (template: string): TemplatePiece[] => {
  const pieces: TemplatePiece[] = []
  let last = 0
  for (const match of template.matchAll(BLANK)) {
    if (match.index > last) pieces.push({ kind: 'text', value: template.slice(last, match.index) })
    pieces.push({ kind: 'blank', value: match[1] })
    last = match.index + match[0].length
  }
  if (last < template.length) pieces.push({ kind: 'text', value: template.slice(last) })
  return pieces
}

// The words of the whole message: the template's own text plus what the student
// wrote in the blanks.
export const templateWordCount = (template: string, response: ItemResponse | undefined): number =>
  countWords(
    splitTemplate(template)
      .map((piece) => (piece.kind === 'text' ? piece.value : text(response, piece.value)))
      .join(' ')
  )

export type WordLimit = 'below' | 'within' | 'above'

export const wordLimit = (count: number, min: number, max: number): WordLimit =>
  count < min ? 'below' : count > max ? 'above' : 'within'

export const itemStatus = (
  item: AssessmentItem,
  response: ItemResponse | undefined
): ItemStatus => {
  switch (item.type) {
    case 'mcq':
    case 'listen_choose':
    case 'gap_choice':
      return response && 'option_id' in response && response.option_id ? 'done' : 'empty'
    case 'match_audio': {
      const pairs = response && 'pairs' in response ? response.pairs : []
      if (pairs.length === 0) return 'empty'
      return pairs.length >= item.clips.length ? 'done' : 'partial'
    }
    case 'form_fields': {
      const filled = item.fields.filter((f) => text(response, f.field_id).trim() !== '').length
      return filled === 0 ? 'empty' : filled === item.fields.length ? 'done' : 'partial'
    }
    case 'written_answers': {
      const filled = item.questions.filter((q) => text(response, q.q_id).trim() !== '').length
      return filled === 0 ? 'empty' : filled === item.questions.length ? 'done' : 'partial'
    }
    case 'template_text': {
      const blanks = splitTemplate(item.template).filter((p) => p.kind === 'blank')
      const filled = blanks.filter((p) => text(response, p.value).trim() !== '').length
      if (filled === 0) return 'empty'
      if (filled < blanks.length) return 'partial'
      return wordLimit(
        templateWordCount(item.template, response),
        item.min_words,
        item.max_words
      ) === 'within'
        ? 'done'
        : 'partial'
    }
  }
}

// ---- Matching: select one on each side, no drag and drop ---------------------------

export type Pair = [string, string]

// Pairs `clip` with `place`. A clip has one place and a place one clip: pairing
// over an existing link releases the other end.
export const pairUp = (pairs: readonly Pair[], clip: string, place: string): Pair[] => [
  ...pairs.filter(([c, p]) => c !== clip && p !== place),
  [clip, place],
]

export const unpair = (pairs: readonly Pair[], clip: string): Pair[] =>
  pairs.filter(([c]) => c !== clip)

export const placeOf = (pairs: readonly Pair[], clip: string): string | null =>
  pairs.find(([c]) => c === clip)?.[1] ?? null

export const clipAt = (pairs: readonly Pair[], place: string): string | null =>
  pairs.find(([, p]) => p === place)?.[0] ?? null

// ---- Numbering and the review list --------------------------------------------------

export interface NumberedItem {
  number: number
  sectionKey: string
  sectionIndex: number
  item: AssessmentItem
}

// Items numbered 1..n across the loaded sections, in the order shown. A matching
// task is one number (it scores as five items but is answered as one task).
export const numberItems = (sections: readonly (SectionPayload | null)[]): NumberedItem[] => {
  const out: NumberedItem[] = []
  sections.forEach((section, sectionIndex) => {
    if (!section) return
    for (const part of section.parts)
      for (const item of part.items)
        out.push({ number: out.length + 1, sectionKey: section.key, sectionIndex, item })
  })
  return out
}

export const unanswered = (
  numbered: readonly NumberedItem[],
  answers: Readonly<Record<string, ItemResponse>>
): NumberedItem[] => numbered.filter((n) => itemStatus(n.item, answers[n.item.item_id]) !== 'done')
