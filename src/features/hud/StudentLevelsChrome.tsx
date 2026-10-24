import { ArrowLeft, Maximize2 } from 'lucide-react'
import { Button, IconButton } from '../../components/ui/Button.tsx'
import { es } from '../../i18n/es.ts'

interface StudentLevelsChromeProps {
  exitPreview: { label: string; onExit: () => void } | null
  onEnterFullscreen: (() => void) | null
}

// The level picker has no header for students either. What is left floats: the
// fullscreen toggle at the bottom right (the top-right corner stays empty for
// the host) and, for an editor looking at the student view, the way back (bottom left: the level cards sit in the middle).
export const StudentLevelsChrome = ({
  exitPreview,
  onEnterFullscreen,
}: StudentLevelsChromeProps) => (
  <>
    {exitPreview && (
      <Button
        variant="secondary"
        size="sm"
        dense
        className="pointer-events-auto fixed z-20 max-w-[min(60vw,240px)]"
        style={{
          left: 'max(0.5rem, env(safe-area-inset-left, 0px))',
          bottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))',
        }}
        onClick={exitPreview.onExit}
      >
        <ArrowLeft size={16} strokeWidth={2.5} aria-hidden className="shrink-0" />
        <span className="min-w-0 truncate">{exitPreview.label}</span>
      </Button>
    )}
    {onEnterFullscreen && (
      <IconButton
        variant="surface"
        className="fixed z-20"
        style={{
          right: 'max(0.5rem, env(safe-area-inset-right, 0px))',
          bottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))',
        }}
        aria-label={es.embed.fullscreen}
        title={es.embed.fullscreen}
        onClick={onEnterFullscreen}
      >
        <Maximize2 size={18} strokeWidth={2.5} aria-hidden />
      </IconButton>
    )}
  </>
)
