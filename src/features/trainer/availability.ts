import type { Catalog } from './types.ts'
import type { FailureKind } from './sessionReducer.ts'

// What the "Entrenar" button and the stage say, decided from the catalog and the
// welcome flow in one place so the button never offers a click that leads nowhere.
// Pure: the caller passes what it knows.

export type TrainerReason =
  'loading' | 'waiting_welcome' | 'no_content' | 'disabled_for_map' | 'load_error' | 'unauthorized'

export type TrainerEntryState =
  // Not offered at all (students: the map has no trainer for them).
  | { kind: 'hidden' }
  // Pressing it opens the stage.
  | { kind: 'ready' }
  // Shown but not pressable; the reason is written, never only implied.
  | { kind: 'disabled'; reason: TrainerReason; busy: boolean }
  // Pressing it opens the stage, which says what failed and offers a retry.
  | { kind: 'error'; reason: 'load_error' | 'unauthorized' }

export interface AvailabilityInput {
  status: 'pending' | 'error' | 'success'
  catalog?: Catalog
  failure?: FailureKind
  welcomePending: boolean
  isEditor: boolean
}

// The reason a successful but unusable catalog carries. A backend that predates
// `reason` sends `enabled: false` alone: that is a map without a trainer.
export const catalogReason = (catalog: Catalog): 'no_content' | 'disabled_for_map' | null => {
  if (catalog.enabled) return null
  return catalog.reason === 'no_published_content' ? 'no_content' : 'disabled_for_map'
}

const disabled = (reason: TrainerReason, busy = false): TrainerEntryState => ({
  kind: 'disabled',
  reason,
  busy,
})

export const entryState = (input: AvailabilityInput): TrainerEntryState => {
  const { status, catalog, failure, welcomePending, isEditor } = input
  const waiting = welcomePending && !isEditor
  if (status === 'success' && catalog) {
    const reason = catalogReason(catalog)
    // A map without a trainer: students never see a button; an editor sees why.
    if (reason === 'disabled_for_map') return isEditor ? disabled(reason) : { kind: 'hidden' }
    if (waiting) return disabled('waiting_welcome')
    if (reason) return disabled(reason)
    return { kind: 'ready' }
  }
  if (status === 'error') {
    // 404, 403 and 409: the server says there is no trainer here.
    if (failure === 'closed') return isEditor ? disabled('disabled_for_map') : { kind: 'hidden' }
    if (failure === 'unauthorized') return { kind: 'error', reason: 'unauthorized' }
    return { kind: 'error', reason: 'load_error' }
  }
  if (waiting) return disabled('waiting_welcome')
  return disabled('loading', true)
}

// The HUD's three-way vocabulary for a visible state.
export const entryMode = (
  state: Exclude<TrainerEntryState, { kind: 'hidden' }>
): 'ready' | 'loading' | 'disabled' | 'error' => {
  if (state.kind === 'disabled') return state.busy ? 'loading' : 'disabled'
  return state.kind
}

export const entryReason = (state: TrainerEntryState): TrainerReason | null =>
  state.kind === 'disabled' || state.kind === 'error' ? state.reason : null

// Whether the note under the button stays on screen (editors) or shows only when the
// button is pressed (students).
export const noteIsPersistent = (state: TrainerEntryState, isEditor: boolean): boolean =>
  isEditor && state.kind === 'disabled' && state.reason !== 'loading'

export type StageScreen =
  | { kind: 'loading' }
  | { kind: 'error'; reason: 'load_error' | 'unauthorized'; retry: boolean }
  | { kind: 'unavailable'; reason: 'no_content' | 'disabled_for_map' }
  | { kind: 'content' }

// The stage, from the same inputs. The generic message and the retry belong to the
// error screen only.
export const stageScreen = (
  input: Pick<AvailabilityInput, 'status' | 'catalog' | 'failure'>
): StageScreen => {
  if (input.status === 'pending') return { kind: 'loading' }
  if (input.status === 'error') {
    if (input.failure === 'closed') return { kind: 'unavailable', reason: 'disabled_for_map' }
    if (input.failure === 'unauthorized')
      return { kind: 'error', reason: 'unauthorized', retry: false }
    return { kind: 'error', reason: 'load_error', retry: true }
  }
  const reason = input.catalog ? catalogReason(input.catalog) : null
  return reason ? { kind: 'unavailable', reason } : { kind: 'content' }
}
