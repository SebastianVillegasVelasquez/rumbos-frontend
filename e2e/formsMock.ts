import type { BrowserContext } from '@playwright/test'
import { validated } from '../src/contracts/openapiExample.ts'

// GET /trainer/assessments/forms for the editor specs (editors only, drafts included),
// answered with a body checked against the response schema of contracts/openapi.json.
export const FORMS = [
  {
    id: 'a1-form-a',
    title: 'A1 · Forma A',
    language: 'en',
    level: 'A1',
    purpose: 'check_in',
    publication_state: 'published',
  },
  {
    id: 'a1-form-b',
    title: 'A1 · Forma B',
    language: 'en',
    level: 'A1',
    purpose: 'check_in',
    publication_state: 'draft',
  },
] as const

// `status` makes the list fail with that status instead (0: the connection drops).
// What the A2 pack adds: its Forma A, a draft until it is published (the picker shows it).
export const A2_FORMS = [
  ...FORMS,
  {
    id: 'a2-form-a',
    title: 'A2 · Forma A',
    language: 'en',
    level: 'A2',
    purpose: 'check_in',
    publication_state: 'draft',
  },
] as const

export const routeForms = async (
  context: BrowserContext,
  { status, forms = FORMS }: { status?: number; forms?: readonly object[] } = {}
) => {
  await context.route('**/api/v1/trainer/assessments/forms', (route) => {
    if (status === 0) return route.abort('connectionrefused')
    if (status !== undefined)
      return route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({ detail: { code: 'down', message: 'down' } }),
      })
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(validated('GET', '/trainer/assessments/forms', 200, forms)),
    })
  })
}
