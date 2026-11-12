import { es } from '../../../i18n/es.ts'
import { gateOf, type FlowState } from './flowReducer.ts'

const text = es.flow

// What "Continuar" waits for, as visible text.
export const waitingText = (state: FlowState): string | null => {
  const gate = gateOf(state)
  // A step that can be left (done, optional or in review) explains nothing.
  if (gate.canContinue) return null
  switch (gate.waitingFor) {
    case 'time':
      return text.waiting.time(gate.secondsLeft)
    case 'ack':
      return text.waiting.ack
    case 'time-and-ack':
      return text.waiting.timeAndAck(gate.secondsLeft)
    case 'video':
      return text.waiting.video
    case 'quiz':
      return text.waiting.quiz
    default:
      return null
  }
}
