import type { BrowserContext, Page } from '@playwright/test'
import { validated } from '../src/contracts/openapiExample.ts'
import { app } from './support.ts'

// GET /trainer/closing for the browser tests. Every body is checked against
// contracts/openapi.json before it is served, so a drift of the contract fails here.

export const closingStatus = (
  final: 'required' | 'not_required_passed_checkin' | 'passed' | 'exhausted' | 'locked',
  {
    reason = null as string | null,
    completed = 5,
    total = 5,
    // As in observe mode: the backend does not check the content.
    observe = false,
    checkin = undefined as 'not_taken' | 'passed' | 'not_passed' | undefined,
    // The final exam's list item, which the real backend sends here while the gate is on.
    item = null as object | null,
  } = {}
): object => {
  const passedCheckin = final === 'not_required_passed_checkin'
  // As the backend answers: only a required final can be started, and a passed check-in
  // reads as "already passed".
  const why =
    reason ??
    (passedCheckin || final === 'passed'
      ? 'already_passed'
      : final === 'exhausted'
        ? 'no_attempts_left'
        : final === 'locked'
          ? 'scorm_incomplete'
          : null)
  return validated('GET', '/trainer/closing', 200, {
    enforced: !observe,
    preview: false,
    available: final === 'required',
    reason: why,
    progress: observe ? null : { completed, total },
    final: item,
    outcome: {
      checkin: {
        status: checkin ?? (passedCheckin ? 'passed' : 'not_passed'),
        percent: checkin === 'not_taken' ? null : passedCheckin ? '85.50' : '40.00',
        pass_percent: 70,
        pass_operator: 'gt',
        attempts: { used: 1, max: 2 },
      },
      final: {
        status: final,
        reason: final === 'locked' ? why : null,
        attempts: passedCheckin ? null : { used: final === 'exhausted' ? 3 : 0, max: 3 },
        percent: final === 'passed' ? '92.00' : null,
        pass_percent: 75,
        pass_operator: 'gte',
      },
      scorm_gate: observe
        ? { satisfied: null, reason: 'not_checked' }
        : { satisfied: final !== 'locked', reason: passedCheckin ? 'passed_checkin' : null },
    },
  }) as object
}

// Every activity of the mock course complete, set in the mock host as a student's work would.
export const completeAll = async (page: Page) => {
  const selects = page.locator('table select').filter({ hasText: 'incomplete' })
  for (let i = 0; i < (await selects.count()); i++) await selects.nth(i).selectOption('complete')
}

// The backend's answer can change during a test: the route reads the current one. Install it
// after any other mock of /trainer, so it is the one that answers.
export const serveClosingStatus = async (context: BrowserContext, current: { value: object }) => {
  await context.route(/\/trainer\/closing(\?.*)?$/, (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(current.value) })
  )
}

export const closingCard = (page: Page) => app(page).getByTestId('closing-card')

// A student's only way in: the card on the map.
export const enterFromCard = (page: Page) =>
  closingCard(page).getByRole('button', { name: 'Continuar al cierre' }).click()
