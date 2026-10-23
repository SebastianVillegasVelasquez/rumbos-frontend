import { useState } from 'react'
import { tabClass, tabListClass } from '../../../components/ui/tabStyles.ts'
import { Dialog } from '../../../components/ui/Dialog.tsx'
import { es } from '../../../i18n/es.ts'
import { AssetLibrary } from '../../course-map/components/background/AssetLibrary.tsx'
import { AssetUploader } from '../../course-map/components/background/AssetUploader.tsx'
import type { AssetCreateResult, AssetListItem } from '../../course-map/data/types.ts'

interface ContentImagePickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentAssetId: string | null
  onSelect: (asset: AssetListItem | AssetCreateResult['asset']) => void
}

// The same library and uploader as backgrounds, for the "image" asset kind
// (PNG, JPEG or WebP, up to 2048 px and 4 MB).
export const ContentImagePicker = ({
  open,
  onOpenChange,
  currentAssetId,
  onSelect,
}: ContentImagePickerProps) => {
  const [tab, setTab] = useState<'library' | 'upload'>('library')
  const text = es.content.editor

  const choose = (asset: AssetListItem | AssetCreateResult['asset']) => {
    onSelect(asset)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} size="lg" title={text.pickImageTitle}>
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
              kind="image"
              currentUrl={currentAssetId ? `/assets/${currentAssetId}` : null}
              onSelect={choose}
              selectLabel={text.useImage}
            />
          ) : (
            <AssetUploader kind="image" onUploaded={({ asset }) => choose(asset)} />
          )}
        </div>
      </div>
    </Dialog>
  )
}
