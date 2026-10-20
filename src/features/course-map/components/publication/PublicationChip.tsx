import { CheckCircle2, CircleDashed, PencilLine } from 'lucide-react'
import { Badge } from '../../../../components/ui/Card.tsx'
import { es } from '../../../../i18n/es.ts'
import type { PublicationStatus } from '../../data/types.ts'

interface PublicationChipProps {
  status: PublicationStatus | null
  number: number | null
  className?: string
}

const text = es.publication.chip

// "Sin guardar" / "Guardado · versión N" / "Cambios sin guardar". The label
// is plain text (not colour alone) and the status role gives screen readers a
// full sentence.
export const PublicationChip = ({ status, number, className = '' }: PublicationChipProps) => {
  if (status === null) {
    return (
      <Badge tone="slate" role="status" aria-label={text.aria.loading} className={className}>
        …
      </Badge>
    )
  }
  if (status === 'never_published') {
    return (
      <Badge tone="slate" role="status" aria-label={text.aria.never} className={className}>
        <CircleDashed size={14} strokeWidth={2.5} aria-hidden />
        {text.never}
      </Badge>
    )
  }
  if (status === 'up_to_date') {
    return (
      <Badge
        tone="leaf"
        role="status"
        aria-label={text.aria.upToDate(number ?? 0)}
        className={className}
      >
        <CheckCircle2 size={14} strokeWidth={2.5} aria-hidden />
        {text.upToDate(number ?? 0)}
      </Badge>
    )
  }
  return (
    <Badge tone="sun" role="status" aria-label={text.aria.unpublished} className={className}>
      <PencilLine size={14} strokeWidth={2.5} aria-hidden />
      {text.unpublished}
    </Badge>
  )
}
