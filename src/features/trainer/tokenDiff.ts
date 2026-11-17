// A local, pure word diff between what the student wrote and the closest authored
// answer (S7). It is shown as a comparison, never as a grade, and it needs no
// network and no model: a longest-common-subsequence over lowercase words with the
// punctuation kept apart.

export type DiffKind = 'same' | 'added' | 'removed'

export interface DiffPart {
  kind: DiffKind
  text: string
}

// "Hello, world!" -> ["Hello", ",", "world", "!"]
export const words = (value: string): string[] =>
  value.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*|[^\s\p{L}\p{N}]/gu) ?? []

const norm = (word: string) => word.toLowerCase().replace(/’/g, "'")

// 'removed' is in the student's text and not in the answer (extra);
// 'added' is in the answer and not in the student's text (missing).
export const tokenDiff = (mine: string, closest: string): DiffPart[] => {
  const a = words(mine)
  const b = words(closest)
  const n = a.length
  const m = b.length
  const table: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      table[i][j] =
        norm(a[i]) === norm(b[j])
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1])

  const parts: DiffPart[] = []
  const push = (kind: DiffKind, text: string) => {
    const last = parts[parts.length - 1]
    if (last && last.kind === kind) last.text += ` ${text}`
    else parts.push({ kind, text })
  }
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (norm(a[i]) === norm(b[j])) {
      push('same', b[j])
      i++
      j++
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      push('removed', a[i++])
    } else {
      push('added', b[j++])
    }
  }
  while (i < n) push('removed', a[i++])
  while (j < m) push('added', b[j++])
  return parts
}
