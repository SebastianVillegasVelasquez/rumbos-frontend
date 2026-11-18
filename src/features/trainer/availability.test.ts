import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  catalogReason,
  entryMode,
  entryReason,
  entryState,
  noteIsPersistent,
  stageScreen,
} from './availability.ts'
import type { Catalog } from './types.ts'

const lesson = {
  id: '1.1',
  code: '1.1',
  title: 'Greetings',
  description: '',
  vocabulary_count: 0,
  activities: [],
}
const ok: Catalog = {
  enabled: true,
  modules: [{ key: 'M1', title: 'Módulo', lessons: [lesson] }],
}
// Enabled, with modules that hold no lesson yet (the third answer a catalog can give).
const hollow: Catalog = { enabled: true, modules: [{ key: 'M1', title: 'Módulo', lessons: [] }] }
const base = { welcomePending: false, isEditor: false }

describe('entryState', () => {
  it('is loading, busy and not pressable while the catalog is pending', () => {
    assert.deepEqual(entryState({ ...base, status: 'pending' }), {
      kind: 'disabled',
      reason: 'loading',
      busy: true,
    })
  })

  it('is ready for a usable catalog', () => {
    assert.deepEqual(entryState({ ...base, status: 'success', catalog: ok }), { kind: 'ready' })
  })

  it('hides for students and explains to editors when disabled for the map', () => {
    const catalog: Catalog = { enabled: false, reason: 'disabled_for_map' }
    assert.deepEqual(entryState({ ...base, status: 'success', catalog }), { kind: 'hidden' })
    assert.deepEqual(entryState({ ...base, isEditor: true, status: 'success', catalog }), {
      kind: 'disabled',
      reason: 'disabled_for_map',
      busy: false,
    })
  })

  it('treats enabled:false without a reason as disabled for the map', () => {
    const catalog: Catalog = { enabled: false }
    assert.equal(catalogReason(catalog), 'disabled_for_map')
    assert.deepEqual(entryState({ ...base, status: 'success', catalog }), { kind: 'hidden' })
  })

  it('is disabled with the reason when there is no published content', () => {
    const catalog: Catalog = { enabled: false, reason: 'no_published_content' }
    assert.deepEqual(entryState({ ...base, status: 'success', catalog }), {
      kind: 'disabled',
      reason: 'no_content',
      busy: false,
    })
  })

  it('waits for the welcome flow, but never blocks an editor', () => {
    const waiting = { ...base, welcomePending: true }
    assert.deepEqual(entryState({ ...waiting, status: 'success', catalog: ok }), {
      kind: 'disabled',
      reason: 'waiting_welcome',
      busy: false,
    })
    assert.deepEqual(entryState({ ...waiting, status: 'pending' }), {
      kind: 'disabled',
      reason: 'waiting_welcome',
      busy: false,
    })
    assert.deepEqual(entryState({ ...waiting, isEditor: true, status: 'success', catalog: ok }), {
      kind: 'ready',
    })
  })

  it('a map without a trainer stays hidden even during the welcome flow', () => {
    const catalog: Catalog = { enabled: false, reason: 'disabled_for_map' }
    assert.deepEqual(entryState({ ...base, welcomePending: true, status: 'success', catalog }), {
      kind: 'hidden',
    })
  })

  it('a network or server error is an error state that can be retried', () => {
    for (const failure of ['unreachable', 'other'] as const)
      assert.deepEqual(entryState({ ...base, status: 'error', failure }), {
        kind: 'error',
        reason: 'load_error',
      })
  })

  it('an expired session and a closed trainer have their own states', () => {
    assert.deepEqual(entryState({ ...base, status: 'error', failure: 'unauthorized' }), {
      kind: 'error',
      reason: 'unauthorized',
    })
    assert.deepEqual(entryState({ ...base, status: 'error', failure: 'closed' }), {
      kind: 'hidden',
    })
  })
})

describe('entryMode and entryReason', () => {
  it('map every visible state to the HUD vocabulary', () => {
    const loading = entryState({ ...base, status: 'pending' })
    assert.equal(entryMode(loading as Exclude<typeof loading, { kind: 'hidden' }>), 'loading')
    assert.equal(entryReason(loading), 'loading')
    const ready = entryState({ ...base, status: 'success', catalog: ok })
    assert.equal(entryMode(ready as Exclude<typeof ready, { kind: 'hidden' }>), 'ready')
    assert.equal(entryReason(ready), null)
    const failed = entryState({ ...base, status: 'error', failure: 'unreachable' })
    assert.equal(entryMode(failed as Exclude<typeof failed, { kind: 'hidden' }>), 'error')
    assert.equal(entryReason(failed), 'load_error')
    const empty = entryState({
      ...base,
      status: 'success',
      catalog: { enabled: false, reason: 'no_published_content' },
    })
    assert.equal(entryMode(empty as Exclude<typeof empty, { kind: 'hidden' }>), 'disabled')
  })
})

describe('noteIsPersistent', () => {
  it('only editors keep a reason on screen, and loading is not a reason', () => {
    const no = entryState({
      ...base,
      isEditor: true,
      status: 'success',
      catalog: { enabled: false, reason: 'no_published_content' },
    })
    assert.equal(noteIsPersistent(no, true), true)
    assert.equal(noteIsPersistent(no, false), false)
    const loading = entryState({ ...base, isEditor: true, status: 'pending' })
    assert.equal(noteIsPersistent(loading, true), false)
  })
})

describe('stageScreen', () => {
  it('keeps the generic message and the retry to the error screen', () => {
    assert.deepEqual(stageScreen({ status: 'error', failure: 'unreachable' }), {
      kind: 'error',
      reason: 'load_error',
      retry: true,
    })
    assert.deepEqual(stageScreen({ status: 'error', failure: 'unauthorized' }), {
      kind: 'error',
      reason: 'unauthorized',
      retry: false,
    })
  })

  it('names why a successful catalog has nothing to offer', () => {
    const none: Catalog = { enabled: false, reason: 'no_published_content' }
    assert.deepEqual(stageScreen({ status: 'success', catalog: none }), {
      kind: 'unavailable',
      reason: 'no_content',
    })
    assert.deepEqual(stageScreen({ status: 'success', catalog: { enabled: false } }), {
      kind: 'unavailable',
      reason: 'disabled_for_map',
    })
    assert.deepEqual(stageScreen({ status: 'success', catalog: ok }), { kind: 'content' })
    assert.deepEqual(stageScreen({ status: 'pending' }), { kind: 'loading' })
  })
})

describe('an enabled catalog with no lessons', () => {
  const base = { welcomePending: false, isEditor: false }

  it('is no content for the entry button, as for the stage', () => {
    assert.equal(catalogReason(hollow), 'no_content')
    assert.deepEqual(entryState({ ...base, status: 'success', catalog: hollow }), {
      kind: 'disabled',
      reason: 'no_content',
      busy: false,
    })
    assert.deepEqual(stageScreen({ status: 'success', catalog: hollow }), {
      kind: 'unavailable',
      reason: 'no_content',
    })
  })

  it('reads no modules when disabled', () => {
    // Disabled: the verdict comes from `enabled` and `reason`, whatever else is there.
    const off = { enabled: false, reason: 'disabled_for_map', modules: null } as unknown as Catalog
    assert.equal(catalogReason(off), 'disabled_for_map')
  })
})
