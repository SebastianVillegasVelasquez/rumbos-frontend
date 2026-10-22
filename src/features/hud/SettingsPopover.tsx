import { useState } from 'react'
import { Leaf, Settings } from 'lucide-react'
import { Button, IconButton } from '../../components/ui/Button.tsx'
import { Popover } from '../../components/ui/Popover.tsx'
import { useDataSaver } from '../../fx/dataSaverStore.ts'
import { es } from '../../i18n/es.ts'

// The student's settings: today just the data saver. When it is on, the button
// carries a leaf badge (a shape, not only a color) and says so in its name.
export const SettingsPopover = () => {
  const [open, setOpen] = useState(false)
  const saver = useDataSaver()
  const label = saver.active ? es.settings.openActive : es.settings.open

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="start"
      trigger={
        <IconButton
          variant="surface"
          className="hud-dimmable pointer-events-auto relative"
          aria-label={label}
          title={label}
        >
          <Settings size={18} strokeWidth={2.5} aria-hidden />
          {saver.active && (
            <span
              aria-hidden
              className="border-hair absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-pill bg-leaf-tint text-leaf-dark"
            >
              <Leaf size={12} strokeWidth={2.5} />
            </span>
          )}
        </IconButton>
      }
    >
      <div className="w-64 space-y-2">
        <h2 className="font-heading text-base font-extrabold text-ink">{es.settings.title}</h2>
        <label className="flex min-h-[44px] items-start gap-3 text-sm font-bold text-ink">
          <input
            type="checkbox"
            role="switch"
            className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
            checked={saver.active}
            onChange={(event) => saver.setSetting(event.target.checked ? 'on' : 'off')}
          />
          <span>
            {es.settings.dataSaver}
            <span className="block text-xs font-semibold text-ink-soft">
              {es.settings.dataSaverHint}
            </span>
          </span>
        </label>
        {saver.setting === 'auto' && saver.detected && (
          <p className="text-xs font-semibold text-ink-soft">{es.settings.dataSaverAuto}</p>
        )}
        {saver.setting !== 'auto' && (
          <Button variant="surface" dense size="sm" onClick={() => saver.setSetting('auto')}>
            {es.settings.backToAuto}
          </Button>
        )}
      </div>
    </Popover>
  )
}
