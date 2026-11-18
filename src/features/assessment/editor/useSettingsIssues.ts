import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import {
  pathCandidates,
  pruneIssues,
  tabFor,
  warningsOf,
  type SettingsIssue,
  type StudioTab,
} from './settingsIssues.ts'
import type { MapSettings } from '../../course-map/data/types.ts'

// The studio's memory of what a save said about the settings: the failing fields,
// the warnings of a save that went through, and the move of the focus to the first
// failing field (switching to its tab first). Fields are found by `data-field-path`;
// when none exists the list itself takes the focus.
export const useSettingsIssues = ({
  rootRef,
  setTab,
}: {
  rootRef: RefObject<HTMLElement | null>
  setTab: (tab: StudioTab) => void
}) => {
  const [issues, setIssues] = useState<SettingsIssue[]>([])
  const [warnings, setWarnings] = useState<SettingsIssue[]>([])
  const [target, setTarget] = useState<{ path: string; seq: number } | null>(null)
  const summaryRef = useRef<HTMLDivElement>(null)

  const go = useCallback(
    (issue: SettingsIssue) => {
      const tab = tabFor(issue.path)
      if (tab) setTab(tab)
      setTarget((previous) => ({ path: issue.path, seq: (previous?.seq ?? 0) + 1 }))
    },
    [setTab]
  )

  // After the render that shows the right tab.
  useEffect(() => {
    if (!target) return
    for (const candidate of pathCandidates(target.path)) {
      const field = rootRef.current?.querySelector<HTMLElement>(`[data-field-path="${candidate}"]`)
      if (field) {
        field.focus()
        return
      }
    }
    summaryRef.current?.focus()
  }, [target, rootRef])

  const refuse = useCallback(
    (list: SettingsIssue[]) => {
      setIssues(list)
      setWarnings([])
      if (list[0]) go(list[0])
    },
    [go]
  )

  const accept = useCallback((saved: unknown) => {
    setIssues([])
    setWarnings(warningsOf(saved))
  }, [])

  // The author changed something: the errors of the fields they touched are stale.
  const edited = useCallback(
    (before: MapSettings, after: MapSettings) =>
      setIssues((current) =>
        current.length === 0 ? current : pruneIssues(current, before, after)
      ),
    []
  )

  const dismissWarnings = useCallback(() => setWarnings([]), [])

  return { issues, warnings, summaryRef, go, refuse, accept, edited, dismissWarnings }
}
