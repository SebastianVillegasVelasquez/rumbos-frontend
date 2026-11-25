import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { MapSettings } from '../course-map/data/types.ts'
import { esCongratulations } from '../../i18n/congratulations.es.ts'
import {
  CONGRATULATIONS_LIMITS,
  formatScore,
  clearCongratulations,
  resolveCongratulations,
  setCongratulationsField,
  substitute,
} from './congratulations.ts'

const values = { score: '85.50', threshold: 70 }

describe('the congratulations text', () => {
  it('uses the default copy when nothing was customised', () => {
    const text = resolveCongratulations('checkin', null, values, 'gt')
    assert.equal(text.title, esCongratulations.defaults.checkin.title)
    assert.equal(text.body, 'Completaste la evaluación diagnóstica con más del 70%.')
    assert.equal(text.ctaLabel, esCongratulations.defaults.checkin.ctaLabel)
  })
  it('says "al menos el" when the threshold itself passes', () => {
    assert.match(resolveCongratulations('checkin', null, values, 'gte').body, /al menos el 70%/)
  })
  it('does not invent a threshold it does not know', () => {
    const text = resolveCongratulations('checkin', null, { score: null, threshold: null })
    assert.equal(text.body, esCongratulations.defaults.checkin.bodyUnknown)
    assert.doesNotMatch(text.body, /\{|\}/)
  })
  it('has its own default for the final exam', () => {
    const text = resolveCongratulations('final', {}, values)
    assert.equal(text.title, esCongratulations.defaults.final.title)
    assert.equal(text.body, esCongratulations.defaults.final.body)
  })
  it('uses what the editor wrote, field by field, and the default for a field left empty', () => {
    const text = resolveCongratulations(
      'checkin',
      { checkin: { title: '¡Bravo!', body: null, ctaLabel: '   ' } },
      values
    )
    assert.equal(text.title, '¡Bravo!')
    assert.equal(text.body, 'Completaste la evaluación diagnóstica con más del 70%.')
    assert.equal(text.ctaLabel, esCongratulations.defaults.checkin.ctaLabel)
  })
  it('keeps the two purposes apart', () => {
    const settings = { checkin: { title: 'A' }, final: { title: 'B' } }
    assert.equal(resolveCongratulations('checkin', settings, values).title, 'A')
    assert.equal(resolveCongratulations('final', settings, values).title, 'B')
  })
})

describe('the placeholders', () => {
  it('substitute {score} and {threshold}, every time they appear', () => {
    const text = resolveCongratulations(
      'checkin',
      {
        checkin: {
          title: 'Sacaste {score}',
          body: '{score}/{threshold}, {score}',
          ctaLabel: '{threshold}',
        },
      },
      values
    )
    assert.equal(text.title, 'Sacaste 85.5')
    assert.equal(text.body, '85.5/70, 85.5')
    assert.equal(text.ctaLabel, '70')
  })
  it('write the score the way a person would', () => {
    assert.equal(formatScore('85.50'), '85.5')
    assert.equal(formatScore('85.00'), '85')
    assert.equal(formatScore('100'), '100')
    assert.equal(formatScore('72.456'), '72.46')
    assert.equal(formatScore(null), '')
    assert.equal(formatScore('not a number'), '')
  })
  it('leave any other braces as text', () => {
    assert.equal(substitute('Hola {name} {score}', values), 'Hola {name} 85.5')
  })
  it('do not leave a hole when the value is unknown', () => {
    assert.equal(substitute('Nota: {score}', { score: null, threshold: null }), 'Nota: ')
  })
})

describe('a hostile text stays text', () => {
  const attack = '<img src=x onerror=alert(1)><script>alert(2)</script>[x](javascript:alert(3))'
  it('comes out exactly as written, with no markup added or removed', () => {
    const text = resolveCongratulations(
      'checkin',
      { checkin: { title: attack, body: attack, ctaLabel: attack } },
      values
    )
    assert.ok(text.title.startsWith('<img src=x onerror=alert(1)>'))
    assert.ok(text.body.includes('<script>alert(2)</script>'))
    assert.ok(text.ctaLabel.startsWith('<img'))
  })
  it('drops control characters and, outside the body, line breaks', () => {
    const text = resolveCongratulations(
      'checkin',
      { checkin: { title: 'a\u0000b\nc', body: 'uno\ndos\u0007', ctaLabel: 'x\r\ny' } },
      values
    )
    assert.equal(text.title, 'ab c')
    assert.equal(text.body, 'uno\ndos')
    assert.equal(text.ctaLabel, 'x y')
  })
  it('cuts each field to the contract limit', () => {
    const long = 'x'.repeat(2000)
    const text = resolveCongratulations(
      'final',
      { final: { title: long, body: long, ctaLabel: long } },
      values
    )
    assert.equal(text.title.length, CONGRATULATIONS_LIMITS.title)
    assert.equal(text.body.length, CONGRATULATIONS_LIMITS.body)
    assert.equal(text.ctaLabel.length, CONGRATULATIONS_LIMITS.ctaLabel)
  })
  it('does not let a placeholder in the value break out either', () => {
    assert.equal(substitute('{score}', { score: '<b>1</b>', threshold: 1 }), '')
  })
})

describe('editing the congratulations settings', () => {
  const base = { schemaVersion: 1 } as unknown as MapSettings
  it('stores a field, and an emptied field goes back to null (the default)', () => {
    const one = setCongratulationsField(base, 'checkin', 'title', 'Hola')
    assert.deepEqual(one.congratulations, { checkin: { title: 'Hola' } })
    const two = setCongratulationsField(one, 'checkin', 'body', 'Cuerpo')
    assert.deepEqual(two.congratulations?.checkin, { title: 'Hola', body: 'Cuerpo' })
    const back = setCongratulationsField(two, 'checkin', 'title', '')
    assert.deepEqual(back.congratulations?.checkin, { title: null, body: 'Cuerpo' })
  })
  it('a purpose with every field empty is null, and both empty make the whole key null', () => {
    const set = setCongratulationsField(base, 'final', 'ctaLabel', 'Listo')
    assert.equal(setCongratulationsField(set, 'final', 'ctaLabel', '').congratulations, null)
    assert.equal(clearCongratulations(set, 'final').congratulations, null)
  })
  it('keeps the other purpose untouched', () => {
    const both = setCongratulationsField(
      setCongratulationsField(base, 'checkin', 'title', 'A'),
      'final',
      'title',
      'B'
    )
    assert.deepEqual(clearCongratulations(both, 'final').congratulations, {
      checkin: { title: 'A' },
      final: null,
    })
  })
})
