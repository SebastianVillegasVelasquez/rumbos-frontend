import { useState } from 'react'
import { ChevronDown, FileDown, FileUp, Layers } from 'lucide-react'
import { Button } from '../../components/ui/Button.tsx'
import { DropdownMenu } from '../../components/ui/DropdownMenu.tsx'
import { es } from '../../i18n/es.ts'
import { useCourseMapsByCourse } from '../course-map/data/queries.ts'
import { LazyExportDialog } from './LazyExportDialog.tsx'
import { LazyImportWizard } from './LazyImportWizard.tsx'
import { useTransferSupported } from './transferSupport.ts'

// "Exportar niveles…" and "Importar niveles…", in the editor's header so they
// are there whether the course has no level, one (which opens on its own) or
// several. Nothing but this menu is in the first bundle; the dialogs load when
// they are opened.
export const TransferMenu = ({
  moodleCourseId,
  onOpenLevel,
}: {
  moodleCourseId: number
  onOpenLevel: (levelId: string) => void
}) => {
  const supported = useTransferSupported()
  const levelsQuery = useCourseMapsByCourse(moodleCourseId)
  const [exportOpen, setExportOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const levels = levelsQuery.data ?? []

  if (!supported) return null

  return (
    <>
      <DropdownMenu
        trigger={
          <Button variant="surface" size="sm">
            <Layers size={16} strokeWidth={2.5} aria-hidden />
            {es.transfer.menu.label}
            <ChevronDown size={16} strokeWidth={3} aria-hidden />
          </Button>
        }
        items={[
          {
            label: es.transfer.menu.export,
            icon: <FileDown size={16} strokeWidth={2.5} aria-hidden />,
            onSelect: () => setExportOpen(true),
          },
          {
            label: es.transfer.menu.import,
            icon: <FileUp size={16} strokeWidth={2.5} aria-hidden />,
            onSelect: () => setImportOpen(true),
          },
        ]}
      />
      {importOpen && (
        <LazyImportWizard
          levels={levels}
          onClose={() => setImportOpen(false)}
          onOpenLevel={onOpenLevel}
        />
      )}
      {exportOpen && levels.length > 0 && (
        <LazyExportDialog open onOpenChange={setExportOpen} levels={levels} />
      )}
    </>
  )
}
