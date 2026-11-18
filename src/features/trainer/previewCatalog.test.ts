import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ContractError } from '../course-map/data/contract.ts'
import { catalogReason, stageScreen } from './availability.ts'
import { hasContent, parseCatalog } from './catalogContract.ts'
import { previewCatalog } from './fixtures/previewCatalog.ts'
import { publicationLabel, studentsCanSee } from './publication.ts'
import { esTrainer } from '../../i18n/trainer.es.ts'

describe('an editor in preview with only draft activities', () => {
  const catalog = parseCatalog(structuredClone(previewCatalog))

  it('has content and opens the lesson stage', () => {
    assert.equal(hasContent(catalog), true)
    assert.equal(catalogReason(catalog), null)
    assert.deepEqual(stageScreen({ status: 'success', catalog }), { kind: 'content' })
  })

  it('hands every lesson and activity to the screens, draft and reviewed included', () => {
    assert.deepEqual(
      catalog.lessons?.map((l) => [l.id, l.module]),
      [['1.1', 'M1']]
    )
    assert.deepEqual(
      catalog.activities?.map((a) => [a.id, a.lesson_id, a.publication_state]),
      [
        ['en-a1-1.1-dialogue', '1.1', 'draft'],
        ['en-a1-1.1-grammar', '1.1', 'reviewed'],
      ]
    )
  })

  it('keeps what the backend sent where it did not send the old fields', () => {
    const [first] = catalog.activities ?? []
    assert.equal(first?.state, 'not_started')
    assert.equal(first?.best_score, null)
    assert.equal(first?.completed_count, 0)
    assert.equal(first?.locked, false)
    assert.equal(first?.estimated_minutes, null)
  })

  it('labels each state in words and calls only published visible to students', () => {
    assert.match(publicationLabel('draft', esTrainer.publication) ?? '', /Borrador/)
    assert.match(publicationLabel('reviewed', esTrainer.publication) ?? '', /Revisado/)
    assert.equal(studentsCanSee('draft'), false)
    assert.equal(studentsCanSee('reviewed'), false)
    assert.equal(studentsCanSee('published'), true)
  })

  it('says there is no content only when the server list is empty', () => {
    const empty = parseCatalog({
      ...previewCatalog,
      modules: [{ key: 'M1', title: 'M', lessons: [] }],
    })
    assert.equal(catalogReason(empty), 'no_content')
  })

  it('refuses, naming the field, a lesson or activity missing what the screens need', () => {
    const broken = structuredClone(previewCatalog)
    const lesson = broken.modules[0]?.lessons[0]
    assert.ok(lesson)
    delete (lesson as Partial<typeof lesson>).title
    delete (lesson.activities[0] as Partial<(typeof lesson.activities)[0]>).skill
    try {
      parseCatalog(broken)
      assert.fail('expected a ContractError')
    } catch (error) {
      assert.ok(error instanceof ContractError)
      assert.deepEqual(error.issues, [
        'modules[0].lessons[0].title: expected a string, got undefined',
        'modules[0].lessons[0].activities[0].skill: expected a string, got undefined',
      ])
    }
  })
})
