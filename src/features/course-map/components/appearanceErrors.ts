import { ApiError } from '../data/apiError.ts'

export interface SaveFailureText {
  network: string
  conflict: (code: string) => string
  stale: (code: string) => string
  server: (status: number, code: string) => string
  other: (status: number, code: string) => string
  welcomeInvalid: string
  problem: (text: string, path: string) => string
  welcomeProblems: Record<string, string>
}

interface Problem {
  path?: unknown
  code?: unknown
  message?: unknown
}

// What the Appearance panel says when a save fails. Never just "try again": the
// server's code (or the problem's text and path) goes in the message.
export const describeSaveFailure = (error: unknown, text: SaveFailureText): string => {
  if (!(error instanceof ApiError)) return text.other(-1, 'unknown_error')
  const { status } = error
  if (status === 0) return text.network
  const detail = error.detail
  const code = String(detail.code)
  if (status === 422 && code === 'welcome_invalid') {
    const problems = Array.isArray(detail.problems) ? (detail.problems as Problem[]) : []
    const lines = problems
      .filter((problem) => typeof problem.path === 'string')
      .map((problem) => {
        const known =
          typeof problem.code === 'string' ? text.welcomeProblems[problem.code] : undefined
        const own = typeof problem.message === 'string' ? problem.message : String(problem.code)
        return text.problem(known ?? own, problem.path as string)
      })
    return lines.length > 0 ? lines.join(' ') : `${text.welcomeInvalid} (${code})`
  }
  if (status === 409) return text.conflict(code)
  if (status === 412 || status === 428) return text.stale(code)
  if (status >= 500) return text.server(status, code)
  return text.other(status, code)
}
