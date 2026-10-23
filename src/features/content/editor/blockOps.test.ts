import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { blankBlock, fromEditorBlocks, moveItem, toEditorBlocks } from './blockOps.ts'

describe('moveItem', () => {
  it('moves one place and never past the ends', () => {
    assert.deepEqual(moveItem(['a', 'b', 'c'], 1, -1), ['b', 'a', 'c'])
    assert.deepEqual(moveItem(['a', 'b', 'c'], 1, 1), ['a', 'c', 'b'])
    assert.deepEqual(moveItem(['a', 'b', 'c'], 0, -1), ['a', 'b', 'c'])
    assert.deepEqual(moveItem(['a', 'b', 'c'], 2, 1), ['a', 'b', 'c'])
    assert.deepEqual(moveItem(['a'], 5, 1), ['a'])
  })

  it('does not change the list it was given', () => {
    const list = ['a', 'b']
    moveItem(list, 0, 1)
    assert.deepEqual(list, ['a', 'b'])
  })
})

describe('editor blocks', () => {
  it('round-trips and keeps keys unique and stable under moves', () => {
    const items = toEditorBlocks([blankBlock('heading'), blankBlock('divider'), blankBlock('link')])
    assert.equal(new Set(items.map((item) => item.key)).size, 3)
    const moved = moveItem(items, 2, -1)
    assert.deepEqual(
      moved.map((item) => item.key),
      [items[0].key, items[2].key, items[1].key]
    )
    assert.deepEqual(
      fromEditorBlocks(moved).map((block) => block.type),
      ['heading', 'link', 'divider']
    )
  })

  it('starts links on https', () => {
    assert.deepEqual(blankBlock('link'), { type: 'link', text: '', url: 'https://' })
  })
})
