import { FLOW_LIMITS, type MapWelcome, type WelcomeStep } from '../../course-map/data/types.ts'
import { isVideoId } from '../../content/validateContent.ts'
import { findCssIssue, findHtmlIssue } from './htmlCheck.ts'

// The welcome flow's model rules, free of React and the DOM: the legacy
// derivation, step keys and a client-side mirror of the backend's validation.

export const LEGACY_WELCOME_KEY = 'legacywelcome'
export const LEGACY_VIDEO_KEY = 'legacyvideo'

export interface LegacyLabels {
  // Titles for the derived steps (from the i18n dictionary).
  welcomeTitle: string
  videoTitle: string
}

// Maps without `steps` keep today's curtain: this is the flow that is
// equivalent to it. Keys are fixed so progress and the editor's first save agree.
// The video step is NOT mandatory: today's curtain never forces the video.
export const deriveLegacySteps = (welcome: MapWelcome, labels: LegacyLabels): WelcomeStep[] => {
  const steps: WelcomeStep[] = [
    {
      type: 'welcome',
      key: LEGACY_WELCOME_KEY,
      title: (welcome.title?.trim() || labels.welcomeTitle).slice(0, FLOW_LIMITS.stepTitleMax),
      mandatory: true,
      revision: 1,
      message: welcome.message,
      buttonLabel: null,
    },
  ]
  if (welcome.video)
    steps.push({
      type: 'video',
      key: LEGACY_VIDEO_KEY,
      title: labels.videoTitle,
      mandatory: false,
      revision: 1,
      video: welcome.video,
      allowFallback: true,
    })
  return steps
}

// What the player runs: the configured steps, or the legacy derivation.
export const effectiveSteps = (welcome: MapWelcome, labels: LegacyLabels): WelcomeStep[] =>
  welcome.steps && welcome.steps.length > 0 ? welcome.steps : deriveLegacySteps(welcome, labels)

export const hasConfiguredFlow = (welcome: MapWelcome): boolean =>
  Array.isArray(welcome.steps) && welcome.steps.length > 0

// What the editor saves on the first change of a legacy welcome: the derived
// steps, with the four legacy fields cleared (the backend refuses both at once).
export const convertLegacyToSteps = (welcome: MapWelcome, labels: LegacyLabels): MapWelcome => ({
  ...welcome,
  title: null,
  message: null,
  video: null,
  playOnEnter: true,
  steps: deriveLegacySteps(welcome, labels),
})

const KEY_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
const KEY_LENGTH = 10

// A new, unique key matching ^[a-z0-9]{6,16}$. `random` is injected so tests are
// deterministic; the default is the browser's CSPRNG.
export const newStepKey = (
  taken: Iterable<string>,
  random: () => number = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32
): string => {
  const used = new Set(taken)
  for (;;) {
    let key = ''
    for (let i = 0; i < KEY_LENGTH; i++)
      key += KEY_ALPHABET[Math.floor(random() * KEY_ALPHABET.length)]
    if (!used.has(key)) return key
  }
}

// ---- Validation ---------------------------------------------------------------

// The contract's codes, plus three the client adds (marked) for what the brief
// states as limits without naming a code. The backend's answer always wins.
export type FlowProblemCode =
  | 'legacy_fields_with_steps'
  | 'step_key_duplicate'
  | 'step_type_invalid'
  | 'welcome_step_position'
  | 'html_forbidden_markup'
  | 'css_forbidden'
  | 'document_unavailable'
  | 'steps_too_many'
  | 'flow_too_large'
  | 'video_invalid'
  | 'quiz_too_many'
  // Client only (ASSUMPTION: the brief gives the limits, not a code):
  | 'step_key_invalid'
  | 'step_title_invalid'
  | 'step_field_invalid'

export interface FlowProblem {
  // e.g. "steps[2].html", the field the editor marks.
  path: string
  code: FlowProblemCode
}

export interface FlowValidationContext {
  // Asset ids of documents the server can serve; undefined skips the check.
  availableDocuments?: ReadonlySet<string>
}

const STEP_TYPES: readonly string[] = ['welcome', 'video', 'html', 'pdf', 'quiz']
const byteLength = (text: string) => new TextEncoder().encode(text).length

const validateStep = (
  step: WelcomeStep,
  index: number,
  context: FlowValidationContext
): FlowProblem[] => {
  const base = `steps[${index}]`
  const problems: FlowProblem[] = []
  const add = (field: string, code: FlowProblemCode) =>
    problems.push({ path: field ? `${base}.${field}` : base, code })
  if (!STEP_TYPES.includes((step as { type: string }).type)) {
    add('type', 'step_type_invalid')
    return problems
  }
  if (!FLOW_LIMITS.keyPattern.test(step.key)) add('key', 'step_key_invalid')
  const title = step.title.trim()
  if (title.length < 1 || step.title.length > FLOW_LIMITS.stepTitleMax)
    add('title', 'step_title_invalid')
  if (!Number.isInteger(step.revision) || step.revision < 1) add('revision', 'step_field_invalid')
  switch (step.type) {
    case 'welcome':
      // The brief gives no limits for the message or the button label: the
      // backend answer decides, the mirror does not invent any.
      break
    case 'video':
      if (!isVideoId(step.video.provider, step.video.videoId)) add('video', 'video_invalid')
      break
    case 'html': {
      if (byteLength(step.html) > FLOW_LIMITS.htmlMaxBytes) add('html', 'flow_too_large')
      else if (findHtmlIssue(step.html) !== null) add('html', 'html_forbidden_markup')
      if (step.css !== null) {
        if (byteLength(step.css) > FLOW_LIMITS.cssMaxBytes) add('css', 'flow_too_large')
        else if (findCssIssue(step.css) !== null) add('css', 'css_forbidden')
      }
      validateAcknowledgement(step, add)
      break
    }
    case 'pdf':
      if (!step.assetId) add('assetId', 'document_unavailable')
      else if (context.availableDocuments && !context.availableDocuments.has(step.assetId))
        add('assetId', 'document_unavailable')
      validateAcknowledgement(step, add)
      break
    case 'quiz':
      if (step.cmid !== null && (!Number.isSafeInteger(step.cmid) || step.cmid <= 0))
        add('cmid', 'step_field_invalid')
      break
  }
  return problems
}

const validateAcknowledgement = (
  step: { ack: { label: string } | null; minSeconds: number },
  add: (field: string, code: FlowProblemCode) => void
) => {
  if (step.ack && (step.ack.label.trim().length < 1 || step.ack.label.length > 160))
    add('ack', 'step_field_invalid')
  if (
    !Number.isInteger(step.minSeconds) ||
    step.minSeconds < 0 ||
    step.minSeconds > FLOW_LIMITS.minSecondsMax
  )
    add('minSeconds', 'step_field_invalid')
}

export const validateFlow = (
  welcome: MapWelcome | null | undefined,
  context: FlowValidationContext = {}
): FlowProblem[] => {
  const steps = welcome?.steps
  if (!welcome || !steps) return []
  const problems: FlowProblem[] = []
  if (welcome.title !== null || welcome.message !== null || welcome.video !== null)
    problems.push({ path: 'legacy', code: 'legacy_fields_with_steps' })
  if (steps.length > FLOW_LIMITS.stepsMax) problems.push({ path: 'steps', code: 'steps_too_many' })
  const seen = new Set<string>()
  steps.forEach((step, index) => {
    if (seen.has(step.key))
      problems.push({ path: `steps[${index}].key`, code: 'step_key_duplicate' })
    seen.add(step.key)
    if (step.type === 'welcome' && index !== 0)
      problems.push({ path: `steps[${index}]`, code: 'welcome_step_position' })
    problems.push(...validateStep(step, index, context))
  })
  if (
    steps.filter((step) => step.type === 'welcome').length > 1 &&
    !problems.some((p) => p.code === 'welcome_step_position')
  )
    problems.push({ path: 'steps', code: 'welcome_step_position' })
  if (steps.filter((step) => step.type === 'quiz').length > FLOW_LIMITS.quizMax)
    problems.push({ path: 'steps', code: 'quiz_too_many' })
  return problems
}
