import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { AppearanceUpdate, MapWelcome } from '../course-map/data/types.ts'
import { convertLegacyToSteps } from './flow/flowSteps.ts'
import { addStep, createStep } from './editor/flowEdit.ts'
import { legacyFieldProblems, serializeAppearance, serializeWelcome } from './welcomeWire.ts'

const editorLabels = { welcome: 'B', video: 'V', html: 'T', pdf: 'D', quiz: 'Q' }
const labels = { welcomeTitle: 'Bienvenida', videoTitle: 'Video' }
// The welcome the production map had.
const legacy: MapWelcome = {
  enabled: true,
  title: 'Hola {curso}',
  message: 'Un mensaje',
  video: { provider: 'youtube', videoId: 'dQw4w9WgXcQ' },
  playOnEnter: true,
  show: 'first_visit',
}
const body = (welcome: MapWelcome): AppearanceUpdate =>
  ({ settings: { welcome }, defaultSkinId: null, skinRules: [] }) as unknown as AppearanceUpdate
const wire = (welcome: MapWelcome) => JSON.parse(JSON.stringify(serializeAppearance(body(welcome))))
const LEGACY = ['title', 'message', 'video', 'playOnEnter']

describe('serializing a welcome', () => {
  it('sends the four legacy fields as explicit null after converting', () => {
    const sent = wire(convertLegacyToSteps(legacy, labels)).settings.welcome
    for (const field of LEGACY) assert.equal(sent[field], null, field)
    assert.equal(sent.steps.length, 2)
  })

  it('does so even when the state still carries them after editing steps', () => {
    const converted = convertLegacyToSteps(legacy, labels)
    // An edit that spreads a state which regained legacy values.
    const edited = {
      ...converted,
      ...legacy,
      steps: addStep(
        converted.steps ?? [],
        createStep('html', converted.steps ?? [], editorLabels)
      ),
    } as MapWelcome
    const sent = wire(edited).settings.welcome
    for (const field of LEGACY) assert.equal(sent[field], null, field)
    assert.deepEqual(legacyFieldProblems(sent), [])
  })

  it('keeps the keys in the JSON (null, never omitted)', () => {
    const json = JSON.stringify(serializeWelcome(convertLegacyToSteps(legacy, labels)))
    for (const field of LEGACY) assert.match(json, new RegExp(`"${field}":null`))
  })

  it('leaves a legacy welcome without steps untouched', () => {
    assert.deepEqual(serializeWelcome(legacy), legacy)
    assert.deepEqual(serializeWelcome({ ...legacy, steps: [] }), { ...legacy, steps: [] })
    assert.deepEqual(serializeWelcome({ ...legacy, steps: null }), { ...legacy, steps: null })
    assert.equal(
      serializeAppearance({ ...body(legacy), settings: {} as never }).settings.welcome,
      undefined
    )
  })
})

describe('the server rule between the legacy fields and steps', () => {
  const withSteps = convertLegacyToSteps(legacy, labels)
  it('flags the payload that failed in production, at welcome.playOnEnter', () => {
    const problems = legacyFieldProblems({ ...withSteps, playOnEnter: true })
    assert.deepEqual(
      problems.map((p) => [p.path, p.code]),
      [['welcome.playOnEnter', 'legacy_fields_with_steps']]
    )
  })
  it('treats an absent playOnEnter as its default (true), not as empty', () => {
    const rest: Partial<MapWelcome> = { ...withSteps }
    delete rest.playOnEnter
    assert.equal(legacyFieldProblems(rest).length, 1)
  })
  it('accepts null and ignores welcomes without steps', () => {
    assert.deepEqual(legacyFieldProblems(serializeWelcome(withSteps)), [])
    assert.deepEqual(legacyFieldProblems(legacy), [])
  })
})
