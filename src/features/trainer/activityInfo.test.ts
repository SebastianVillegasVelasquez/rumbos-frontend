import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { activityInfoOf } from './activityInfo.ts'
import { catalogFixture } from './fixtures/catalogFixture.ts'
import { parseCatalog } from './catalogContract.ts'

describe('the intro of an activity, from the catalog', () => {
  const catalog = parseCatalog(catalogFixture())
  const lesson = catalog.modules?.[0]?.lessons[0]
  const activity = lesson?.activities[0]

  it('takes what the catalog says about the activity and the lesson it sits in', () => {
    assert.ok(lesson && activity)
    assert.deepEqual(activityInfoOf(catalog, activity.id), {
      id: activity.id,
      title: activity.title,
      skill: activity.skill,
      lesson_id: lesson.id,
      role: activity.role,
      can_do: activity.can_do,
      step_count: activity.step_count,
    })
  })

  it('is null for an activity the catalog does not list, or no catalog yet', () => {
    assert.equal(activityInfoOf(catalog, 'not-an-activity'), null)
    assert.equal(activityInfoOf(undefined, activity?.id ?? 'x'), null)
    assert.equal(activityInfoOf({ enabled: false, preview: true }, 'x'), null)
  })
})
