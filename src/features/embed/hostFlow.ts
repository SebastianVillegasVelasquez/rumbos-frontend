import type {
  FlowProgressError,
  FlowProgressItem,
  HostFlowProgressMessage,
  HostQuizResultMessage,
  QuizResult,
  QuizResultError,
} from './protocol.ts'

// What the host (Moodle) last said about the welcome flow (contract v5.8): the
// progress per map and the quiz results per cmid. Memory only and dependency
// free, like hostStats.ts: nothing here touches the network or storage, and the
// session end clears it. The local fallback flag lives in the player, not here.
export type HostFlowProgress =
  | {
      status: 'ready'
      items: FlowProgressItem[]
      persistent: boolean
      quizThreshold: number
      receivedAt: number
    }
  | { status: 'error'; error: FlowProgressError }

export type HostQuizView =
  | { status: 'ready'; result: QuizResult; receivedAt: number }
  | { status: 'error'; error: QuizResultError }

let progress = new Map<string, HostFlowProgress>()
let quizzes = new Map<number, HostQuizView>()
// How many quiz answers have arrived: lets a waiter tell "answered" from "silent"
// without comparing contents. Progress answers do not count: the host sends one
// after every write, which says nothing about whether it answers quiz requests.
let quizReceived = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())

export const getHostFlowProgress = (mapId: string): HostFlowProgress | null =>
  progress.get(mapId) ?? null

export const getHostQuizView = (cmid: number): HostQuizView | null => quizzes.get(cmid) ?? null

export const getHostQuizReceivedCount = () => quizReceived

export const setHostFlowProgress = (message: HostFlowProgressMessage) => {
  progress = new Map(progress).set(
    message.mapId,
    message.error !== undefined
      ? { status: 'error', error: message.error }
      : {
          status: 'ready',
          items: message.items,
          persistent: message.persistent,
          quizThreshold: message.config.quizThreshold,
          receivedAt: Date.now(),
        }
  )
  emit()
}

export const setHostQuizResult = (message: HostQuizResultMessage) => {
  quizReceived++
  quizzes = new Map(quizzes).set(
    message.cmid,
    message.error !== undefined
      ? { status: 'error', error: message.error }
      : { status: 'ready', result: message.result, receivedAt: Date.now() }
  )
  emit()
}

export const clearHostFlow = () => {
  if (progress.size === 0 && quizzes.size === 0) return
  progress = new Map()
  quizzes = new Map()
  emit()
}

export const subscribeHostFlow = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}
