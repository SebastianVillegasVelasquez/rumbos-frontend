import type { MapSettings } from './types.ts'

// The mock backend's answer to the trainer half of PUT /appearance, shaped like the
// contract's additive fields: a 422 carries errors[] { path, rule, message_key } and a
// save that went through may carry warnings[] of the same shape. Mock only: the real
// server is the authority, and its message keys are not published yet.

export interface WireIssue {
  path: string
  rule: string
  message_key: string
}

// The forms the mock knows. Anything else is "not found", like the real catalog.
export const MOCK_FORMS: readonly string[] = ['a1-form-a']

// `formsGone` (?mockFormsGone=1) stands for a form deleted after it was chosen.
export const trainerSettingsErrors = (settings: MapSettings, formsGone = false): WireIssue[] => {
  const errors: WireIssue[] = []
  const assessments = settings.assessments
  const steps = settings.welcome?.steps ?? []
  const stepIndex = steps.findIndex((step) => step.type === 'assessment')
  // The rule behind the reported failure: a check-in step needs the assessments on.
  if (stepIndex !== -1 && !assessments?.enabled)
    errors.push({
      path: `welcome.steps[${stepIndex}]`,
      rule: 'check_in_requires_assessments',
      message_key: 'assessment_step_needs_check_in',
    })
  if (assessments?.enabled) {
    for (const purpose of ['check_in', 'final'] as const) {
      const formId = assessments[purpose]?.form_id
      if (typeof formId !== 'string' || formId === '')
        errors.push({
          path: `assessments.${purpose}.form_id`,
          rule: 'form_required',
          message_key: 'form_required',
        })
      else if (formsGone || !MOCK_FORMS.includes(formId))
        errors.push({
          path: `assessments.${purpose}.form_id`,
          rule: 'form_exists',
          message_key: 'form_not_found',
        })
    }
  }
  return errors
}

// ?mockTrainerUnpublished=1 stands for "the form is not published yet".
export const trainerSettingsWarnings = (
  settings: MapSettings,
  unpublished: boolean
): WireIssue[] =>
  unpublished && (settings.trainer?.enabled || settings.assessments?.enabled)
    ? [{ path: 'trainer', rule: 'content_published', message_key: 'content_unpublished' }]
    : []
