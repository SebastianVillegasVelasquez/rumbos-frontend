import { useEffect, useReducer, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Button } from '../../components/ui/Button.tsx'
import { esTrainer } from '../../i18n/trainer.es.ts'
import { trainerApi } from './api.ts'
import { dueWords, reviewReducer, startReview } from './reviewReducer.ts'
import { TrainerCard } from './TrainerCard.tsx'
import { newAttemptId } from './useSession.ts'
import type { SavedWord } from './types.ts'

const text = esTrainer

// S9: progress by skill, the latest activities, and "Mi vocabulario" with the way
// into the review. Skills are text and a bar of cells, never color alone.
export const Progress = ({ onBack, onReview }: { onBack: () => void; onReview: () => void }) => {
  const ref = useRef<HTMLHeadingElement>(null)
  const client = useQueryClient()
  useEffect(() => ref.current?.focus(), [])
  const progress = useQuery({ queryKey: ['trainer', 'progress'], queryFn: trainerApi.progress })
  const vocab = useQuery({ queryKey: ['trainer', 'vocabulary'], queryFn: trainerApi.vocabulary })

  return (
    <TrainerCard
      ref={ref}
      title={text.progress.title}
      footer={
        <>
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft size={18} strokeWidth={3} aria-hidden />
            {text.backToHome}
          </Button>
          {(vocab.data?.due_count ?? 0) > 0 && (
            <Button onClick={onReview}>{text.vocab.review}</Button>
          )}
        </>
      }
    >
      {progress.isError || vocab.isError ? (
        <p role="alert" className="font-semibold text-danger">
          {text.errors.unreachable}
        </p>
      ) : (
        <>
          <section>
            <h3 className="text-sm font-extrabold">{text.progress.bySkill}</h3>
            <ul className="mt-2 flex flex-col gap-2">
              {(progress.data?.by_skill ?? []).map((entry) => {
                const cells = 10
                const on = Math.min(
                  cells,
                  entry.goal > 0 ? Math.round((entry.completed / entry.goal) * cells) : 0
                )
                return (
                  <li key={entry.skill} className="flex flex-wrap items-center gap-3">
                    <span className="w-28 font-semibold">{text.home.skillNames[entry.skill]}</span>
                    <span className="exam-meter" aria-hidden>
                      {Array.from({ length: cells }, (_, i) => (
                        <span key={i} data-on={i < on} />
                      ))}
                    </span>
                    <span className="text-sm font-bold">
                      {text.progress.of(entry.completed, entry.goal)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>

          <section>
            <h3 className="text-sm font-extrabold">{text.progress.recent}</h3>
            {(progress.data?.recent ?? []).length === 0 ? (
              <p className="text-ink-soft">{text.progress.noRecent}</p>
            ) : (
              <ul className="mt-1 flex flex-col gap-1">
                {progress.data?.recent.map((entry) => (
                  <li key={`${entry.activity_id}-${entry.finished_at}`}>
                    {entry.title} · {text.home.skillNames[entry.skill]} ·{' '}
                    <span className="font-bold">
                      {text.progress.score(Math.round(entry.score))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="trainer-vocab">
            <h3 id="trainer-vocab" className="text-sm font-extrabold">
              {text.vocab.title}
            </h3>
            {(vocab.data?.saved ?? []).length === 0 ? (
              <p className="text-ink-soft">{text.vocab.empty}</p>
            ) : (
              <>
                <p className="text-sm">{text.vocab.due(vocab.data?.due_count ?? 0)}</p>
                <ul className="mt-1 flex flex-col gap-1">
                  {vocab.data?.saved.map((word) => (
                    <li
                      key={word.word_id}
                      className="flex flex-wrap items-center justify-between gap-2"
                    >
                      <span>
                        <span className="font-bold">{word.word}</span> · {word.translation}{' '}
                        <span className="text-xs text-ink-soft">({text.vocab.box(word.box)})</span>
                      </span>
                      <button
                        type="button"
                        className="min-h-[44px] px-1 text-sm font-bold text-primary underline underline-offset-4"
                        aria-label={text.vocab.remove(word.word)}
                        onClick={() =>
                          trainerApi
                            .removeWord(word.word_id)
                            .then(() =>
                              client.invalidateQueries({ queryKey: ['trainer', 'vocabulary'] })
                            )
                            .catch(() => undefined)
                        }
                      >
                        {text.vocab.removeShort}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </>
      )}
    </TrainerCard>
  )
}

// "Repasar palabras": one card at a time, translation on request, then "La sabía" or
// "No la sabía". A failed save stays on the card with a retry.
const ReviewCards = ({ cards, onBack }: { cards: SavedWord[]; onBack: () => void }) => {
  const ref = useRef<HTMLHeadingElement>(null)
  const client = useQueryClient()
  const [state, dispatch] = useReducer(reviewReducer, cards, startReview)
  const { phase, pending } = state

  useEffect(() => {
    if (phase !== 'sending' || !pending) return
    let alive = true
    trainerApi
      .review(pending.wordId, { attempt_id: pending.attemptId, knew: pending.knew })
      .then(() => alive && dispatch({ type: 'saved' }))
      .catch(() => alive && dispatch({ type: 'failed' }))
    return () => {
      alive = false
    }
  }, [phase, pending])
  const done = phase === 'done'
  useEffect(() => {
    if (!done) return
    ref.current?.focus()
    void client.invalidateQueries({ queryKey: ['trainer'] })
  }, [done, client])

  const card = state.cards[state.index]
  return (
    <TrainerCard
      ref={ref}
      title={text.vocab.review}
      kicker={!done && card ? text.vocab.card(state.index + 1, state.cards.length) : undefined}
      busy={phase === 'sending'}
      footer={
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft size={18} strokeWidth={3} aria-hidden />
          {text.backToHome}
        </Button>
      }
    >
      {done ? (
        <p role="status" className="font-semibold">
          {state.cards.length === 0 ? text.vocab.nothingDue : text.vocab.done}
        </p>
      ) : (
        card && (
          <>
            <p className="font-heading text-3xl font-extrabold">{card.word}</p>
            {state.revealed ? (
              <p className="text-xl">{card.translation}</p>
            ) : (
              <div>
                <Button variant="secondary" onClick={() => dispatch({ type: 'reveal' })}>
                  {text.vocab.flip}
                </Button>
              </div>
            )}
            {state.revealed && (
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={phase !== 'card'}
                  onClick={() =>
                    dispatch({ type: 'answer', knew: true, attemptId: newAttemptId() })
                  }
                >
                  {text.vocab.knew}
                </Button>
                <Button
                  variant="secondary"
                  disabled={phase !== 'card'}
                  onClick={() =>
                    dispatch({ type: 'answer', knew: false, attemptId: newAttemptId() })
                  }
                >
                  {text.vocab.didNot}
                </Button>
              </div>
            )}
            {phase === 'error' && (
              <p
                role="alert"
                className="flex flex-wrap items-center gap-2 font-semibold text-danger"
              >
                {text.errors.unreachable}
                <Button size="sm" onClick={() => dispatch({ type: 'retry' })}>
                  {text.errors.retry}
                </Button>
              </p>
            )}
          </>
        )
      )}
    </TrainerCard>
  )
}

// The due words are fixed once, when the list arrives, so the deck does not change
// under the student while they review.
export const VocabReview = ({ onBack }: { onBack: () => void }) => {
  const vocab = useQuery({
    queryKey: ['trainer', 'vocabulary'],
    queryFn: trainerApi.vocabulary,
    staleTime: Infinity,
  })
  const [now] = useState(() => Date.now())
  const [deck, setDeck] = useState<SavedWord[] | null>(null)
  if (vocab.data && deck === null) setDeck(dueWords(vocab.data.saved, now))
  if (deck) return <ReviewCards cards={deck} onBack={onBack} />
  return (
    <TrainerCard
      title={text.vocab.review}
      footer={
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft size={18} strokeWidth={3} aria-hidden />
          {text.backToHome}
        </Button>
      }
    >
      {vocab.isError ? (
        <p role="alert" className="font-semibold text-danger">
          {text.errors.unreachable}
        </p>
      ) : (
        <p role="status">{text.loading}</p>
      )}
    </TrainerCard>
  )
}
