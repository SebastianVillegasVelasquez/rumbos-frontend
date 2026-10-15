import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  asView3dErrorCode,
  autoAssign,
  boundCount,
  clearBindings,
  formFromView3d,
  isDirty,
  overflowCount,
  setZoneBubble,
  setZoneText,
  toView3d,
} from './view3dForm.ts'
import type { View3d } from '../../course-map/data/types.ts'

const saved: View3d = {
  scene: 'region-encuentros',
  bindings: [
    { zoneId: 4, bubbleId: 'b', title: null, description: { es: 'Hola' } },
    { zoneId: 1, bubbleId: 'a', title: { es: 'Uno', en: 'One' }, description: null },
  ],
}

describe('formFromView3d / toView3d', () => {
  it('round-trips and sorts bindings by zone', () => {
    const form = formFromView3d(saved, 'x')
    assert.equal(form.enabled, true)
    assert.deepEqual(
      toView3d(form)?.bindings.map((b) => b.zoneId),
      [1, 4]
    )
    assert.equal(isDirty(form, saved), false)
  })

  it('is disabled (null) when there is no view, keeping the default scene', () => {
    const form = formFromView3d(null, 'region-encuentros')
    assert.equal(form.enabled, false)
    assert.equal(form.scene, 'region-encuentros')
    assert.equal(toView3d(form), null)
    assert.equal(isDirty(form, null), false)
  })

  it('omits blank texts, trims, and caps lengths', () => {
    let form = formFromView3d({ scene: 's', bindings: [] }, 's')
    form = setZoneBubble(form, 0, 'a')
    form = setZoneText(form, 0, 'title', 'es', '  ' + 'x'.repeat(200) + '  ')
    form = setZoneText(form, 0, 'description', 'en', '   ')
    const [binding] = toView3d(form)!.bindings
    assert.equal(binding.title?.es?.length, 120)
    assert.equal(binding.title?.en, undefined)
    assert.equal(binding.description, null)
  })

  it('does not report blank-only edits as changes', () => {
    let form = formFromView3d(saved, 'x')
    form = setZoneText(form, 1, 'description', 'es', '   ')
    assert.equal(isDirty(form, saved), false)
    form = setZoneText(form, 1, 'description', 'es', 'Nuevo')
    assert.equal(isDirty(form, saved), true)
  })

  it('treats enabling or disabling as a change', () => {
    const form = formFromView3d(saved, 'x')
    assert.equal(isDirty({ ...form, enabled: false }, saved), true)
    assert.equal(isDirty({ ...formFromView3d(null, 's'), enabled: true }, null), true)
  })
})

describe('autoAssign / clearBindings / setZoneBubble', () => {
  it('assigns bubbles in sequence order to zones 0..n-1 and ignores the overflow', () => {
    const form = autoAssign(formFromView3d(null, 's'), ['a', 'b', 'c', 'd'], 3)
    assert.deepEqual(
      toView3d({ ...form, enabled: true })!.bindings.map((b) => [b.zoneId, b.bubbleId]),
      [
        [0, 'a'],
        [1, 'b'],
        [2, 'c'],
      ]
    )
  })

  it('keeps the texts of a bubble even when its zone changes', () => {
    let form = setZoneBubble(formFromView3d(null, 's'), 0, 'a')
    form = setZoneText(form, 0, 'title', 'es', 'Mi título')
    form = autoAssign(form, ['z', 'a'], 9)
    assert.equal(form.rows[1].title.es, 'Mi título')
    assert.equal(form.rows[0].title.es, '')
  })

  it('clears everything', () => {
    assert.equal(boundCount(clearBindings(formFromView3d(saved, 's'))), 0)
  })

  it('moves a bubble instead of binding it twice', () => {
    let form = formFromView3d(saved, 's')
    form = setZoneBubble(form, 7, 'a')
    assert.equal(form.rows[1], undefined)
    assert.equal(form.rows[7].bubbleId, 'a')
    assert.equal(boundCount(form), 2)
  })
})

describe('overflowCount / asView3dErrorCode', () => {
  it('counts the bubbles that will not appear', () => {
    assert.equal(overflowCount(12, 9), 3)
    assert.equal(overflowCount(4, 9), 0)
  })

  it('recognises the contract 422 codes only', () => {
    assert.equal(asView3dErrorCode('duplicate_zone'), 'duplicate_zone')
    assert.equal(asView3dErrorCode('scene_unknown'), 'scene_unknown')
    assert.equal(asView3dErrorCode('validation_error'), null)
    assert.equal(asView3dErrorCode(undefined), null)
  })
})
