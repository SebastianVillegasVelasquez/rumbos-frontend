import { ContractError } from '../course-map/data/contract.ts'

// What broke the stage, for the log. The screen says one thing to everyone ("try
// again or go back"); the console says which thing it was, so a report from
// production names the cause instead of "the trainer could not be loaded".

export type StageFailureKind = 'chunk' | 'contract' | 'render'

export interface StageFailure {
  kind: StageFailureKind
  name: string
  message: string
  // Only a contract failure has these: the endpoint and the fields that were wrong.
  endpoint?: string
  issues?: readonly string[]
}

// The messages browsers give when a dynamically imported module cannot be fetched.
const CHUNK =
  /dynamically imported module|importing a module script failed|loading (css )?chunk|ChunkLoadError/i

export const describeStageFailure = (error: unknown): StageFailure => {
  if (error instanceof ContractError)
    return {
      kind: 'contract',
      name: error.name,
      message: error.message,
      endpoint: error.endpoint,
      issues: error.issues,
    }
  const name = error instanceof Error ? error.name : typeof error
  const message = error instanceof Error ? error.message : String(error)
  return { kind: CHUNK.test(`${name} ${message}`) ? 'chunk' : 'render', name, message }
}
