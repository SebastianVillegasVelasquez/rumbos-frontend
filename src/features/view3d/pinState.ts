import type { PinState } from './protocol.ts'

const OPENABLE: ReadonlySet<PinState> = new Set(['available', 'next', 'complete'])

// Locked, teaser and missing pins explain themselves instead of opening.
export const isPinOpenable = (state: PinState) => OPENABLE.has(state)
