import type { MapMode } from './data/types.ts'

// What the editor is told about completion tracking. The plugin and the app
// deploy independently, so an old host sends no `courseCompletionEnabled`:
// that is "unknown", never "disabled", and says nothing.

interface Input {
  isEditor: boolean
  embedded: boolean
  // null: unknown (no state yet, or a host that predates contract v5.4).
  completionEnabled: boolean | null
  mode: MapMode
  // Visible activities of this level that Moodle does not track.
  untrackedCount: number
}

export interface CompletionNotices {
  // Completion tracking is switched off for the whole course.
  courseDisabled: boolean
  // Guided mode cannot work with activities that never complete.
  guidedWithUntracked: boolean
}

export const completionNotices = ({
  isEditor,
  embedded,
  completionEnabled,
  mode,
  untrackedCount,
}: Input): CompletionNotices => ({
  courseDisabled: isEditor && embedded && completionEnabled === false,
  guidedWithUntracked: isEditor && mode === 'guided' && untrackedCount > 0,
})

// "Configurar en Moodle" is offered only to an editor whose host speaks v5.4 (an
// older one would ignore the message and the button would do nothing).
export const canConfigureCompletion = (input: {
  embedded: boolean
  editorMode: boolean
  hostSpeaksV54: boolean
}): boolean => input.embedded && input.editorMode && input.hostSpeaksV54
