import { useEffect, useRef, useState } from 'react'
import { Select } from '../../../components/ui/Select.tsx'
import { X } from 'lucide-react'
import { ChevronUp, ChevronDown, Play, RotateCcw, Zap } from 'lucide-react'
import { Button, IconButton } from '../../../components/ui/Button.tsx'
import { SegmentedControl } from '../../../components/ui/SegmentedControl.tsx'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog.tsx'
import { SkinStudio } from './SkinStudio.tsx'
import { View3dTab } from '../../view3d/editor/View3dTab.tsx'
import { useAnimationQuality, type QualitySetting } from '../../../fx/quality.ts'
import { useReorderBubbles } from '../data/queries.ts'
import { useUpdateAppearance, useUpdateBubble } from '../data/draftMutations.ts'
import { resolveThumbUrl } from '../data/assets.ts'
import { es } from '../../../i18n/es.ts'
import { useEmbed } from '../../embed/EmbedContext.ts'
import type {
  AmbientKind,
  Bubble,
  CourseMapRead,
  MapFit,
  MapInitialView,
  MapIntro,
  MapMode,
  MapSettings,
  PathStyle,
  Skin,
  SkinRule,
} from '../data/types.ts'

type Tab = 'bubbles' | 'map' | 'ambient' | 'sequence' | 'view3d' | 'animation'

interface AppearanceStudioProps {
  courseMap: CourseMapRead
  skins: Skin[]
  getCurrentView: () => MapInitialView | null
  onClose: () => void
  onChangeBackground: () => void
  // Opens the 3D view of the saved draft.
  onPreview3d: () => void
}

const checkboxClass = 'h-5 w-5 shrink-0 accent-primary'

const settingsEqual = (a: MapSettings, b: MapSettings) => JSON.stringify(a) === JSON.stringify(b)
const rulesEqual = (a: SkinRule[], b: SkinRule[]) => JSON.stringify(a) === JSON.stringify(b)

export const AppearanceStudio = ({
  courseMap,
  skins,
  getCurrentView,
  onClose,
  onChangeBackground,
  onPreview3d,
}: AppearanceStudioProps) => {
  // Embedded, progress comes from Moodle: the demo simulator would only fight it.
  const embed = useEmbed()
  const [tab, setTab] = useState<Tab>('bubbles')
  const [settings, setSettings] = useState<MapSettings>(courseMap.settings)
  const [defaultSkinId, setDefaultSkinId] = useState(courseMap.defaultSkinId)
  const [skinRules, setSkinRules] = useState<SkinRule[]>(courseMap.skinRules)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const updateAppearance = useUpdateAppearance(courseMap.id)

  // Re-sync the draft whenever a fresh save lands (new updatedAt), but
  // never while the panel is mid-edit otherwise - it would stomp on
  // whatever the user is typing.
  const syncedAtRef = useRef(courseMap.updatedAt)
  useEffect(() => {
    if (courseMap.updatedAt === syncedAtRef.current) return
    syncedAtRef.current = courseMap.updatedAt
    setSettings(courseMap.settings)
    setDefaultSkinId(courseMap.defaultSkinId)
    setSkinRules(courseMap.skinRules)
  }, [courseMap])

  const isDirty =
    !settingsEqual(settings, courseMap.settings) ||
    defaultSkinId !== courseMap.defaultSkinId ||
    !rulesEqual(skinRules, courseMap.skinRules)

  const handleSave = () => {
    updateAppearance.mutate(
      { settings, defaultSkinId, skinRules },
      { onSuccess: (map) => (syncedAtRef.current = map.updatedAt) }
    )
  }

  const handleClose = () => {
    if (isDirty) setConfirmDiscard(true)
    else onClose()
  }

  const setTypeRule = (modname: string, skinId: string | null) => {
    setSkinRules((current) => {
      const withoutModname = current.filter((rule) => rule.modname !== modname)
      return skinId ? [...withoutModname, { modname, skinId }] : withoutModname
    })
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col border-l-strong bg-surface">
      <div className="flex items-center justify-between gap-2 border-b-soft px-4 py-3">
        <h2 className="min-w-0 truncate font-heading text-base font-extrabold text-ink">
          {es.studio.title}
        </h2>
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          {isDirty && (
            <span className="text-xs font-bold text-sun-dark">{es.studio.unsavedChanges}</span>
          )}
          <IconButton aria-label={es.app.close} variant="ghost" onClick={handleClose}>
            <X size={18} strokeWidth={3} aria-hidden />
          </IconButton>
        </div>
      </div>

      <div className="border-b-soft px-4 py-2">
        <div className="flex flex-wrap gap-1.5">
          {(['bubbles', 'map', 'ambient', 'sequence', 'view3d', 'animation'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              className={`min-h-[44px] flex-1 rounded-md px-3 text-xs transition-colors min-[400px]:flex-none ${
                tab === t
                  ? 'border-soft bg-primary font-extrabold text-white'
                  : 'border-hair bg-surface font-bold text-ink-soft hover:bg-primary-tint hover:text-ink'
              }`}
            >
              {es.studio.tabs[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === 'bubbles' && (
          <SkinStudio
            skins={skins}
            defaultSkinId={defaultSkinId}
            skinRules={skinRules}
            onSetDefaultSkin={setDefaultSkinId}
            onSetTypeRule={setTypeRule}
          />
        )}
        {tab === 'map' && (
          <MapTab
            settings={settings}
            onChange={setSettings}
            getCurrentView={getCurrentView}
            onChangeBackground={onChangeBackground}
            currentImageUrl={courseMap.imageUrl}
          />
        )}
        {tab === 'ambient' && <AmbientTab settings={settings} onChange={setSettings} />}
        {tab === 'sequence' && (
          <SequenceTab
            courseMapId={courseMap.id}
            bubbles={courseMap.bubbles}
            mode={settings.mode}
          />
        )}
        {/* Kept mounted so unsaved 3D edits survive switching tabs. */}
        <div hidden={tab !== 'view3d'}>
          <View3dTab courseMap={courseMap} onPreview={onPreview3d} />
        </div>
        {tab === 'animation' && <AnimationTab />}
      </div>

      {isDirty && (
        <div className="border-t-soft flex flex-wrap justify-end gap-2 px-4 py-3">
          <Button size="sm" variant="secondary" onClick={() => setConfirmDiscard(true)}>
            {es.app.dismiss}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={updateAppearance.isPending}>
            {updateAppearance.isPending ? es.studio.saving : es.studio.save}
          </Button>
        </div>
      )}
      {updateAppearance.isError && (
        <p role="alert" className="px-4 pb-3 text-xs font-bold text-danger">
          {es.studio.saveError}
        </p>
      )}

      {tab === 'bubbles' && !embed && (
        <ProgressSimulator
          courseMapId={courseMap.id}
          bubbles={courseMap.bubbles}
          mode={settings.mode}
        />
      )}

      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title={es.studio.discardConfirm.title}
        description={es.studio.discardConfirm.description}
        confirmLabel={es.studio.discardConfirm.confirm}
        cancelLabel={es.studio.discardConfirm.cancel}
        destructive
        onConfirm={() => {
          setSettings(courseMap.settings)
          setDefaultSkinId(courseMap.defaultSkinId)
          setSkinRules(courseMap.skinRules)
          setConfirmDiscard(false)
          onClose()
        }}
      />
    </div>
  )
}

const MapTab = ({
  settings,
  onChange,
  getCurrentView,
  onChangeBackground,
  currentImageUrl,
}: {
  settings: MapSettings
  onChange: (s: MapSettings) => void
  getCurrentView: () => MapInitialView | null
  onChangeBackground: () => void
  currentImageUrl: string
}) => {
  const [viewCaptured, setViewCaptured] = useState(false)

  const handleCaptureView = () => {
    const view = getCurrentView()
    if (!view) return
    onChange({ ...settings, initialView: view })
    setViewCaptured(true)
    setTimeout(() => setViewCaptured(false), 2000)
  }

  return (
    <div className="space-y-5">
      <fieldset className="space-y-1.5">
        <legend className="text-xs font-bold uppercase tracking-wide text-ink-soft">
          {es.studio.map.mode}
        </legend>
        <SegmentedControl
          aria-label={es.studio.map.mode}
          value={settings.mode}
          onChange={(mode) => onChange({ ...settings, mode: mode as MapMode })}
          options={[
            { value: 'explorative', label: es.studio.map.modeExplorative },
            { value: 'guided', label: es.studio.map.modeGuided },
          ]}
        />
        <p className="text-xs font-semibold text-ink-soft">
          {settings.mode === 'guided'
            ? es.studio.map.modeGuidedHint
            : es.studio.map.modeExplorativeHint}
        </p>
      </fieldset>

      <label className="block space-y-1">
        <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">
          {es.studio.map.fit}
        </span>
        <Select
          value={settings.fit}
          onChange={(e) => onChange({ ...settings, fit: e.target.value as MapFit })}
        >
          {(Object.keys(es.studio.map.fitOptions) as MapFit[]).map((fit) => (
            <option key={fit} value={fit}>
              {es.studio.map.fitOptions[fit]}
            </option>
          ))}
        </Select>
      </label>

      <Button size="sm" variant="secondary" onClick={handleCaptureView}>
        {es.studio.map.useCurrentView}
      </Button>
      {viewCaptured && (
        <p role="status" className="text-xs font-bold text-leaf-dark">
          {es.studio.map.viewCaptured}
        </p>
      )}

      <label className="block space-y-1">
        <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">
          {es.studio.map.intro}
        </span>
        <Select
          value={settings.intro}
          onChange={(e) => onChange({ ...settings, intro: e.target.value as MapIntro })}
        >
          <option value="none">{es.studio.map.introOptions.none}</option>
          <option value="flyin">{es.studio.map.introOptions.flyin}</option>
        </Select>
      </label>

      <div className="border-soft space-y-2 rounded-md bg-surface-muted p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
          {es.studio.map.path}
        </p>
        <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-ink">
          <input
            className={checkboxClass}
            type="checkbox"
            checked={settings.path.visible}
            onChange={(e) =>
              onChange({ ...settings, path: { ...settings.path, visible: e.target.checked } })
            }
          />
          {es.studio.map.pathVisible}
        </label>
        <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-ink">
          <input
            className={checkboxClass}
            type="checkbox"
            checked={settings.path.animated}
            onChange={(e) =>
              onChange({ ...settings, path: { ...settings.path, animated: e.target.checked } })
            }
          />
          {es.studio.map.pathAnimated}
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-bold text-ink-soft">{es.studio.map.pathStyle}</span>
          <Select
            value={settings.path.style}
            onChange={(e) =>
              onChange({
                ...settings,
                path: { ...settings.path, style: e.target.value as PathStyle },
              })
            }
          >
            <option value="dashed">{es.studio.map.pathStyles.dashed}</option>
            <option value="dotted">{es.studio.map.pathStyles.dotted}</option>
            <option value="solid">{es.studio.map.pathStyles.solid}</option>
          </Select>
        </label>
        <label className="flex min-h-[44px] flex-wrap items-center gap-2 text-xs font-bold text-ink-soft">
          {es.studio.map.pathColor}
          <input
            className={checkboxClass}
            type="checkbox"
            checked={settings.path.color === null}
            onChange={(e) =>
              onChange({
                ...settings,
                path: { ...settings.path, color: e.target.checked ? null : '#0e9aa7' },
              })
            }
          />
          {es.studio.map.pathColorAuto}
          {settings.path.color !== null && (
            <input
              type="color"
              value={settings.path.color}
              onChange={(e) =>
                onChange({ ...settings, path: { ...settings.path, color: e.target.value } })
              }
              className="border-soft h-11 w-11 cursor-pointer rounded-md bg-surface"
            />
          )}
        </label>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">
          {es.studio.map.background}
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <img
            src={resolveThumbUrl(currentImageUrl)}
            alt={es.background.currentBackground}
            className="border-soft h-14 w-20 shrink-0 rounded-md object-cover"
          />
          <Button size="sm" variant="secondary" onClick={onChangeBackground}>
            {es.studio.map.changeBackground}
          </Button>
        </div>
      </div>
    </div>
  )
}

const AMBIENT_KINDS: AmbientKind[] = ['none', 'fireflies', 'snow', 'leaves', 'clouds', 'sparkles']

const AmbientTab = ({
  settings,
  onChange,
}: {
  settings: MapSettings
  onChange: (s: MapSettings) => void
}) => (
  <div className="space-y-4">
    <label className="block space-y-1">
      <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">
        {es.studio.ambient.kind}
      </span>
      <Select
        value={settings.ambient.kind}
        onChange={(e) =>
          onChange({
            ...settings,
            ambient: { ...settings.ambient, kind: e.target.value as AmbientKind },
          })
        }
      >
        {AMBIENT_KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {es.studio.ambient.kinds[kind]}
          </option>
        ))}
      </Select>
    </label>
    {settings.ambient.kind !== 'none' && (
      <label className="block space-y-1">
        <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">
          {es.studio.ambient.intensity} ({Math.round(settings.ambient.intensity * 100)}%)
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={settings.ambient.intensity * 100}
          onChange={(e) =>
            onChange({
              ...settings,
              ambient: { ...settings.ambient, intensity: Number(e.target.value) / 100 },
            })
          }
          className="h-11 w-full accent-primary"
        />
      </label>
    )}
  </div>
)

const SequenceTab = ({
  courseMapId,
  bubbles,
  mode,
}: {
  courseMapId: string
  bubbles: Bubble[]
  mode: MapMode
}) => {
  const reorderBubbles = useReorderBubbles(courseMapId)
  const sorted = [...bubbles].sort((a, b) => a.sequence - b.sequence)

  if (mode !== 'guided')
    return <p className="text-sm font-semibold text-ink-soft">{es.studio.sequence.onlyGuided}</p>
  if (sorted.length === 0)
    return <p className="text-sm font-semibold text-ink-soft">{es.studio.sequence.empty}</p>

  const moveBy = (bubbleId: string, delta: number) => {
    const index = sorted.findIndex((b) => b.id === bubbleId)
    const target = index + delta
    if (target < 0 || target >= sorted.length) return
    const ids = sorted.map((b) => b.id)
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    reorderBubbles.mutate(ids)
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-ink-soft">{es.studio.sequence.hint}</p>
      <ol className="space-y-1.5">
        {sorted.map((bubble, index) => (
          <li
            key={bubble.id}
            className="flex items-center gap-2 border-soft rounded-md bg-surface px-2.5 py-1.5 text-sm"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-pill border-hair bg-surface-muted text-xs font-bold text-ink">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 truncate font-semibold text-ink">
              {bubble.activityId}
            </span>
            <IconButton
              aria-label={es.studio.sequence.moveUp}
              variant="ghost"
              disabled={index === 0}
              onClick={() => moveBy(bubble.id, -1)}
            >
              <ChevronUp size={18} strokeWidth={3} aria-hidden />
            </IconButton>
            <IconButton
              aria-label={es.studio.sequence.moveDown}
              variant="ghost"
              disabled={index === sorted.length - 1}
              onClick={() => moveBy(bubble.id, 1)}
            >
              <ChevronDown size={18} strokeWidth={3} aria-hidden />
            </IconButton>
          </li>
        ))}
      </ol>
    </div>
  )
}

const AnimationTab = () => {
  const { setting, setSetting } = useAnimationQuality()
  return (
    <label className="block space-y-1">
      <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">
        {es.animationQuality.label}
      </span>
      <Select value={setting} onChange={(e) => setSetting(e.target.value as QualitySetting)}>
        {(['auto', 'high', 'medium', 'low', 'off'] as const).map((option) => (
          <option key={option} value={option}>
            {es.animationQuality.options[option]}
          </option>
        ))}
      </Select>
    </label>
  )
}

// Sequential PATCHes with a small concurrency cap - a demo convenience for
// the editor to see the whole experience without real student progress.
const withConcurrency = async <T,>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<unknown>
) => {
  let index = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index++]
      await worker(item)
    }
  })
  await Promise.all(runners)
}

const ProgressSimulator = ({
  courseMapId,
  bubbles,
  mode,
}: {
  courseMapId: string
  bubbles: Bubble[]
  mode: MapMode
}) => {
  const updateBubble = useUpdateBubble(courseMapId)
  const [isRunning, setIsRunning] = useState(false)
  const sorted = [...bubbles].sort((a, b) => a.sequence - b.sequence)

  const completeNext = () => {
    const next = sorted.find((b) => b.status !== 'complete')
    if (next) updateBubble.mutate({ bubbleId: next.id, input: { status: 'complete' } })
  }

  const completeAll = async () => {
    setIsRunning(true)
    await withConcurrency(
      sorted.filter((b) => b.status !== 'complete'),
      3,
      (bubble) => updateBubble.mutateAsync({ bubbleId: bubble.id, input: { status: 'complete' } })
    )
    setIsRunning(false)
  }

  const reset = async () => {
    setIsRunning(true)
    const minSequence = Math.min(...sorted.map((b) => b.sequence))
    await withConcurrency(sorted, 3, (bubble) =>
      updateBubble.mutateAsync({
        bubbleId: bubble.id,
        input: {
          status: mode === 'guided' && bubble.sequence > minSequence ? 'locked' : 'no_complete',
        },
      })
    )
    setIsRunning(false)
  }

  return (
    <div className="flex flex-wrap items-center border-t-soft gap-1.5 px-4 py-2.5">
      <span className="mr-auto text-xs font-bold uppercase tracking-wide text-ink-soft">
        {es.studio.simulator.title}
      </span>
      <IconButton
        aria-label={es.studio.simulator.completeNext}
        variant="ghost"
        onClick={completeNext}
        disabled={isRunning}
      >
        <Play size={16} strokeWidth={2.5} aria-hidden />
      </IconButton>
      <IconButton
        aria-label={es.studio.simulator.completeAll}
        variant="ghost"
        onClick={() => void completeAll()}
        disabled={isRunning}
      >
        <Zap size={16} strokeWidth={2.5} aria-hidden />
      </IconButton>
      <IconButton
        aria-label={es.studio.simulator.reset}
        variant="ghost"
        onClick={() => void reset()}
        disabled={isRunning}
      >
        <RotateCcw size={16} strokeWidth={2.5} aria-hidden />
      </IconButton>
    </div>
  )
}
