import type { ActivityView } from '../../embed/hostActivities.ts'

// What a Moodle-activity step shows, as data (no React, no host): the card has one open
// button, one line of status and, when something went wrong, the way out. Kept apart from the
// component so every state is a test, and a state with no text fails one (see stepStates.test).

export type ActivityMessage =
  'hint' | 'open' | 'seen' | 'not_found' | 'forbidden' | 'unsupported' | 'no_host' | 'silent'

export type ActivityOpenLabel = 'open' | 'opening' | 'reopen' | 'retry'

export interface ActivityStepInput {
  // The host announced capabilities.activity (and there is a host at all).
  capability: boolean
  view: ActivityView
  // The host did not answer an open within the wait.
  silent: boolean
}

export interface ActivityStepModel {
  message: ActivityMessage
  // Null: no button (nothing the viewer could do).
  openLabel: ActivityOpenLabel | null
  openDisabled: boolean
  // The request is in flight (aria-busy).
  busy: boolean
  // The activity cannot be shown at all: the step does not block and records `unavailable`.
  unavailable: boolean
  // The recorded way out ("Continuar de todos modos"), offered when a retry may not help.
  escape: boolean
  seen: boolean
}

export const ACTIVITY_OPEN_WAIT_MS = 10_000

export const activityStepModel = ({
  capability,
  view,
  silent,
}: ActivityStepInput): ActivityStepModel => {
  // A host that cannot open activities: say so, and do not trap anyone. This reuses the
  // existing "content cannot be served" record; it is not a new way out.
  if (!capability)
    return {
      message: 'no_host',
      openLabel: null,
      openDisabled: true,
      busy: false,
      unavailable: true,
      escape: false,
      seen: false,
    }
  switch (view.status) {
    case 'opening':
      if (silent)
        return {
          message: 'silent',
          openLabel: 'retry',
          openDisabled: false,
          busy: false,
          unavailable: false,
          escape: true,
          seen: false,
        }
      return {
        message: 'hint',
        openLabel: 'opening',
        openDisabled: true,
        busy: true,
        unavailable: false,
        escape: false,
        seen: false,
      }
    case 'open':
      return {
        message: 'open',
        openLabel: 'open',
        openDisabled: true,
        busy: false,
        unavailable: false,
        escape: false,
        seen: false,
      }
    case 'seen':
      return {
        message: 'seen',
        openLabel: 'reopen',
        openDisabled: false,
        busy: false,
        unavailable: false,
        escape: false,
        seen: true,
      }
    case 'failed': {
      // The activity is gone or can never be opened here: nothing to retry.
      if (view.reason === 'not_found' || view.reason === 'unsupported')
        return {
          message: view.reason,
          openLabel: null,
          openDisabled: true,
          busy: false,
          unavailable: true,
          escape: false,
          seen: false,
        }
      // Forbidden may pass (a restriction opens, a hidden activity is shown): retry, and a way out.
      return {
        message: 'forbidden',
        openLabel: 'retry',
        openDisabled: false,
        busy: false,
        unavailable: false,
        escape: true,
        seen: false,
      }
    }
    case 'idle':
      return {
        message: 'hint',
        openLabel: 'open',
        openDisabled: false,
        busy: false,
        unavailable: false,
        escape: false,
        seen: false,
      }
  }
}
