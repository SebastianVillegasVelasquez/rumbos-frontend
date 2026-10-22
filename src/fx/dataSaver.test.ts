import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createDataSaverStore, isSlowConnection, type ConnectionLike } from './dataSaver.ts'

const fakeConnection = (initial: Partial<ConnectionLike> = {}) => {
  const listeners = new Set<() => void>()
  const connection: ConnectionLike = {
    ...initial,
    addEventListener: (_type, listener) => void listeners.add(listener),
    removeEventListener: (_type, listener) => void listeners.delete(listener),
  }
  return { connection, fire: () => listeners.forEach((listener) => listener()) }
}

const storeWith = (connection: ConnectionLike | null, stored: string | null = null) => {
  const writes: string[] = []
  const store = createDataSaverStore({
    connection,
    readStored: () => stored,
    writeStored: (value) => void writes.push(value),
  })
  return { store, writes }
}

describe('isSlowConnection', () => {
  it('is true for Save-Data and for slow effective types', () => {
    assert.equal(isSlowConnection({ saveData: true }), true)
    assert.equal(isSlowConnection({ effectiveType: 'slow-2g' }), true)
    assert.equal(isSlowConnection({ effectiveType: '2g' }), true)
  })

  it('is false for 3g and better, and for an unknown connection', () => {
    assert.equal(isSlowConnection({ effectiveType: '3g' }), false)
    assert.equal(isSlowConnection({ effectiveType: '4g', saveData: false }), false)
    assert.equal(isSlowConnection(undefined), false)
    assert.equal(isSlowConnection(null), false)
    assert.equal(isSlowConnection({}), false)
  })
})

describe('data saver store', () => {
  it('turns on by itself on a slow connection and off on a fast one', () => {
    assert.equal(storeWith({ effectiveType: '2g' }).store.isActive(), true)
    assert.equal(storeWith({ effectiveType: '4g' }).store.isActive(), false)
  })

  it('a manual choice wins over detection, both ways', () => {
    const slow = storeWith({ saveData: true }, 'off')
    assert.equal(slow.store.isActive(), false)
    assert.equal(slow.store.isDetected(), true)
    const fast = storeWith({ effectiveType: '4g' }, 'on')
    assert.equal(fast.store.isActive(), true)
  })

  it('persists a change and ignores garbage in storage', () => {
    const { store, writes } = storeWith(null, 'banana')
    assert.equal(store.getSetting(), 'auto')
    store.setSetting('on')
    store.setSetting('on')
    assert.deepEqual(writes, ['on'])
    assert.equal(store.isActive(), true)
  })

  it('follows the connection while the app is open', () => {
    const { connection, fire } = fakeConnection({ effectiveType: '4g' })
    const { store } = storeWith(connection)
    let notified = 0
    store.subscribe(() => void notified++)
    assert.equal(store.isActive(), false)
    connection.effectiveType = '2g'
    fire()
    assert.equal(store.isActive(), true)
    assert.equal(notified, 1)
    fire()
    assert.equal(notified, 1, 'no change, no notification')
  })

  it('notifies subscribers of a manual change and lets them leave', () => {
    const { store } = storeWith(null)
    let notified = 0
    const stop = store.subscribe(() => void notified++)
    store.setSetting('on')
    stop()
    store.setSetting('off')
    assert.equal(notified, 1)
  })
})
