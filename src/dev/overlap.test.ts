import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { findCollisions, type Item } from './overlap.ts'

const item = (
  label: string,
  box: [number, number, number, number],
  path: number[],
  layer = ''
): Item => ({
  label,
  box: { left: box[0], top: box[1], right: box[2], bottom: box[3] },
  layer,
  path,
})

describe('findCollisions', () => {
  it('reports two interactive boxes that intersect', () => {
    const result = findCollisions([
      item('zoom', [300, 500, 344, 544], [0, 1]),
      item('lang', [320, 520, 364, 564], [0, 2]),
    ])
    assert.deepEqual(result, [{ a: 'zoom', b: 'lang', width: 24, height: 24 }])
  })

  it('ignores boxes that only touch or share a 1px border', () => {
    assert.deepEqual(
      findCollisions([
        item('a', [0, 0, 44, 44], [0, 1]),
        item('b', [44, 0, 88, 44], [0, 2]),
        item('c', [87, 0, 131, 44], [0, 3]),
      ]),
      []
    )
  })

  it('ignores a control inside its own container', () => {
    assert.deepEqual(
      findCollisions([
        item('panel', [0, 0, 300, 300], [0, 1]),
        item('close', [250, 10, 290, 50], [0, 1, 4]),
      ]),
      []
    )
  })

  it('does not compare different layers (a dialog covers the page on purpose)', () => {
    assert.deepEqual(
      findCollisions([
        item('hud', [0, 0, 44, 44], [0, 1], 'page'),
        item('ok', [10, 10, 60, 60], [0, 2], 'dialog'),
      ]),
      []
    )
  })
})
