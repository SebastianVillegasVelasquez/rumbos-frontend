import { ContractError, Issues, isRecord, kindOf } from '../../course-map/data/contract.ts'

// The exam forms an editor can pick, from GET /trainer/assessments/forms (editors only):
// every form of the deployed content, drafts included, so a map can be set up before the
// form is published (saving it only warns). Nothing here chooses one for the author.

export const FORM_PUBLICATION_STATES = ['draft', 'reviewed', 'published'] as const
export type FormPublicationState = (typeof FORM_PUBLICATION_STATES)[number]

export const FORM_PURPOSES = ['check_in', 'final'] as const
export type FormPurpose = (typeof FORM_PURPOSES)[number]

// `language`, `level` and `purpose` are required by the contract; they stay optional here
// so a backend that predates them still fills the picker (the option then has no level).
export interface AssessmentForm {
  id: string
  title: string
  language?: string
  level?: string
  purpose?: FormPurpose
  publication_state: FormPublicationState
}

// What the picker knows about the list: it never invents a form when the list is missing.
export interface FormsState {
  forms: readonly AssessmentForm[]
  loading: boolean
  failed: boolean
}

export const FORMS_ENDPOINT = 'GET /trainer/assessments/forms'

// Checked at the edge, like the catalog: a list the picker cannot read is a ContractError
// naming the endpoint and the fields, not an empty picker.
export const parseForms = (value: unknown, endpoint = FORMS_ENDPOINT): AssessmentForm[] => {
  if (!Array.isArray(value))
    throw new ContractError(endpoint, [`body: expected an array, got ${kindOf(value)}`])
  const issues = new Issues()
  value.forEach((item, index) => {
    const path = `[${index}]`
    if (!isRecord(item)) return issues.add(path, 'an object', item)
    issues.string(`${path}.id`, item.id)
    issues.string(`${path}.title`, item.title)
    if (item.language !== undefined) issues.string(`${path}.language`, item.language)
    if (item.level !== undefined) issues.string(`${path}.level`, item.level)
    if (item.purpose !== undefined) issues.oneOf(`${path}.purpose`, item.purpose, FORM_PURPOSES)
    issues.oneOf(`${path}.publication_state`, item.publication_state, FORM_PUBLICATION_STATES)
  })
  issues.settle(endpoint)
  return value as AssessmentForm[]
}
