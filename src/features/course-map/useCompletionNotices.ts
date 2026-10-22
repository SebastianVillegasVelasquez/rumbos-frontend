import { useEffect, useRef } from 'react'
import { announce } from '../../components/ui/announce.ts'
import { useToast } from '../../components/ui/toastContext.ts'
import { es } from '../../i18n/es.ts'
import { newlyCompleted, snapshotOf, type CompletionSnapshot } from './completionChanges.ts'
import type { RenderableBubble } from './data/types.ts'

interface Options {
  // Identifies the level; a different one starts a new baseline.
  levelKey: string | null
  // The Moodle data for this level has arrived. Until then the bubbles carry
  // stored placeholder statuses and must not become the baseline.
  ready: boolean
  bubbles: RenderableBubble[]
  // The activity's name, or null when the person must not be told it (hidden).
  nameOf: (bubble: RenderableBubble) => string | null
  enabled: boolean
}

// Tells the student, once, about each activity they just completed: a toast for
// the eyes and a polite announcement for screen readers. The first state of a
// level only sets the baseline.
export const useCompletionNotices = ({ levelKey, ready, bubbles, nameOf, enabled }: Options) => {
  const toast = useToast()
  const baseline = useRef<{ key: string | null; snapshot: CompletionSnapshot | null }>({
    key: null,
    snapshot: null,
  })
  const nameRef = useRef(nameOf)
  useEffect(() => {
    nameRef.current = nameOf
  })

  useEffect(() => {
    if (!enabled || !ready || bubbles.length === 0) return
    if (baseline.current.key !== levelKey) baseline.current = { key: levelKey, snapshot: null }
    const current = snapshotOf(bubbles)
    const done = newlyCompleted(baseline.current.snapshot, current)
    baseline.current.snapshot = current
    for (const cmid of done) {
      const bubble = bubbles.find((item) => item.activityId === cmid)
      const name = bubble ? nameRef.current(bubble) : null
      if (!name) continue
      const message = es.progress.completed(name)
      announce(message)
      // The announcement above already speaks; the toast is for the eyes.
      toast.show(message, 'success', { silent: true })
    }
  }, [enabled, ready, levelKey, bubbles, toast])
}
