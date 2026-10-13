import { useState } from 'react'
import { tabClass, tabListClass } from '../../../../components/ui/tabStyles.ts'
import { Dialog } from '../../../../components/ui/Dialog.tsx'
import { es } from '../../../../i18n/es.ts'
import type { AssetCreateResult, AssetListItem } from '../../data/types.ts'
import { AssetLibrary } from './AssetLibrary.tsx'
import { AssetUploader } from './AssetUploader.tsx'

interface BubbleArtPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  currentAssetId: string | null
  onSelect: (asset: AssetListItem | AssetCreateResult['asset']) => void
}

// The skin studio's art picker: the same library (with title, credit and safe
// delete) and uploader as backgrounds, for bubble-kind assets.
export const BubbleArtPicker = ({
  open,
  onOpenChange,
  title,
  currentAssetId,
  onSelect,
}: BubbleArtPickerProps) => {
  const [tab, setTab] = useState<'library' | 'upload'>('library')

  const choose = (asset: AssetListItem | AssetCreateResult['asset']) => {
    onSelect(asset)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} size="lg" title={title}>
      <div className="space-y-4">
        <div role="tablist" aria-label={es.background.tabs.label} className={tabListClass}>
          {(['library', 'upload'] as const).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={tab === item}
              onClick={() => setTab(item)}
              className={tabClass(tab === item)}
            >
              {es.background.tabs[item]}
            </button>
          ))}
        </div>
        <div role="tabpanel">
          {tab === 'library' ? (
            <AssetLibrary
              kind="bubble"
              currentUrl={currentAssetId ? `/assets/${currentAssetId}` : null}
              onSelect={choose}
              selectLabel={es.studio.bubbles.useImage}
            />
          ) : (
            <AssetUploader kind="bubble" onUploaded={({ asset }) => choose(asset)} />
          )}
        </div>
      </div>
    </Dialog>
  )
}
