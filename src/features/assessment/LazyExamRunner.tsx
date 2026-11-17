import { lazy, Suspense } from 'react'
import { esAssessment } from '../../i18n/assessment.es.ts'
import type { ExamRunnerProps } from './ExamRunner.tsx'

// The runner, its item views and its copy load only when a student opens an exam, so
// the embed's first download does not grow (the budget script counts what the embed
// always needs, and this is behind a lazy boundary).
const ExamRunner = lazy(() => import('./ExamRunner.tsx').then((m) => ({ default: m.ExamRunner })))

export const LazyExamRunner = (props: ExamRunnerProps) => (
  <Suspense
    fallback={
      <div className="flow-stage relative">
        <p role="status" className="rounded-md bg-surface px-4 py-3 font-semibold text-ink">
          {esAssessment.loading}
        </p>
      </div>
    }
  >
    <ExamRunner {...props} />
  </Suspense>
)
