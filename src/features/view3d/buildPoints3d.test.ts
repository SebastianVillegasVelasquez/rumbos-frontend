import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildPoints3d, pinStateFor } from './buildPoints3d.ts'
import type { RenderableMap } from '../course-map/renderable.ts'
import type {
  Activity,
  RenderableBubble,
  ResolvedCourseMap,
  View3d,
} from '../course-map/data/types.ts'

const bubble = (id: string, sequence: number, status: RenderableBubble['status']) => ({
  id,
  activityId: sequence + 100,
  x: 0,
  y: 0,
  icon: null,
  skinId: null,
  sequence,
  status,
})

const mapOf = (mode: 'guided' | 'explorative', bubbles: RenderableBubble[]): RenderableMap =>
  ({
    id: 'm1',
    title: 'Mapa',
    settings: { mode },
    bubbles,
    source: 'published',
    publicationNumber: 1,
  }) as unknown as RenderableMap

const activity = (name: string) => ({ name }) as unknown as Activity

const resolvedOf = (
  entries: [string, 'available' | 'hidden' | 'missing' | 'unknown', string | null][]
): ResolvedCourseMap => ({
  moodleStatus: 'live',
  bubbles: entries.map(([bubbleId, availability, name]) => ({
    bubbleId,
    availability,
    activity: name === null ? null : activity(name),
  })),
})

const binding = (zoneId: number, bubbleId: string, title = null, description = null) => ({
  zoneId,
  bubbleId,
  title,
  description,
})

describe('pinStateFor', () => {
  it('maps inProgress and unknown to available and keeps the rest', () => {
    assert.equal(pinStateFor('inProgress'), 'available')
    assert.equal(pinStateFor('unknown'), 'available')
    for (const state of ['locked', 'available', 'next', 'complete', 'teaser', 'missing'] as const) {
      assert.equal(pinStateFor(state), state)
    }
  })
})

describe('buildPoints3d', () => {
  const map = mapOf('guided', [
    bubble('a', 0, 'complete'),
    bubble('b', 1, 'no_complete'),
    bubble('c', 2, 'locked'),
  ])
  const resolved = resolvedOf([
    ['a', 'available', 'Bienvenida'],
    ['b', 'available', 'Cuestionario'],
    ['c', 'available', 'Proyecto'],
  ])

  it('uses the activity name, the scene text for the description and the 2D state', () => {
    const view3d: View3d = {
      scene: 's',
      bindings: [binding(3, 'b'), binding(1, 'a'), binding(5, 'c')],
    }
    assert.deepEqual(buildPoints3d(map, view3d, resolved, 'es'), [
      { id: 'a', zoneId: 1, title: 'Bienvenida', description: null, state: 'complete' },
      { id: 'b', zoneId: 3, title: 'Cuestionario', description: null, state: 'next' },
      { id: 'c', zoneId: 5, title: 'Proyecto', description: null, state: 'locked' },
    ])
  })

  it('prefers the override in the current locale and ignores blank ones', () => {
    const view3d: View3d = {
      scene: 's',
      bindings: [
        binding(0, 'a', { es: 'Título', en: 'Title' } as never, { en: 'Only English' } as never),
        binding(1, 'b', { es: '   ' } as never),
      ],
    }
    const es = buildPoints3d(map, view3d, resolved, 'es')
    assert.equal(es[0].title, 'Título')
    assert.equal(es[0].description, null)
    assert.equal(es[1].title, 'Cuestionario')
    const en = buildPoints3d(map, view3d, resolved, 'en')
    assert.equal(en[0].title, 'Title')
    assert.equal(en[0].description, 'Only English')
  })

  it('has a null title when there is neither an override nor an activity', () => {
    const view3d: View3d = { scene: 's', bindings: [binding(0, 'a')] }
    const missing = resolvedOf([['a', 'missing', null]])
    assert.deepEqual(buildPoints3d(map, view3d, missing, 'es'), [
      { id: 'a', zoneId: 0, title: null, description: null, state: 'missing' },
    ])
    assert.equal(buildPoints3d(map, view3d, undefined, 'es')[0].title, null)
  })

  it('shows hidden activities as teasers to students and as available to editors', () => {
    const view3d: View3d = { scene: 's', bindings: [binding(0, 'b')] }
    const hidden = resolvedOf([['b', 'hidden', 'Cuestionario']])
    const explorative = mapOf('explorative', [bubble('b', 0, 'no_complete')])
    assert.equal(buildPoints3d(explorative, view3d, hidden, 'es', 'student')[0].state, 'teaser')
    assert.equal(buildPoints3d(explorative, view3d, hidden, 'es', 'editor')[0].state, 'available')
  })

  it('maps in-progress and outage-unknown bubbles to available', () => {
    const view3d: View3d = { scene: 's', bindings: [binding(0, 'a'), binding(1, 'b')] }
    const m = mapOf('explorative', [bubble('a', 0, 'in_progress'), bubble('b', 1, 'no_complete')])
    const r = resolvedOf([
      ['a', 'available', 'A'],
      ['b', 'unknown', 'B'],
    ])
    assert.deepEqual(
      buildPoints3d(m, view3d, r, 'es').map((p) => p.state),
      ['available', 'available']
    )
  })

  it('skips bindings whose bubble is not in the map', () => {
    const view3d: View3d = { scene: 's', bindings: [binding(0, 'gone'), binding(1, 'a')] }
    assert.deepEqual(
      buildPoints3d(map, view3d, resolved, 'es').map((p) => p.id),
      ['a']
    )
  })
})
