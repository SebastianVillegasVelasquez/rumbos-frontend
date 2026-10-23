import { useRef, useState, type KeyboardEvent } from 'react'
import { tabClass, tabListClass } from '../../../../components/ui/tabStyles.ts'
import { Check } from 'lucide-react'
import { Button } from '../../../../components/ui/Button.tsx'
import { Dialog } from '../../../../components/ui/Dialog.tsx'
import { useToast } from '../../../../components/ui/toastContext.ts'
import {
  SHOW_BUNDLED_BACKGROUNDS,
  backgroundOptions,
} from '../../../../assets/backgrounds/index.ts'
import { es } from '../../../../i18n/es.ts'
import type { AssetCreateResult, AssetListItem } from '../../data/types.ts'
import type { RenderableMap } from '../../renderable.ts'
import { AssetLibrary } from './AssetLibrary.tsx'
import { AssetUploader } from './AssetUploader.tsx'
import { BackgroundPreview } from './BackgroundPreview.tsx'
import type { ChangeBackgroundResult } from './useChangeBackground.ts'

type Tab = 'library' | 'upload' | 'bundled'

interface Selection {
  imageUrl: string
  label: string
  notice: string | null
}

interface BackgroundPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentImageUrl: string | null
  // With a map, choosing an image first shows it under the map's bubbles and
  // only applies on confirmation. Without one (creating a level) the choice
  // is returned straight away.
  map?: RenderableMap
  getModnameForBubble?: (bubble: { activityId: number | null }) => string | undefined
  onApply?: (imageUrl: string, previousImageUrl: string) => Promise<ChangeBackgroundResult>
  onChoose?: (choice: { imageUrl: string; label: string }) => void
}

export const BackgroundPicker = ({
  open,
  onOpenChange,
  currentImageUrl,
  map,
  getModnameForBubble,
  onApply,
  onChoose,
}: BackgroundPickerProps) => {
  const toast = useToast()
  const tabs: Tab[] = SHOW_BUNDLED_BACKGROUNDS
    ? ['library', 'upload', 'bundled']
    : ['library', 'upload']
  const [tab, setTab] = useState<Tab>('library')
  const [selection, setSelection] = useState<Selection | null>(null)
  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({})

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setTab('library')
      setSelection(null)
      setApplyError(null)
    }
    onOpenChange(next)
  }

  const choose = (imageUrl: string, label: string, notice: string | null = null) => {
    setApplyError(null)
    if (map && currentImageUrl) {
      setSelection({ imageUrl, label, notice })
      return
    }
    if (notice) toast.show(notice, 'info')
    onChoose?.({ imageUrl, label })
    handleOpenChange(false)
  }

  const handleAsset = (asset: AssetListItem) => choose(asset.url, asset.title)

  const handleUploaded = ({ asset, created }: AssetCreateResult) =>
    choose(asset.url, asset.title, created ? null : es.background.upload.alreadyExisted)

  const handleApply = async () => {
    if (!selection || !currentImageUrl || !onApply) return
    if (selection.imageUrl === currentImageUrl) {
      handleOpenChange(false)
      return
    }
    setApplying(true)
    setApplyError(null)
    const result = await onApply(selection.imageUrl, currentImageUrl)
    setApplying(false)
    if (result.ok) handleOpenChange(false)
    else {
      // A discarded write was explained by the conflict dialog: just close.
      if (result.message === null) handleOpenChange(false)
      else setApplyError(result.message)
    }
  }

  const handleTabKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End')
      return
    e.preventDefault()
    const index = tabs.indexOf(tab)
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? tabs.length - 1
          : (index + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
    setTab(tabs[next])
    tabRefs.current[tabs[next]]?.focus()
  }

  const inPreview = selection !== null && map !== undefined && currentImageUrl !== null

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      size="lg"
      title={
        inPreview
          ? es.background.preview.title
          : map
            ? es.background.title
            : es.background.chooseTitle
      }
      description={inPreview ? selection.label : es.background.description}
    >
      {inPreview ? (
        <div className="space-y-4">
          <BackgroundPreview
            map={map}
            currentImageUrl={currentImageUrl}
            nextImageUrl={selection.imageUrl}
            getModnameForBubble={getModnameForBubble}
            notice={selection.notice}
          />
          {applyError && (
            <p role="alert" className="text-sm font-bold text-danger">
              {applyError}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSelection(null)}
              disabled={applying}
            >
              {es.background.preview.back}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleOpenChange(false)}
              disabled={applying}
            >
              {es.background.preview.cancel}
            </Button>
            <Button type="button" onClick={() => void handleApply()} disabled={applying}>
              {applying ? es.background.preview.applying : es.background.preview.apply}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div
            role="tablist"
            aria-label={es.background.tabs.label}
            onKeyDown={handleTabKeyDown}
            className={tabListClass}
          >
            {tabs.map((item) => (
              <button
                key={item}
                ref={(el) => {
                  tabRefs.current[item] = el
                }}
                id={`background-tab-${item}`}
                type="button"
                role="tab"
                aria-selected={tab === item}
                aria-controls={`background-panel-${item}`}
                tabIndex={tab === item ? 0 : -1}
                onClick={() => setTab(item)}
                className={tabClass(tab === item)}
              >
                {es.background.tabs[item]}
              </button>
            ))}
          </div>

          <div
            role="tabpanel"
            id={`background-panel-${tab}`}
            aria-labelledby={`background-tab-${tab}`}
          >
            {tab === 'library' && (
              <AssetLibrary kind="background" currentUrl={currentImageUrl} onSelect={handleAsset} />
            )}
            {tab === 'upload' && <AssetUploader kind="background" onUploaded={handleUploaded} />}
            {tab === 'bundled' && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-sun-dark">
                  {es.background.bundled.notice}
                </p>
                <ul
                  aria-label={es.background.bundled.gridLabel}
                  className="grid grid-cols-2 gap-3 sm:grid-cols-3"
                >
                  {backgroundOptions.map((option) => (
                    <li key={option.id}>
                      <button
                        type="button"
                        onClick={() => choose(option.url, option.label)}
                        aria-pressed={currentImageUrl === option.url}
                        className={`border-soft block w-full overflow-hidden rounded-md text-left transition-colors ${
                          currentImageUrl === option.url
                            ? 'bg-primary-tint'
                            : 'bg-surface hover:bg-primary-tint'
                        }`}
                      >
                        <img src={option.url} alt="" className="aspect-video w-full object-cover" />
                        <span className="flex items-center gap-1.5 px-2 py-1.5 text-sm font-bold text-ink">
                          {currentImageUrl === option.url && (
                            <Check
                              size={16}
                              strokeWidth={3}
                              aria-hidden
                              className="shrink-0 text-primary"
                            />
                          )}
                          <span className="truncate">{option.label}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </Dialog>
  )
}
