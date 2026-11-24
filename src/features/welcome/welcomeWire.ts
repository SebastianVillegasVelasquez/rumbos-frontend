import type { AppearanceUpdate, MapWelcome } from '../course-map/data/types.ts'

// The one place where a welcome becomes the body of PUT /appearance.
//
// The contract: when `steps` has entries, the four legacy fields (title, message,
// video, playOnEnter) must be null or absent. The server's model defaults
// playOnEnter to true, so omitting it is not safe: send an explicit null.
// Everything that saves a welcome (convert, edit, import, restore a version)
// ends up here, so no editor operation has to remember the rule.
export const serializeWelcome = (welcome: MapWelcome): MapWelcome =>
  welcome.steps && welcome.steps.length > 0
    ? { ...welcome, title: null, message: null, video: null, playOnEnter: null }
    : welcome

// `trainer` and `assessments` are objects in the contract, never null: a null the editor
// holds (nothing set yet) is left out, which the backend reads as the defaults (off).
export const serializeAppearance = (input: AppearanceUpdate): AppearanceUpdate => {
  const { trainer, assessments, closing, ...rest } = input.settings
  // A closing flow with no steps is no closing flow: the backend refuses an empty one
  // (`closing_needs_steps`), and "none" is `null`, which the editor's empty tab means.
  const hasClosing = closing != null && (closing.steps?.length ?? 0) > 0
  const settings = {
    ...rest,
    ...(hasClosing
      ? { closing: serializeWelcome(closing) }
      : closing === undefined
        ? {}
        : { closing: null }),
    ...(trainer == null ? {} : { trainer }),
    ...(assessments == null ? {} : { assessments }),
  }
  const welcome = settings.welcome
  return {
    ...input,
    settings: welcome ? { ...settings, welcome: serializeWelcome(welcome) } : settings,
  }
}

export interface WireProblem {
  path: string
  code: 'legacy_fields_with_steps'
  message: string
}

// The server's cross-field rule, as the mock enforces it on the body it
// receives: with steps, each legacy field must be null or absent. An absent
// playOnEnter is NOT empty: the server's model fills in its default (true).
export const legacyFieldProblems = (
  welcome: Partial<MapWelcome> | null | undefined
): WireProblem[] => {
  if (!welcome?.steps || welcome.steps.length === 0) return []
  const present: Record<string, boolean> = {
    title: welcome.title != null,
    message: welcome.message != null,
    video: welcome.video != null,
    playOnEnter: welcome.playOnEnter !== null,
  }
  return Object.keys(present)
    .filter((field) => present[field])
    .map((field) => ({
      path: `welcome.${field}`,
      code: 'legacy_fields_with_steps' as const,
      message: 'Leave this empty: when steps are defined they define the flow',
    }))
}
