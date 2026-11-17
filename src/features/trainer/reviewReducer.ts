import type { SavedWord } from './types.ts'

// "Repasar palabras": flashcards from the saved words that are due. See the word,
// reveal the translation, say whether you knew it. Pure; the hook posts each answer.

export type ReviewPhase = 'card' | 'sending' | 'error' | 'done'

export interface ReviewState {
  phase: ReviewPhase
  cards: SavedWord[]
  index: number
  revealed: boolean
  // The answer being sent, kept so a retry repeats the same attempt.
  pending: { wordId: string; attemptId: string; knew: boolean } | null
  knew: number
}

export const startReview = (cards: SavedWord[]): ReviewState => ({
  phase: cards.length === 0 ? 'done' : 'card',
  cards,
  index: 0,
  revealed: false,
  pending: null,
  knew: 0,
})

export type ReviewEvent =
  | { type: 'reveal' }
  | { type: 'answer'; knew: boolean; attemptId: string }
  | { type: 'saved' }
  | { type: 'failed' }
  | { type: 'retry' }

export const reviewReducer = (state: ReviewState, event: ReviewEvent): ReviewState => {
  switch (event.type) {
    case 'reveal':
      return state.phase === 'card' ? { ...state, revealed: true } : state
    case 'answer': {
      // Only after the translation is shown, and never twice for one card.
      if (state.phase !== 'card' || !state.revealed) return state
      const card = state.cards[state.index]
      return {
        ...state,
        phase: 'sending',
        pending: { wordId: card.word_id, attemptId: event.attemptId, knew: event.knew },
      }
    }
    case 'saved': {
      if (state.phase !== 'sending' || !state.pending) return state
      const index = state.index + 1
      const knew = state.knew + (state.pending.knew ? 1 : 0)
      return index >= state.cards.length
        ? { ...state, phase: 'done', index, knew, pending: null, revealed: false }
        : { ...state, phase: 'card', index, knew, pending: null, revealed: false }
    }
    case 'failed':
      return state.phase === 'sending' ? { ...state, phase: 'error' } : state
    case 'retry':
      return state.phase === 'error' && state.pending ? { ...state, phase: 'sending' } : state
  }
}
