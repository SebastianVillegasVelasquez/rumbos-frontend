import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ContractError } from '../course-map/data/contract.ts'
import { esTrainer } from '../../i18n/trainer.es.ts'
import { catalogReason, stageScreen } from './availability.ts'
import { hasContent, parseCatalog } from './catalogContract.ts'
import { catalogFixture } from './fixtures/catalogFixture.ts'
import { publicationLabel, studentsCanSee } from './publication.ts'

type Raw = { modules: { lessons: { activities: Record<string, unknown>[] }[] }[] }
const raw = () => catalogFixture() as Raw

const activitiesOf = (catalog: ReturnType<typeof parseCatalog>) =>
  (catalog.modules ?? []).flatMap((m) => m.lessons.flatMap((l) => l.activities))

describe('production answer for an editor in preview: only draft activities', () => {
  const catalog = parseCatalog(catalogFixture())

  it('has content and opens the lesson stage, not "no lessons yet"', () => {
    assert.equal(hasContent(catalog), true)
    assert.equal(catalogReason(catalog), null)
    assert.deepEqual(stageScreen({ status: 'success', catalog }), { kind: 'content' })
  })

  it('hands every module, lesson and activity of the server to the screens', () => {
    assert.equal(catalog.modules?.length, 4)
    assert.equal(catalog.modules?.flatMap((m) => m.lessons).length, 15)
    assert.equal(activitiesOf(catalog).length, 45)
    assert.ok(activitiesOf(catalog).every((a) => a.publication_state === 'draft'))
  })

  it('is in preview because the server sent unpublished items, though it sends no flag', () => {
    assert.equal(catalog.preview, true)
  })

  it('keeps the backend names, with nothing invented', () => {
    assert.deepEqual(activitiesOf(catalog)[0], raw().modules[0]?.lessons[0]?.activities[0])
    assert.equal(catalog.modules?.[0]?.lessons[0]?.vocabulary_count, 8)
  })

  it('is not in preview when every item is published', () => {
    const published = { ...raw(), preview: undefined } as ReturnType<typeof raw> & {
      preview?: boolean
    }
    for (const m of published.modules)
      for (const l of m.lessons) for (const a of l.activities) a.publication_state = 'published'
    assert.equal(parseCatalog(published).preview, false) // derived: this commit predates the flag
  })

  it('labels draft and reviewed in words; only published is visible to students', () => {
    assert.match(publicationLabel('draft', esTrainer.publication) ?? '', /Borrador/)
    assert.match(publicationLabel('reviewed', esTrainer.publication) ?? '', /Revisado/)
    assert.equal(studentsCanSee('draft'), false)
    assert.equal(studentsCanSee('reviewed'), false)
    assert.equal(studentsCanSee('published'), true)
  })

  it('says there is no content only when the server list is empty', () => {
    const empty = parseCatalog({
      ...(catalogFixture() as object),
      modules: [{ key: 'M1', title: 'M', lessons: [] }],
    })
    assert.equal(catalogReason(empty), 'no_content')
  })

  it('refuses, naming the fields, an activity that lacks what the backend promises', () => {
    const broken = raw()
    const activity = broken.modules[0]?.lessons[0]?.activities[0]
    assert.ok(activity)
    delete activity.step_count
    activity.publication_state = 'archived'
    try {
      parseCatalog(broken)
      assert.fail('expected a ContractError')
    } catch (error) {
      assert.ok(error instanceof ContractError)
      assert.deepEqual(error.issues, [
        'modules[0].lessons[0].activities[0].step_count: expected a number, got undefined',
        'modules[0].lessons[0].activities[0].publication_state: expected one of draft, reviewed, published, got archived',
      ])
    }
  })
})
