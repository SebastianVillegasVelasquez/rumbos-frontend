import {
  FLOW_LIMITS,
  type WelcomeHtmlStep,
  type WelcomeStep,
  type WelcomeStepType,
} from '../../course-map/data/types.ts'
import { newStepKey } from '../flow/flowSteps.ts'

// The editor's operations on the list of steps, pure so they can be tested: add,
// duplicate, delete, move, change, ask again. Every one returns a new list and
// keeps the rules the backend enforces: at most 12 steps, at most 3 quizzes, a
// single welcome step and only in the first place, unique keys.

export interface NewStepLabels {
  welcome: string
  video: string
  html: string
  pdf: string
  quiz: string
}

export type AddRefusal = 'too_many' | 'quiz_too_many' | 'welcome_exists'

export const canAdd = (steps: readonly WelcomeStep[], type: WelcomeStepType): AddRefusal | null => {
  if (steps.length >= FLOW_LIMITS.stepsMax) return 'too_many'
  if (type === 'quiz' && steps.filter((step) => step.type === 'quiz').length >= FLOW_LIMITS.quizMax)
    return 'quiz_too_many'
  if (type === 'welcome' && steps.some((step) => step.type === 'welcome')) return 'welcome_exists'
  return null
}

// A new step. Only steps the editor creates start mandatory.
export const createStep = (
  type: WelcomeStepType,
  steps: readonly WelcomeStep[],
  labels: NewStepLabels,
  random?: () => number
): WelcomeStep => {
  const common = {
    key: newStepKey(
      steps.map((step) => step.key),
      random
    ),
    title: labels[type],
    mandatory: true,
    revision: 1,
  }
  switch (type) {
    case 'welcome':
      return { ...common, type, message: null, buttonLabel: null }
    case 'video':
      return {
        ...common,
        type,
        video: { provider: 'youtube', videoId: '' },
        allowFallback: false,
      }
    case 'html':
      return { ...common, type, html: '', css: null, ack: null, minSeconds: 0 }
    case 'pdf':
      return { ...common, type, assetId: '', ack: null, minSeconds: 0 }
    case 'quiz':
      return { ...common, type, cmid: null, intro: null, outcomeAbove: null, outcomeBelow: null }
  }
}

// Insert a step: a welcome step always goes first, the others at the end.
export const addStep = (steps: readonly WelcomeStep[], step: WelcomeStep): WelcomeStep[] =>
  step.type === 'welcome' ? [step, ...steps] : [...steps, step]

export const duplicateStep = (
  steps: readonly WelcomeStep[],
  index: number,
  copySuffix: string,
  random?: () => number
): WelcomeStep[] => {
  const source = steps[index]
  if (!source || source.type === 'welcome' || canAdd(steps, source.type)) return [...steps]
  const copy: WelcomeStep = {
    ...source,
    key: newStepKey(
      steps.map((step) => step.key),
      random
    ),
    title: `${source.title} ${copySuffix}`.slice(0, FLOW_LIMITS.stepTitleMax),
    revision: 1,
  }
  return [...steps.slice(0, index + 1), copy, ...steps.slice(index + 1)]
}

export const deleteStep = (steps: readonly WelcomeStep[], index: number): WelcomeStep[] =>
  steps.filter((_, position) => position !== index)

// The welcome step stays first: it cannot move, and nothing moves above it.
export const canMove = (steps: readonly WelcomeStep[], index: number, delta: -1 | 1): boolean => {
  const target = index + delta
  if (target < 0 || target >= steps.length || index < 0) return false
  if (steps[index].type === 'welcome' || steps[target].type === 'welcome') return false
  return true
}

export const moveStep = (
  steps: readonly WelcomeStep[],
  index: number,
  delta: -1 | 1
): WelcomeStep[] => {
  if (!canMove(steps, index, delta)) return [...steps]
  const next = [...steps]
  const target = index + delta
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

export const updateStep = (
  steps: readonly WelcomeStep[],
  index: number,
  patch: Partial<WelcomeStep>
): WelcomeStep[] =>
  steps.map((step, position) =>
    position === index
      ? ({ ...step, ...patch, key: step.key, type: step.type } as WelcomeStep)
      : step
  )

// "Pedir de nuevo a quienes ya lo completaron": a higher revision makes the
// record Moodle holds of the step stale, so it is asked again.
export const askAgain = (steps: readonly WelcomeStep[], index: number): WelcomeStep[] =>
  steps.map((step, position) =>
    position === index ? { ...step, revision: Math.min(step.revision + 1, 1_000_000) } : step
  )

// ---- Starter templates for the html step ------------------------------------------

export type TemplateId = 'rules' | 'agreement' | 'instructions'

export interface StarterTemplate {
  id: TemplateId
  html: string
  css: string
  ack: string | null
  minSeconds: number
}

const BASE_CSS =
  'h2{margin:0 0 .5em;font-size:1.4em}ul,ol{padding-left:1.2em}li{margin:.35em 0}p{margin:.6em 0}'

// Plain markup inside the allowed tags and no external resource: they pass the
// same checks as anything the author writes.
export const STARTER_TEMPLATES: Record<TemplateId, StarterTemplate> = {
  rules: {
    id: 'rules',
    html: '<h2>Reglas del curso</h2><ul><li>Trata a todas las personas con respeto.</li><li>Entrega tus actividades a tiempo.</li><li>Pregunta cuando tengas dudas.</li></ul>',
    css: BASE_CSS,
    ack: 'Leí y acepto las reglas',
    minSeconds: 5,
  },
  agreement: {
    id: 'agreement',
    html: '<h2>Acuerdo de participación</h2><p>Al continuar confirmas que participarás de buena fe y que el material del curso es solo para tu aprendizaje.</p>',
    css: BASE_CSS,
    ack: 'Estoy de acuerdo',
    minSeconds: 3,
  },
  instructions: {
    id: 'instructions',
    html: '<h2>Cómo funciona este curso</h2><ol><li>Abre cada burbuja del mapa.</li><li>Completa la actividad.</li><li>Avanza al siguiente nivel.</li></ol>',
    css: BASE_CSS,
    ack: null,
    minSeconds: 0,
  },
}

export const applyTemplate = (step: WelcomeHtmlStep, id: TemplateId): WelcomeHtmlStep => {
  const template = STARTER_TEMPLATES[id]
  return {
    ...step,
    html: template.html,
    css: template.css,
    ack: template.ack === null ? null : { label: template.ack },
    minSeconds: template.minSeconds,
  }
}
