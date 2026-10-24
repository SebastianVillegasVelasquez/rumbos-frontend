import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  MAX_ASSERTION_LENGTH,
  parseCourseState,
  parseHostMessage,
  toWireErrorCode,
  toWireMessage,
} from './protocol.ts'

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

describe('courseCompletionEnabled (contract v5.4)', () => {
  it('keeps a boolean and leaves it undefined (unknown) otherwise', () => {
    assert.equal(parseCourseState(state)?.courseCompletionEnabled, undefined)
    assert.equal(
      parseCourseState({ ...state, courseCompletionEnabled: true })?.courseCompletionEnabled,
      true
    )
    assert.equal(
      parseCourseState({ ...state, courseCompletionEnabled: false })?.courseCompletionEnabled,
      false
    )
    // Garbage is unknown, not a reason to drop the state and not "false".
    const odd = parseCourseState({ ...state, courseCompletionEnabled: 'no' })
    assert.ok(odd)
    assert.equal(odd.courseCompletionEnabled, undefined)
  })

  it('sends open-activity-settings with the cmid only', () => {
    assert.deepEqual(toWireMessage({ type: 'rumbos:open-activity-settings', v: 1, cmid: 11 }), {
      type: 'rumbos:open-activity-settings',
      v: 1,
      cmid: 11,
    })
  })
})

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

describe('toWireErrorCode', () => {
  const table: Array<[string, string]> = [
    ['launch_invalid', 'launch_failed'],
    ['handshake_timeout', 'launch_failed'],
    ['tenant_disabled', 'launch_failed'],
    ['origin_mismatch', 'launch_failed'],
    ['course_mismatch', 'launch_failed'],
    ['backend_unreachable', 'launch_failed'],
    ['not_embedded', 'launch_failed'],
    ['invalid_host', 'launch_failed'],
    ['session_expired', 'token_refresh_failed'],
    ['launch_failed', 'launch_failed'],
    ['token_refresh_failed', 'token_refresh_failed'],
    ['app_crashed', 'app_crashed'],
    ['protocol_unsupported', 'protocol_unsupported'],
    ['something_new', 'launch_failed'],
    ['', 'launch_failed'],
  ]
  for (const [internal, wire] of table) {
    it(`maps ${internal || '(empty)'} to ${wire}`, () => {
      assert.equal(toWireErrorCode(internal), wire)
    })
  }
})

describe('toWireMessage', () => {
  it('maps the code of an error and leaves other messages alone', () => {
    assert.deepEqual(toWireMessage({ type: 'rumbos:error', v: 1, code: 'launch_invalid' }), {
      type: 'rumbos:error',
      v: 1,
      code: 'launch_failed',
    })
    const ready = { type: 'rumbos:embed-ready', v: 1 } as const
    assert.equal(toWireMessage(ready), ready)
  })

  it('keeps the detail as plain text of at most 200 characters', () => {
    const wire = toWireMessage({
      type: 'rumbos:error',
      v: 1,
      code: 'app_crashed',
      detail: 'x'.repeat(500) + '\u0000',
    }) as { detail: string }
    assert.equal(wire.detail.length, 200)
  })

  it('omits an empty detail', () => {
    const wire = toWireMessage({ type: 'rumbos:error', v: 1, code: 'app_crashed', detail: '' })
    assert.equal('detail' in (wire as object), false)
  })
})

describe('host-fullscreen', () => {
  it('accepts a boolean on', () => {
    assert.deepEqual(parseHostMessage({ type: 'rumbos:host-fullscreen', v: 1, on: true }), {
      type: 'rumbos:host-fullscreen',
      v: 1,
      on: true,
    })
    assert.equal(
      parseHostMessage({ type: 'rumbos:host-fullscreen', v: 1, on: false })?.type,
      'rumbos:host-fullscreen'
    )
  })

  it('rejects a missing, non-boolean or unversioned on', () => {
    assert.equal(parseHostMessage({ type: 'rumbos:host-fullscreen', v: 1 }), null)
    assert.equal(parseHostMessage({ type: 'rumbos:host-fullscreen', v: 1, on: 'true' }), null)
    assert.equal(parseHostMessage({ type: 'rumbos:host-fullscreen', v: 1, on: 1 }), null)
    assert.equal(parseHostMessage({ type: 'rumbos:host-fullscreen', on: true }), null)
  })
})

describe('courseName (contract v5.6)', () => {
  const nameOf = (courseName: unknown) => {
    const parsed = parseHostMessage({ ...init, courseName })
    return parsed?.type === 'rumbos:host-init' ? parsed.courseName : 'rejected'
  }

  it('keeps plain text and is null when absent or not a string', () => {
    assert.equal(nameOf('Ecología'), 'Ecología')
    assert.equal(nameOf(undefined), null)
    assert.equal(nameOf(42), null)
    assert.equal(nameOf('   '), null)
  })

  it('caps the length and drops control characters, leaving markup as inert text', () => {
    assert.equal(nameOf('x'.repeat(500))?.length, 200)
    assert.equal(nameOf('A B'), 'AB')
    assert.equal(nameOf('<b>Curso</b>'), '<b>Curso</b>')
  })

  it('does not reject host-init from a host that predates it', () => {
    assert.equal(parseHostMessage(init)?.type, 'rumbos:host-init')
  })
})
