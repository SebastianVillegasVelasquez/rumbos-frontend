import { useId, useState } from 'react'
import { announce } from '../../components/ui/announce.ts'
import { esTrainer } from '../../i18n/trainer.es.ts'
import { ClipPlayer } from '../audio/ClipPlayer.tsx'
import { splitTemplate } from '../assessment/answers.ts'
import { placePair, placeToken, removePair, removeToken, setGap } from './sessionReducer.ts'
import type { Step, StepResponse } from './types.ts'

const text = esTrainer.run

// The step types of the practice, one view each. They only show the question and
// report what the student has; the server grades. Reorder and match work with taps
// (no dragging) and are operable from the keyboard.

interface ViewProps<T extends Step = Step> {
  step: T
  draft: StepResponse | null
  disabled: boolean
  onDraft: (response: StepResponse | null) => void
  onSubmit: () => void
}

const Prompt = ({ id, children }: { id: string; children: string }) => (
  <p id={id} className="text-lg font-semibold">
    {children}
  </p>
)

const Choices = ({
  labelledBy,
  name,
  options,
  value,
  disabled,
  onPick,
}: {
  labelledBy: string
  name: string
  options: { option_id: string; text: string }[]
  value: string | null
  disabled: boolean
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
          disabled={disabled}
          onChange={() => onPick(option.option_id)}
        />
        <span className="exam-choice-mark" aria-hidden />
        <span>{option.text}</span>
      </label>
    ))}
  </div>
)

const chosen = (draft: StepResponse | null) =>
  draft && 'option_id' in draft ? draft.option_id : null
const valuesOf = (draft: StepResponse | null) => (draft && 'values' in draft ? draft.values : {})

const Choice = ({ step, draft, disabled, onDraft }: ViewProps) => {
  const id = useId()
  if (step.type !== 'mcq' && step.type !== 'listen_choose') return null
  return (
    <div className="flex flex-col gap-3">
      <Prompt id={id}>{step.prompt}</Prompt>
      {step.audio && (
        <ClipPlayer
          url={step.audio.url}
          label={step.prompt}
          transcript={step.audio.transcript}
          speeds
        />
      )}
      <Choices
        labelledBy={id}
        name={step.step_id}
        options={step.options}
        value={chosen(draft)}
        disabled={disabled}
        onPick={(option_id) => onDraft({ option_id })}
      />
    </div>
  )
}

const GapFill = ({ step, draft, disabled, onDraft }: ViewProps) => {
  const id = useId()
  if (step.type !== 'gap_fill') return null
  const values = valuesOf(draft)
  const pieces = splitTemplate(step.template)
  return (
    <div className="flex flex-col gap-3">
      <Prompt id={id}>{step.prompt}</Prompt>
      <p className="text-lg leading-10">
        {pieces.map((piece, index) => {
          if (piece.kind === 'text') return <span key={index}>{piece.value}</span>
          const n = pieces.slice(0, index + 1).filter((p) => p.kind === 'blank').length
          const gap = step.gaps.find((g) => g.gap_id === piece.value)
          const label = text.gap(n)
          return gap?.options ? (
            <select
              key={index}
              aria-label={label}
              className="exam-field exam-blank"
              value={values[piece.value] ?? ''}
              disabled={disabled}
              onChange={(event) => onDraft(setGap(draft, piece.value, event.target.value))}
            >
              <option value="">{text.chooseWord}</option>
              {gap.options.map((option) => (
                <option key={option.option_id} value={option.option_id}>
                  {option.text}
                </option>
              ))}
            </select>
          ) : (
            <input
              key={index}
              type="text"
              aria-label={label}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              className="exam-field exam-blank"
              value={values[piece.value] ?? ''}
              disabled={disabled}
              onChange={(event) => onDraft(setGap(draft, piece.value, event.target.value))}
            />
          )
        })}
      </p>
    </div>
  )
}

const Reorder = ({ step, draft, disabled, onDraft }: ViewProps) => {
  const id = useId()
  if (step.type !== 'reorder') return null
  const placed = draft && 'token_ids' in draft ? draft.token_ids : []
  const word = (tokenId: string) => step.tokens.find((t) => t.token_id === tokenId)?.text ?? ''
  const free = step.tokens.filter((t) => !placed.includes(t.token_id))
  return (
    <div className="flex flex-col gap-3">
      <Prompt id={id}>{step.prompt}</Prompt>
      <div>
        <p className="text-xs font-extrabold tracking-wide text-ink-soft uppercase">
          {text.yourOrder}
        </p>
        <ol
          aria-labelledby={id}
          className="flex min-h-[56px] flex-wrap items-center gap-2 rounded-md border-soft bg-surface-muted p-2"
        >
          {placed.length === 0 && <li className="text-sm text-ink-soft">{text.yourOrderEmpty}</li>}
          {placed.map((tokenId) => (
            <li key={tokenId}>
              <button
                type="button"
                className="exam-pick"
                data-paired="true"
                disabled={disabled}
                aria-label={text.takeBack(word(tokenId))}
                onClick={() => {
                  onDraft(removeToken(draft, tokenId))
                  announce(text.takeBack(word(tokenId)))
                }}
              >
                {word(tokenId)}
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div>
        <p className="text-xs font-extrabold tracking-wide text-ink-soft uppercase">
          {text.available}
        </p>
        <ul className="flex flex-wrap gap-2">
          {free.map((token) => (
            <li key={token.token_id}>
              <button
                type="button"
                className="exam-pick"
                disabled={disabled}
                aria-label={text.place(token.text)}
                onClick={() => onDraft(placeToken(draft, token.token_id))}
              >
                {token.text}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

const Match = ({ step, draft, disabled, onDraft }: ViewProps) => {
  const id = useId()
  const [picked, setPicked] = useState<{ side: 'left' | 'right'; id: string } | null>(null)
  if (step.type !== 'match') return null
  const pairs = draft && 'pairs' in draft ? draft.pairs : []
  const word = (side: 'left' | 'right', itemId: string) =>
    (side === 'left' ? step.left : step.right).find((x) => x.id === itemId)?.text ?? ''
  const rightOf = (leftId: string) => pairs.find(([l]) => l === leftId)?.[1] ?? null
  const leftOf = (rightId: string) => pairs.find(([, r]) => r === rightId)?.[0] ?? null

  const pick = (side: 'left' | 'right', itemId: string) => {
    if (picked && picked.side !== side) {
      const left = side === 'left' ? itemId : picked.id
      const right = side === 'right' ? itemId : picked.id
      onDraft(placePair(draft, left, right))
      setPicked(null)
      announce(text.pairedWith(word('left', left), word('right', right)))
      return
    }
    setPicked(picked?.side === side && picked.id === itemId ? null : { side, id: itemId })
  }

  const column = (side: 'left' | 'right') => (
    <ul aria-label={side === 'left' ? text.left : text.right} className="flex flex-col gap-2">
      {(side === 'left' ? step.left : step.right).map((entry) => {
        const mate = side === 'left' ? rightOf(entry.id) : leftOf(entry.id)
        const on = picked?.side === side && picked.id === entry.id
        return (
          <li key={entry.id} className="flex flex-col gap-1">
            <button
              type="button"
              className="exam-pick"
              aria-pressed={on}
              data-paired={mate !== null}
              disabled={disabled}
              aria-label={
                mate
                  ? text.pairedWith(
                      side === 'left' ? entry.text : word('left', mate),
                      side === 'left' ? word('right', mate) : entry.text
                    )
                  : on
                    ? text.selected(entry.text)
                    : entry.text
              }
              onClick={() => pick(side, entry.id)}
            >
              <span>{entry.text}</span>
              {mate && (
                <span className="exam-pick-tag" aria-hidden>
                  {side === 'left' ? word('right', mate) : word('left', mate)}
                </span>
              )}
            </button>
            {side === 'left' && mate && (
              <button
                type="button"
                className="min-h-[44px] self-start px-1 text-sm font-bold text-primary underline underline-offset-4"
                disabled={disabled}
                onClick={() => onDraft(removePair(draft, entry.id))}
              >
                {text.unpair(entry.text)}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )

  return (
    <div className="flex flex-col gap-3">
      <Prompt id={id}>{step.prompt}</Prompt>
      <p className="text-sm text-ink-soft">{text.matchHelp}</p>
      <div className="grid gap-4 md:grid-cols-2">
        {column('left')}
        {column('right')}
      </div>
    </div>
  )
}

const ShortAnswer = ({ step, draft, disabled, onDraft, onSubmit }: ViewProps) => {
  const id = useId()
  const fieldId = useId()
  if (step.type !== 'short_answer') return null
  const value = draft && 'text' in draft ? draft.text : ''
  return (
    <div className="flex flex-col gap-3">
      <Prompt id={id}>{step.prompt}</Prompt>
      <label htmlFor={fieldId} className="sr-only">
        {text.typeHere}
      </label>
      <textarea
        id={fieldId}
        aria-describedby={id}
        className="exam-field min-h-[112px]"
        maxLength={step.max_length}
        autoComplete="off"
        spellCheck
        value={value}
        disabled={disabled}
        onChange={(event) => onDraft({ text: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) onSubmit()
        }}
      />
      <p className="text-xs font-semibold text-ink-soft">
        {text.charsLeft(step.max_length - value.length)}
      </p>
    </div>
  )
}

// S4: a scripted partner (a role, never a name), and the student chooses or types.
const DialogueTurn = ({ step, draft, disabled, onDraft, onSubmit }: ViewProps) => {
  const id = useId()
  const fieldId = useId()
  const [translated, setTranslated] = useState(false)
  if (step.type !== 'dialogue_turn') return null
  const copy = esTrainer.dialogue
  const line = step.partner_line
  const value = draft && 'text' in draft ? draft.text : ''
  const append = (word: string) =>
    onDraft({ text: value.trim() === '' ? word : `${value.replace(/\s+$/, '')} ${word}` })
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_260px]">
      <div className="flex flex-col gap-3">
        <div className="max-w-[85%] self-start rounded-lg border-soft bg-surface-muted p-3">
          <p id={id} className="text-base font-semibold">
            {line.text}
          </p>
          {line.audio && (
            <ClipPlayer
              url={line.audio.url}
              label={copy.listen}
              transcript={line.audio.transcript}
              speeds
            />
          )}
          {line.translation && (
            <>
              <button
                type="button"
                aria-expanded={translated}
                className="mt-1 min-h-[44px] text-sm font-bold text-primary underline underline-offset-4"
                onClick={() => setTranslated((v) => !v)}
              >
                {translated ? text.hideTranslation : text.showTranslation}
              </button>
              {translated && <p className="text-sm text-ink-soft">{line.translation}</p>}
            </>
          )}
        </div>
        <p className="text-sm font-semibold text-ink-soft">{step.prompt}</p>
        {step.mode === 'choose' && step.options ? (
          <Choices
            labelledBy={id}
            name={step.step_id}
            options={step.options}
            value={chosen(draft)}
            disabled={disabled}
            onPick={(option_id) => onDraft({ option_id })}
          />
        ) : (
          <div className="flex flex-col gap-2">
            <label
              htmlFor={fieldId}
              className="text-xs font-extrabold tracking-wide text-ink-soft uppercase"
            >
              {copy.type}
            </label>
            <textarea
              id={fieldId}
              className="exam-field min-h-[88px]"
              autoComplete="off"
              spellCheck
              value={value}
              disabled={disabled}
              onChange={(event) => onDraft({ text: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  onSubmit()
                }
              }}
            />
          </div>
        )}
      </div>
      {(step.starters.length > 0 || step.word_bank.length > 0 || step.hint) && (
        <aside
          aria-label={copy.help}
          className="flex max-h-[170px] flex-col gap-3 overflow-y-auto rounded-md border-hair bg-surface-muted p-3 md:max-h-none"
        >
          <h3 className="text-sm font-extrabold">{copy.help}</h3>
          {step.hint && <p className="text-sm">{step.hint}</p>}
          {step.mode === 'type' && step.starters.length > 0 && (
            <div>
              <p className="text-xs font-extrabold tracking-wide text-ink-soft uppercase">
                {copy.starters}
              </p>
              <ul className="flex flex-wrap gap-2">
                {step.starters.map((starter) => (
                  <li key={starter}>
                    <button
                      type="button"
                      className="exam-pick"
                      disabled={disabled}
                      aria-label={copy.useStarter(starter)}
                      onClick={() => onDraft({ text: starter })}
                    >
                      {starter}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {step.mode === 'type' && step.word_bank.length > 0 && (
            <div>
              <p className="text-xs font-extrabold tracking-wide text-ink-soft uppercase">
                {copy.wordBank}
              </p>
              <ul className="flex flex-wrap gap-2">
                {step.word_bank.map((word) => (
                  <li key={word}>
                    <button
                      type="button"
                      className="exam-pick"
                      disabled={disabled}
                      onClick={() => append(word)}
                    >
                      {word}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      )}
    </div>
  )
}

export const StepView = (props: ViewProps) => {
  switch (props.step.type) {
    case 'mcq':
    case 'listen_choose':
      return <Choice {...props} />
    case 'gap_fill':
      return <GapFill {...props} />
    case 'reorder':
      return <Reorder {...props} />
    case 'match':
      return <Match {...props} />
    case 'short_answer':
      return <ShortAnswer {...props} />
    case 'dialogue_turn':
      return <DialogueTurn {...props} />
  }
}
