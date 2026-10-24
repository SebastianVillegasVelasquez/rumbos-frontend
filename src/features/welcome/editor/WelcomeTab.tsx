import { useId, useState } from 'react'
import { Eye, X } from 'lucide-react'
import { Button } from '../../../components/ui/Button.tsx'
import { Input } from '../../../components/ui/Input.tsx'
import { SegmentedControl } from '../../../components/ui/SegmentedControl.tsx'
import { es } from '../../../i18n/es.ts'
import { parseVideoInput } from '../../content/video.ts'
import {
  WELCOME_LIMITS,
  type MapSettings,
  type MapWelcome,
  type WelcomeShow,
} from '../../course-map/data/types.ts'
import { useHostCourseName } from '../../embed/hostCourse.ts'
import { LazyWelcomeCurtain } from '../LazyWelcomeCurtain.tsx'
import { resolveWelcome, welcomeTitle } from '../welcome.ts'

const text = es.studio.welcome
const checkboxClass = 'h-5 w-5 shrink-0 accent-primary'
const labelClass = 'text-xs font-bold uppercase tracking-wide text-ink-soft'

interface WelcomeTabProps {
  settings: MapSettings
  onChange: (settings: MapSettings) => void
  mapTitle: string
  imageUrl: string
  hasMusic: boolean
}

// The link to show for a stored video, so reopening the tab shows what was saved.
const linkOf = (video: NonNullable<MapWelcome['video']>) =>
  video.provider === 'youtube'
    ? `https://youtu.be/${video.videoId}`
    : `https://vimeo.com/${video.videoId}`

// The editor's "Bienvenida" tab: the curtain students see on entering the map.
// The live preview is the real curtain, in a mode that touches neither the
// music nor anything remembered.
export const WelcomeTab = ({
  settings,
  onChange,
  mapTitle,
  imageUrl,
  hasMusic,
}: WelcomeTabProps) => {
  const welcome = resolveWelcome(settings.welcome)
  const courseName = useHostCourseName()
  const [previewing, setPreviewing] = useState(false)
  // What was typed in the video field; the stored video only changes to a recognised one.
  const [videoText, setVideoText] = useState(() => (welcome.video ? linkOf(welcome.video) : ''))
  const videoInvalid = videoText.trim() !== '' && parseVideoInput(videoText) === null
  const ids = { title: useId(), message: useId(), video: useId() }

  const patch = (next: Partial<MapWelcome>) =>
    onChange({ ...settings, welcome: { ...welcome, ...next } })

  const setVideoInput = (value: string) => {
    setVideoText(value)
    const parsed = parseVideoInput(value)
    if (value.trim() === '') patch({ video: null })
    else if (parsed) patch({ video: parsed })
  }

  const message = welcome.message ?? ''
  const title = welcome.title ?? ''

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-heading text-base font-extrabold text-ink">{text.title}</h3>
        <p className="text-xs font-semibold text-ink-soft">{text.intro}</p>
      </div>

      <label className="flex min-h-[44px] items-center gap-2 text-sm font-bold text-ink">
        <input
          className={checkboxClass}
          type="checkbox"
          checked={welcome.enabled}
          onChange={(event) => patch({ enabled: event.target.checked })}
        />
        {text.enable}
      </label>

      <fieldset disabled={!welcome.enabled} className="space-y-4 disabled:opacity-60">
        <div className="space-y-1">
          <label htmlFor={ids.title} className={labelClass}>
            {text.titleLabel}
          </label>
          <Input
            id={ids.title}
            density="compact"
            value={title}
            maxLength={WELCOME_LIMITS.titleMax}
            placeholder={es.welcome.defaultTitle}
            onChange={(event) =>
              patch({ title: event.target.value === '' ? null : event.target.value })
            }
          />
          <p className="text-xs font-semibold text-ink-soft">{text.titleHint}</p>
        </div>

        <div className="space-y-1">
          <label htmlFor={ids.message} className={labelClass}>
            {text.messageLabel}
          </label>
          <textarea
            id={ids.message}
            rows={3}
            value={message}
            maxLength={WELCOME_LIMITS.messageMax}
            onChange={(event) =>
              patch({ message: event.target.value === '' ? null : event.target.value })
            }
            className="border-soft min-h-[88px] w-full rounded-md bg-surface px-3 py-2 text-sm font-semibold text-ink"
          />
          <p className="text-xs font-semibold text-ink-soft">
            {text.messageCount(message.length, WELCOME_LIMITS.messageMax)}
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor={ids.video} className={labelClass}>
            {text.videoLabel}
          </label>
          <div className="flex gap-2">
            <Input
              id={ids.video}
              density="compact"
              value={videoText}
              inputMode="url"
              aria-invalid={videoInvalid}
              aria-describedby={`${ids.video}-help`}
              onChange={(event) => setVideoInput(event.target.value)}
            />
            {videoText !== '' && (
              <Button
                variant="surface"
                dense
                aria-label={text.videoRemove}
                title={text.videoRemove}
                onClick={() => setVideoInput('')}
              >
                <X size={16} strokeWidth={3} aria-hidden />
              </Button>
            )}
          </div>
          <p
            id={`${ids.video}-help`}
            role={videoInvalid ? 'alert' : undefined}
            className={`text-xs font-semibold ${videoInvalid ? 'text-danger' : 'text-ink-soft'}`}
          >
            {videoInvalid
              ? text.videoInvalid
              : welcome.video
                ? text.videoFound(es.welcome.providers[welcome.video.provider])
                : text.videoHint}
          </p>
        </div>

        {welcome.video && (
          <label className="flex min-h-[44px] items-start gap-2 text-sm font-bold text-ink">
            <input
              className={`${checkboxClass} mt-0.5`}
              type="checkbox"
              checked={welcome.playOnEnter}
              onChange={(event) => patch({ playOnEnter: event.target.checked })}
            />
            <span>
              {text.playOnEnter}
              <span className="block text-xs font-semibold text-ink-soft">
                {text.playOnEnterHint}
              </span>
            </span>
          </label>
        )}

        <div className="space-y-1">
          <span className={labelClass}>{text.showLabel}</span>
          <SegmentedControl<WelcomeShow>
            aria-label={text.showLabel}
            fullWidth
            value={welcome.show}
            onChange={(show) => patch({ show })}
            options={[
              { value: 'first_visit', label: text.showOptions.first_visit },
              { value: 'always', label: text.showOptions.always },
            ]}
          />
        </div>
      </fieldset>

      <Button
        size="sm"
        variant="secondary"
        onClick={() => setPreviewing(true)}
        disabled={!welcome.enabled}
      >
        <Eye size={16} strokeWidth={2.5} aria-hidden />
        {text.previewButton}
      </Button>

      {previewing && (
        <div className="fixed inset-0 z-[60]">
          <LazyWelcomeCurtain
            welcome={welcome}
            title={welcomeTitle(welcome, es.welcome.defaultTitle, { courseName, mapTitle })}
            imageUrl={imageUrl}
            hasMusic={hasMusic}
            isolated
            showSkip
            skipLabel={text.previewClose}
            onDone={() => setPreviewing(false)}
          />
        </div>
      )}
    </div>
  )
}
