import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { MAX_ASSERTION_LENGTH, parseCourseState, parseHostMessage } from './protocol.ts'

const activity = {
  cmid: 11,
  name: 'Quiz',
  modname: 'quiz',
  sectionId: 1,
  url: 'https://moodle.example/mod/quiz/view.php?id=11',
  availability: 'available',
  availabilityInfo: null,
  completion: 'none',
}

const state = {
  schemaVersion: 1,
  courseId: 7,
  generatedAt: '2026-01-01T00:00:00Z',
  sections: [{ id: 1, number: 1, name: 'Semana 1' }],
  activities: [activity],
  unavailableCmids: [12],
}

const init = {
  type: 'rumbos:host-init',
  v: 1,
  mode: 'student',
  locale: 'es',
  courseId: 7,
  assertion: 'a.b.c',
  state,
}

describe('parseCourseState', () => {
  it('accepts a well-formed state and drops the activity url', () => {
    const parsed = parseCourseState(state)
    assert.ok(parsed)
    assert.equal(parsed.activities.length, 1)
    assert.equal('url' in parsed.activities[0], false)
  })

  it('rejects the whole state when one entry is malformed', () => {
    assert.equal(
      parseCourseState({ ...state, activities: [activity, { ...activity, cmid: 'x' }] }),
      null
    )
    assert.equal(
      parseCourseState({ ...state, activities: [{ ...activity, availability: 'open' }] }),
      null
    )
    assert.equal(
      parseCourseState({ ...state, activities: [{ ...activity, completion: 'done' }] }),
      null
    )
    assert.equal(parseCourseState({ ...state, schemaVersion: 2 }), null)
    assert.equal(parseCourseState({ ...state, unavailableCmids: [1.5] }), null)
    assert.equal(parseCourseState(null), null)
  })

  it('keeps the first of duplicated cmids', () => {
    const parsed = parseCourseState({
      ...state,
      activities: [activity, { ...activity, name: 'Otro' }],
    })
    assert.equal(parsed?.activities.length, 1)
    assert.equal(parsed?.activities[0].name, 'Quiz')
  })

  it('strips control characters and caps text length', () => {
    const parsed = parseCourseState({
      ...state,
      activities: [
        { ...activity, name: `Qu\u0000iz${'x'.repeat(5000)}`, availabilityInfo: '<b>x</b>' },
      ],
    })
    assert.ok(parsed)
    assert.equal(parsed.activities[0].name.includes('\u0000'), false)
    assert.ok(parsed.activities[0].name.length <= 400)
    // Plain text: markup is kept as characters, never interpreted here.
    assert.equal(parsed.activities[0].availabilityInfo, '<b>x</b>')
  })

  it('rejects oversize lists', () => {
    const many = Array.from({ length: 3_001 }, (_, i) => ({ ...activity, cmid: i + 1 }))
    assert.equal(parseCourseState({ ...state, activities: many }), null)
  })
})

describe('parseHostMessage', () => {
  it('accepts the three host messages', () => {
    assert.equal(parseHostMessage(init)?.type, 'rumbos:host-init')
    assert.equal(
      parseHostMessage({ type: 'rumbos:host-state', v: 1, state })?.type,
      'rumbos:host-state'
    )
    assert.equal(
      parseHostMessage({ type: 'rumbos:host-launch', v: 1, assertion: 'x.y.z' })?.type,
      'rumbos:host-launch'
    )
  })

  it('ignores unknown, versionless and malformed messages', () => {
    assert.equal(parseHostMessage({ type: 'rumbos:nope', v: 1 }), null)
    assert.equal(parseHostMessage({ ...init, v: 2 }), null)
    assert.equal(parseHostMessage({ ...init, mode: 'admin' }), null)
    assert.equal(parseHostMessage({ ...init, assertion: '' }), null)
    assert.equal(
      parseHostMessage({ ...init, assertion: 'x'.repeat(MAX_ASSERTION_LENGTH + 1) }),
      null
    )
    assert.equal(parseHostMessage('rumbos:host-init'), null)
    assert.equal(parseHostMessage(null), null)
    assert.equal(parseHostMessage([init]), null)
  })

  it('rejects an init whose state is for another course', () => {
    assert.equal(parseHostMessage({ ...init, state: { ...state, courseId: 8 } }), null)
  })
})
