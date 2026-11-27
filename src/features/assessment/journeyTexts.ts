import { esCongratulations } from '../../i18n/congratulations.es.ts'

// The journey's messages to a student who has not passed, in one place. They are Rumbos' own
// copy today: contracts/openapi.json declares no `route_instructions` and no failure or
// exhausted text in the map's settings. When it does, the map's text is read here and nowhere else.

const text = esCongratulations.journey

export const routeInstructions = (): string => text.routeBody

// After a failed final attempt: which one it was, and what is left.
export const finalFailure = (used: number, max: number): { title: string; body: string } => {
  const left = Math.max(0, max - used)
  return {
    title: text.failureTitle(used, max),
    body: left > 0 ? text.failureBody(left, max) : text.exhaustedBody,
  }
}
