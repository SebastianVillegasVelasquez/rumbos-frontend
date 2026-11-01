import {
  duplicatedTargets,
  tally,
  toMapping,
  type Mapping,
  type Match,
  type Tally,
} from './matching.ts'

// The review screen's state: what each archive row will be placed on, which
// rows the editor has looked at, and which row the backend refused. Pure, so the
// rules (a shared target blocks applying, a refused target disappears) are tested
// without a browser.

export interface ReviewState {
  matches: Match[]
  mapping: Mapping
  // Rows the editor changed, confirmed or accepted in bulk.
  reviewed: ReadonlySet<string>
  // Activities the backend said already sit on another level.
  refused: ReadonlySet<number>
  // The row to point at after a refusal.
  highlightKey: string | null
}

export type ReviewAction =
  | { type: 'choose'; key: string; cmid: number | null }
  | { type: 'confirm'; key: string }
  | { type: 'acceptExact' }
  | { type: 'refused'; cmid: number }

export const initReview = (matches: Match[]): ReviewState => ({
  matches,
  mapping: toMapping(matches),
  reviewed: new Set(),
  refused: new Set(),
  highlightKey: null,
})

export const reviewReducer = (state: ReviewState, action: ReviewAction): ReviewState => {
  switch (action.type) {
    case 'choose': {
      if (action.cmid !== null && state.refused.has(action.cmid)) return state
      return {
        ...state,
        mapping: { ...state.mapping, [action.key]: action.cmid },
        reviewed: new Set(state.reviewed).add(action.key),
        highlightKey: state.highlightKey === action.key ? null : state.highlightKey,
      }
    }
    case 'confirm':
      return { ...state, reviewed: new Set(state.reviewed).add(action.key) }
    case 'acceptExact': {
      const mapping = { ...state.mapping }
      const reviewed = new Set(state.reviewed)
      for (const match of state.matches) {
        if (match.confidence !== 'exact' || match.cmid === null) continue
        if (state.refused.has(match.cmid)) continue
        mapping[match.key] = match.cmid
        reviewed.add(match.key)
      }
      return { ...state, mapping, reviewed }
    }
    case 'refused': {
      const refused = new Set(state.refused).add(action.cmid)
      const mapping = { ...state.mapping }
      let highlightKey: string | null = null
      for (const [key, cmid] of Object.entries(mapping)) {
        if (cmid !== action.cmid) continue
        mapping[key] = null
        highlightKey ??= key
      }
      return { ...state, refused, mapping, highlightKey }
    }
  }
}

export interface ReviewSummary extends Tally {
  duplicated: ReadonlySet<number>
  canApply: boolean
}

export const summarize = (state: ReviewState, rightsOk: boolean): ReviewSummary => {
  const duplicated = duplicatedTargets(state.mapping)
  return {
    ...tally(state.mapping, state.matches, state.reviewed),
    duplicated,
    canApply: duplicated.size === 0 && rightsOk,
  }
}

// A row the editor should still look at: a guess nobody confirmed, or one that
// collides with another row.
export const isDoubtful = (state: ReviewState, key: string, duplicated: ReadonlySet<number>) => {
  const cmid = state.mapping[key]
  if (cmid !== null && cmid !== undefined && duplicated.has(cmid)) return true
  if (state.highlightKey === key) return true
  const match = state.matches.find((item) => item.key === key)
  if (cmid === null || cmid === undefined) return match?.confidence === 'similar'
  if (state.reviewed.has(key)) return false
  return match?.confidence !== 'exact' || match.cmid !== cmid
}
