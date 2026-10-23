import { es } from '../../../i18n/es.ts'
import { CONTENT_LIMITS, type Content } from '../contentTypes.ts'
import type { ContentProblem } from '../validateContent.ts'

// The validator's problems as sentences the author can act on, in the order
// they appear in the content, each said once.
export const describeProblems = (
  content: Content,
  problems: readonly ContentProblem[]
): string[] => {
  const text = es.content.editor.problems
  const sentences: string[] = []
  const add = (sentence: string) => {
    if (!sentences.includes(sentence)) sentences.push(sentence)
  }

  for (const problem of problems) {
    const [head, index, field] = problem.path.split('.')
    const n = Number(index) + 1
    if (problem.path === 'title') add(problem.code === 'too_long' ? text.titleLong : text.title)
    else if (head === 'blocks' && index === undefined)
      add(text.tooManyBlocks(CONTENT_LIMITS.maxBlocks))
    else if (problem.code === 'too_large') add(text.tooLarge)
    else if (head === 'blocks' && field === 'text')
      add(problem.code === 'too_long' ? text.blockLong(n) : text.blockText(n))
    else if (head === 'blocks' && field === 'assetId') add(text.blockImage(n))
    else if (head === 'blocks' && field === 'alt')
      add(problem.code === 'too_long' ? text.blockLong(n) : text.blockAlt(n))
    else if (head === 'blocks' && field === 'caption') add(text.blockLong(n))
    else if (head === 'blocks' && field === 'videoId') add(text.blockVideo(n))
    else if (head === 'blocks' && content.type === 'blocks') {
      const block = content.body.blocks[Number(index)]
      if (field === 'title' && block?.type === 'video') add(text.blockVideoTitle(n))
      else if (field === 'url') add(text.blockLink(n))
      else add(text.generic)
    } else if (problem.path === 'altText') add(text.widgetAlt)
    else if (problem.path === 'html') add(text.widgetHtml)
    else add(text.generic)
  }
  return sentences
}

// What the backend said about a save that failed.
export const contentErrorMessage = (error: unknown): string => {
  const messages = es.content.editor.errors
  const status = (error as { status?: number } | null)?.status
  const code = (error as { detail?: { code?: string } } | null)?.detail?.code
  if (code === 'widgets_disabled' || status === 403) return messages.widgetsDisabled
  if (code === 'content_too_large' || status === 413) return messages.tooLarge
  if (code === 'content_invalid') return messages.invalid
  if (status === 400 || status === 422) return messages.unsupported
  return messages.generic
}
