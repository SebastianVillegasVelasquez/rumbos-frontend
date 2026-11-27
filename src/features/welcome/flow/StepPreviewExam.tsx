import { Info } from 'lucide-react'
import { esAssessment } from '../../../i18n/assessment.es.ts'
import { FlowStatus } from './FlowStatus.tsx'

// The exam step in a preview ("Probar el flujo", "Vista previa"): no request is made and there
// is no "Empezar", so looking at a flow can never create a real attempt.
export const StepPreviewExam = () => (
  <div className="flow-pad flex flex-col gap-3">
    <p role="note" className="rounded-md bg-sun-tint px-3 py-2 text-sm font-semibold text-sun-dark">
      {esAssessment.previewStep.noAttempt}
    </p>
    <FlowStatus icon={<Info size={18} strokeWidth={2.5} />} className="text-base">
      {esAssessment.previewStep.simulate}
    </FlowStatus>
  </div>
)
