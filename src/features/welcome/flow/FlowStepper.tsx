import type { Dispatch } from 'react'
import { es } from '../../../i18n/es.ts'
import type { WelcomeStep } from '../../course-map/data/types.ts'
import type { FlowEvent, FlowState } from './flowReducer.ts'
import { stepperSegments } from './stepperModel.ts'

const text = es.flow

// The progress bar: one segment per step. The visible line ("Paso 2 de 5 · Video")
// and the highlighted segment both come from state.index. The segments are
// buttons so a reached step can be revisited; a locked one is disabled.
export const FlowStepper = ({
  state,
  steps,
  dispatch,
}: {
  state: FlowState
  steps: WelcomeStep[]
  dispatch: Dispatch<FlowEvent>
}) => (
  <ol aria-label={text.progress} className="mt-2 flex items-center">
    {stepperSegments(state).map((segment) => (
      <li key={segment.key} className="flex min-w-0 flex-1">
        <button
          type="button"
          className="flow-seg"
          data-kind={segment.kind}
          disabled={!segment.reachable}
          aria-current={segment.kind === 'current' ? 'step' : undefined}
          aria-label={text.dot(
            segment.index + 1,
            steps[segment.index].title,
            segment.kind,
            segment.done
          )}
          onClick={() => dispatch({ type: 'goto', index: segment.index })}
        >
          <span aria-hidden />
        </button>
      </li>
    ))}
  </ol>
)
