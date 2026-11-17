import { useId, useState } from 'react'
import { announce } from '../../components/ui/announce.ts'
import { esAssessment } from '../../i18n/assessment.es.ts'
import { ClipPlayer } from '../audio/ClipPlayer.tsx'
import {
  clipAt,
  pairUp,
  placeOf,
  splitTemplate,
  templateWordCount,
  unpair,
  wordLimit,
  type Pair,
} from './answers.ts'
import { SceneIcon } from './SceneIcons.tsx'
import type {
  AssessmentItem,
  ItemOption,
  ItemResponse,
  MatchAudioItem,
  SharedContent,
} from './types.ts'

const text = esAssessment.items

// The seven item types of Forma A. Each view shows the question and reports the
// student's answer; none of them knows a key or a correct answer. Choices are
// native radios (keyboard and screen reader for free); matching works with taps or
// keys, without drag and drop.

interface ViewProps<T extends AssessmentItem> {
  item: T
  number: number
  response: ItemResponse | undefined
  onChange: (response: ItemResponse) => void
}

const Question = ({ number, prompt, id }: { number: number; prompt: string; id: string }) => (
  <>
    <p className="text-sm font-extrabold tracking-wide text-primary uppercase">
      {esAssessment.runner.question(number)}
    </p>
    <p id={id} className="text-lg font-semibold">
      {prompt}
    </p>
  </>
)

const Choices = ({
  name,
  labelledBy,
  options,
  value,
  onPick,
}: {
  name: string
  labelledBy: string
  options: ItemOption[]
  value: string | null
  onPick: (id: string) => void
}) => (
  <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-col gap-2">
    {options.map((option) => (
      <label key={option.option_id} className="exam-choice">
        <input
          type="radio"
          name={name}
          value={option.option_id}
          checked={value === option.option_id}
          onChange={() => onPick(option.option_id)}
        />
        <span className="exam-choice-mark" aria-hidden />
        <span>{option.text}</span>
      </label>
    ))}
  </div>
)

const optionOf = (response: ItemResponse | undefined) =>
  response && 'option_id' in response ? response.option_id : null

const valuesOf = (response: ItemResponse | undefined): Record<string, string> =>
  response && 'values' in response ? response.values : {}

const ChoiceItem = ({
  item,
  number,
  response,
  onChange,
}: ViewProps<Extract<AssessmentItem, { options: ItemOption[] }>>) => {
  const id = useId()
  return (
    <div className="flex flex-col gap-3">
      <Question number={number} prompt={item.prompt} id={id} />
      {item.type === 'gap_choice' && (
        <p className="rounded-md bg-surface-muted px-3 py-2 font-semibold">{item.gap_label}</p>
      )}
      {item.type === 'listen_choose' && (
        <ClipPlayer url={item.audio.url} label={esAssessment.runner.question(number)} />
      )}
      <Choices
        name={item.item_id}
        labelledBy={id}
        options={item.options}
        value={optionOf(response)}
        onPick={(option_id) => onChange({ option_id })}
      />
    </div>
  )
}

const MatchAudio = ({ item, number, response, onChange }: ViewProps<MatchAudioItem>) => {
  const id = useId()
  const pairs: Pair[] = response && 'pairs' in response ? response.pairs : []
  const [picked, setPicked] = useState<{ side: 'clip' | 'place'; id: string } | null>(null)
  const copy = text.match

  const commit = (next: Pair[]) => onChange({ pairs: next })
  const pick = (side: 'clip' | 'place', itemId: string) => {
    if (picked && picked.side !== side) {
      const clip = side === 'clip' ? itemId : picked.id
      const place = side === 'place' ? itemId : picked.id
      commit(pairUp(pairs, clip, place))
      setPicked(null)
      announce(copy.joined)
      return
    }
    // The same one again lets it go; the other side's pick is replaced.
    setPicked(picked?.side === side && picked.id === itemId ? null : { side, id: itemId })
  }
  const clipNumber = (clipId: string) => item.clips.findIndex((c) => c.id === clipId) + 1

  return (
    <div className="flex flex-col gap-3">
      <Question number={number} prompt={item.prompt} id={id} />
      <p className="text-sm text-ink-soft">{copy.hint}</p>
      <div className="grid gap-4 md:grid-cols-2">
        <ul aria-label={copy.clips} className="flex flex-col gap-3">
          {item.clips.map((clip, index) => {
            const place = placeOf(pairs, clip.id)
            const placeText = item.places.find((p) => p.id === place)?.text ?? ''
            return (
              <li
                key={clip.id}
                className="flex flex-col gap-2 rounded-md border-soft bg-surface p-3"
              >
                <ClipPlayer url={clip.audio.url} label={text.audioLabel(index + 1)} />
                <button
                  type="button"
                  className="exam-pick"
                  aria-pressed={picked?.side === 'clip' && picked.id === clip.id}
                  data-paired={place !== null}
                  aria-label={
                    place
                      ? copy.clipPaired(index + 1, placeText)
                      : picked?.side === 'clip' && picked.id === clip.id
                        ? copy.clipSelected(index + 1)
                        : text.audioLabel(index + 1)
                  }
                  onClick={() => pick('clip', clip.id)}
                >
                  <span className="exam-pick-tag" aria-hidden>
                    {index + 1}
                  </span>
                  <span>{place ? placeText : text.audioLabel(index + 1)}</span>
                </button>
                {place && (
                  <button
                    type="button"
                    className="min-h-[44px] self-start px-1 text-sm font-bold text-primary underline underline-offset-4"
                    onClick={() => commit(unpair(pairs, clip.id))}
                  >
                    {copy.remove}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
        <ul aria-label={copy.places} className="grid grid-cols-2 gap-3">
          {item.places.map((place) => {
            const clip = clipAt(pairs, place.id)
            return (
              <li key={place.id}>
                <button
                  type="button"
                  className="exam-pick"
                  data-tile="true"
                  aria-pressed={picked?.side === 'place' && picked.id === place.id}
                  data-paired={clip !== null}
                  aria-label={clip ? copy.placePaired(place.text, clipNumber(clip)) : place.text}
                  onClick={() => pick('place', place.id)}
                >
                  <SceneIcon text={place.text} />
                  <span>{place.text}</span>
                  {clip && (
                    <span className="exam-pick-tag" aria-hidden>
                      {clipNumber(clip)}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

const FormFields = ({
  item,
  number,
  response,
  onChange,
}: ViewProps<Extract<AssessmentItem, { type: 'form_fields' }>>) => {
  const id = useId()
  const values = valuesOf(response)
  return (
    <div className="flex flex-col gap-3">
      <Question number={number} prompt={item.prompt} id={id} />
      <div role="group" aria-labelledby={id} className="flex flex-col gap-3">
        {item.fields.map((field) => (
          <label key={field.field_id} className="flex flex-col gap-1 text-sm font-bold">
            {field.label}
            <input
              className="exam-field text-base font-medium"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={values[field.field_id] ?? ''}
              onChange={(event) =>
                onChange({ values: { ...values, [field.field_id]: event.target.value } })
              }
            />
          </label>
        ))}
      </div>
    </div>
  )
}

const WrittenAnswers = ({
  item,
  number,
  response,
  onChange,
}: ViewProps<Extract<AssessmentItem, { type: 'written_answers' }>>) => {
  const id = useId()
  const values = valuesOf(response)
  return (
    <div className="flex flex-col gap-3">
      <Question number={number} prompt={item.prompt} id={id} />
      {item.questions.map((question) => (
        <label key={question.q_id} className="flex flex-col gap-1 text-sm font-bold">
          {question.prompt}
          <textarea
            className="exam-field min-h-[88px] text-base font-medium"
            autoComplete="off"
            rows={3}
            value={values[question.q_id] ?? ''}
            onChange={(event) =>
              onChange({ values: { ...values, [question.q_id]: event.target.value } })
            }
          />
        </label>
      ))}
    </div>
  )
}

const TemplateText = ({
  item,
  number,
  response,
  onChange,
}: ViewProps<Extract<AssessmentItem, { type: 'template_text' }>>) => {
  const id = useId()
  const counterId = useId()
  const values = valuesOf(response)
  const pieces = splitTemplate(item.template)
  const count = templateWordCount(item.template, response)
  const limit = wordLimit(count, item.min_words, item.max_words)
  let blank = 0
  return (
    <div className="flex flex-col gap-3">
      <Question number={number} prompt={item.prompt} id={id} />
      <div
        role="group"
        aria-labelledby={id}
        aria-describedby={counterId}
        className="rounded-md bg-surface-muted p-4 leading-[2.6] text-lg"
      >
        {pieces.map((piece, index) =>
          piece.kind === 'text' ? (
            <span key={index}>{piece.value}</span>
          ) : (
            <input
              key={index}
              className="exam-field exam-blank"
              aria-label={text.blank(++blank)}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={values[piece.value] ?? ''}
              onChange={(event) =>
                onChange({ values: { ...values, [piece.value]: event.target.value } })
              }
            />
          )
        )}
      </div>
      {/* Not a live region: a count announced on every key would drown the student. */}
      <p id={counterId} className="flex flex-wrap items-center gap-x-3 text-sm font-bold">
        <span>{text.wordsCounter(count, item.min_words, item.max_words)}</span>
        <span className="rounded-md border-hair px-2 py-0.5" data-limit={limit}>
          {limit === 'below'
            ? `▼ ${text.wordsBelow(item.min_words - count)}`
            : limit === 'above'
              ? `▲ ${text.wordsAbove(count - item.max_words)}`
              : `✓ ${text.wordsWithin}`}
        </span>
      </p>
    </div>
  )
}

export const ItemView = (props: ViewProps<AssessmentItem>) => {
  const { item } = props
  switch (item.type) {
    case 'mcq':
    case 'listen_choose':
    case 'gap_choice':
      return <ChoiceItem {...props} item={item} />
    case 'match_audio':
      return <MatchAudio {...props} item={item} />
    case 'form_fields':
      return <FormFields {...props} item={item} />
    case 'template_text':
      return <TemplateText {...props} item={item} />
    case 'written_answers':
      return <WrittenAnswers {...props} item={item} />
  }
}

// What a part shares between its items: a passage, a sign, an image or a clip.
export const SharedBlock = ({ shared }: { shared: SharedContent }) => (
  <div className="flex flex-col items-start gap-3">
    {shared.sign && (
      <p className="exam-sign" aria-label={`${esAssessment.runner.sign}: ${shared.sign}`}>
        {shared.sign}
      </p>
    )}
    {shared.text && <p className="exam-passage">{shared.text}</p>}
    {shared.passage && <div className="exam-passage whitespace-pre-line">{shared.passage}</div>}
    {shared.image && (
      <img
        src={shared.image.url}
        alt={shared.image.alt}
        className="max-w-full rounded-md border-soft"
      />
    )}
    {shared.audio && <ClipPlayer url={shared.audio.url} label={esAssessment.runner.shared} />}
  </div>
)
