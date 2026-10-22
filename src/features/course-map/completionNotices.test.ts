import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { canConfigureCompletion, completionNotices } from './completionNotices.ts'

const base = {
  isEditor: true,
  embedded: true,
  completionEnabled: true as boolean | null,
  mode: 'explorative' as const,
  untrackedCount: 0,
}

describe('completionNotices', () => {
  it('warns the editor when completion is off for the course', () => {
    assert.equal(completionNotices({ ...base, completionEnabled: false }).courseDisabled, true)
  })

  it('says nothing when it is on, or when the host does not say (unknown)', () => {
    assert.equal(completionNotices(base).courseDisabled, false)
    assert.equal(completionNotices({ ...base, completionEnabled: null }).courseDisabled, false)
  })

  it('never alarms students', () => {
    const notices = completionNotices({
      ...base,
      isEditor: false,
      completionEnabled: false,
      mode: 'guided',
      untrackedCount: 3,
    })
    assert.deepEqual(notices, { courseDisabled: false, guidedWithUntracked: false })
  })

  it('warns about guided mode only with untracked activities', () => {
    assert.equal(
      completionNotices({ ...base, mode: 'guided', untrackedCount: 1 }).guidedWithUntracked,
      true
    )
    assert.equal(
      completionNotices({ ...base, mode: 'guided', untrackedCount: 0 }).guidedWithUntracked,
      false
    )
    assert.equal(
      completionNotices({ ...base, mode: 'explorative', untrackedCount: 4 }).guidedWithUntracked,
      false
    )
  })

  it('does not tell the standalone app the course flag is off', () => {
    assert.equal(
      completionNotices({ ...base, embedded: false, completionEnabled: false }).courseDisabled,
      false
    )
  })
})

describe('canConfigureCompletion', () => {
  it('needs an embedded editor on a host that speaks v5.4', () => {
    assert.equal(
      canConfigureCompletion({ embedded: true, editorMode: true, hostSpeaksV54: true }),
      true
    )
    assert.equal(
      canConfigureCompletion({ embedded: true, editorMode: true, hostSpeaksV54: false }),
      false
    )
    assert.equal(
      canConfigureCompletion({ embedded: true, editorMode: false, hostSpeaksV54: true }),
      false
    )
    assert.equal(
      canConfigureCompletion({ embedded: false, editorMode: true, hostSpeaksV54: true }),
      false
    )
  })
})
