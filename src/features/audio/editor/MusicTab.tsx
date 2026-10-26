import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Loader2, Pause, Play } from 'lucide-react'
import { Button } from '../../../components/ui/Button.tsx'
import { Input } from '../../../components/ui/Input.tsx'
import { SegmentedControl } from '../../../components/ui/SegmentedControl.tsx'
import { es } from '../../../i18n/es.ts'
import { resolveImageUrl } from '../../course-map/data/assets.ts'
import { ApiError, isUnreachable } from '../../course-map/data/client.ts'
import { useAssets, useCreateAsset } from '../../course-map/data/queries.ts'
import {
  DEFAULT_MAP_AUDIO,
  type Asset,
  type AssetListParams,
  type MapAudio,
  type MapSettings,
} from '../../course-map/data/types.ts'
import { isAvailable } from '../audioAvailability.ts'
import {
  AUDIO_LIBRARY_PARAMS,
  AUDIO_MIME_TYPES,
  checkAudioForm,
  classifyAudioError,
  formatDuration,
  type AudioErrorKey,
  type AudioFieldProblem,
} from './audioErrors.ts'

const text = es.audio.editor

const TENANT_PARAMS: AssetListParams = { kind: 'audio', scope: 'tenant', limit: 100 }

const checkboxClass = 'h-5 w-5 shrink-0 accent-primary'

const errorText = (key: AudioErrorKey) => text.errors[key]

const problemText = (problem: AudioFieldProblem) => text.problems[problem]

interface MusicTabProps {
  settings: MapSettings
  onChange: (settings: MapSettings) => void
}

// The editor's "Música" tab in the Appearance studio: pick a track from the
// library curated by OBJ Digital, or upload one of your own (with its credit and
// a declaration of rights), then set how it plays.
export const MusicTab = ({ settings, onChange }: MusicTabProps) => {
  const [source, setSource] = useState<'library' | 'own'>('library')
  // A 503 audio_uploads_disabled hides the upload tab and says why.
  const [uploadsDisabled, setUploadsDisabled] = useState(false)
  const library = useAssets(AUDIO_LIBRARY_PARAMS)
  const own = useAssets(TENANT_PARAMS, !uploadsDisabled)
  const audio = settings.audio ?? null

  // One shared preview player: starting another stops the first.
  const previewRef = useRef<HTMLAudioElement | null>(null)
  const [previewing, setPreviewing] = useState<string | null>(null)
  // Tracks whose file did not play when previewed: the same warning as a
  // missing file, found by listening.
  const [brokenPreviews, setBrokenPreviews] = useState<ReadonlySet<string>>(new Set())
  useEffect(
    () => () => {
      previewRef.current?.pause()
    },
    []
  )
  const togglePreview = (asset: Asset) => {
    const player = (previewRef.current ??= new Audio())
    if (previewing === asset.id) {
      player.pause()
      setPreviewing(null)
      return
    }
    player.preload = 'none'
    player.src = resolveImageUrl(asset.url)
    player.onended = () => setPreviewing(null)
    const broke = () => {
      setPreviewing(null)
      setBrokenPreviews((current) => new Set(current).add(asset.id))
    }
    player.onerror = broke
    void player.play().catch((error: unknown) => {
      // A blocked or interrupted play is not a missing file.
      if (error instanceof DOMException && error.name === 'NotAllowedError') setPreviewing(null)
      else if (error instanceof DOMException && error.name === 'AbortError') return
      else broke()
    })
    setPreviewing(asset.id)
  }

  const choose = (asset: Asset) =>
    onChange({
      ...settings,
      audio: {
        assetId: asset.id,
        volume: audio?.volume ?? DEFAULT_MAP_AUDIO.volume,
        loop: audio?.loop ?? DEFAULT_MAP_AUDIO.loop,
        startAfterInteraction:
          audio?.startAfterInteraction ?? DEFAULT_MAP_AUDIO.startAfterInteraction,
      },
    })
  const patchAudio = (patch: Partial<MapAudio>) => {
    if (audio) onChange({ ...settings, audio: { ...audio, ...patch } })
  }
  const remove = () => {
    previewRef.current?.pause()
    setPreviewing(null)
    onChange({ ...settings, audio: null })
  }

  const items = (source === 'library' ? library.data?.items : own.data?.items) ?? []
  const chosen =
    [...(library.data?.items ?? []), ...(own.data?.items ?? [])].find(
      (item) => item.id === audio?.assetId
    ) ?? null
  const currentBroken =
    audio !== null &&
    ((chosen !== null && !isAvailable(chosen)) || brokenPreviews.has(audio.assetId))
  const activeQuery = source === 'library' ? library : own

  return (
    <div className="space-y-4">
      {audio && (
        <section aria-labelledby="music-current" className="border-soft space-y-3 rounded-md p-3">
          <div>
            <h3
              id="music-current"
              className="text-xs font-bold uppercase tracking-wide text-ink-soft"
            >
              {text.current}
            </h3>
            <p className="break-words text-sm font-bold text-ink">
              {chosen ? chosen.title : text.currentUnknown}
            </p>
            {chosen?.credit && (
              <p className="break-words text-xs font-semibold text-ink-soft">{chosen.credit}</p>
            )}
          </div>
          {currentBroken && (
            <p role="alert" className="text-xs font-bold text-danger">
              {es.audio.unavailableWarning}
            </p>
          )}
          {chosen && isAvailable(chosen) && (
            <Button variant="surface" dense size="sm" onClick={() => togglePreview(chosen)}>
              {previewing === chosen.id ? (
                <Pause size={16} strokeWidth={2.5} aria-hidden />
              ) : (
                <Play size={16} strokeWidth={2.5} aria-hidden />
              )}
              {previewing === chosen.id ? text.stop : text.listen}
            </Button>
          )}
          <label className="block space-y-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
            {text.volume} ({Math.round(audio.volume * 100)}%)
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(audio.volume * 100)}
              onChange={(event) => patchAudio({ volume: Number(event.target.value) / 100 })}
              className="h-11 w-full accent-primary"
            />
          </label>
          <label className="flex min-h-[44px] items-center gap-3 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              className={checkboxClass}
              checked={audio.loop}
              onChange={(event) => patchAudio({ loop: event.target.checked })}
            />
            {text.loop}
          </label>
          <label className="flex min-h-[44px] items-start gap-3 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              className={`${checkboxClass} mt-0.5`}
              checked={audio.startAfterInteraction}
              onChange={(event) => patchAudio({ startAfterInteraction: event.target.checked })}
            />
            <span>
              {text.startAfterInteraction}
              <span className="block text-xs font-medium text-ink-soft">
                {text.startAfterInteractionHint}
              </span>
            </span>
          </label>
          <Button variant="dangerGhost" dense size="sm" onClick={remove}>
            {text.remove}
          </Button>
        </section>
      )}

      {!uploadsDisabled ? (
        <SegmentedControl
          aria-label={text.sourceLabel}
          value={source}
          onChange={setSource}
          options={[
            { value: 'library', label: text.library },
            { value: 'own', label: text.own },
          ]}
        />
      ) : (
        <p
          role="note"
          className="border-hair rounded-md bg-sun-tint p-2 text-xs font-semibold text-sun-dark"
        >
          {text.uploadsDisabled}
        </p>
      )}

      {source === 'own' && !uploadsDisabled && (
        <UploadForm
          onUploaded={(asset) => {
            choose(asset)
            setSource('own')
          }}
          onDisabled={() => {
            setUploadsDisabled(true)
            setSource('library')
          }}
        />
      )}

      <section aria-label={source === 'library' ? text.library : text.own} className="space-y-2">
        {activeQuery.isPending && (
          <p className="flex items-center gap-2 text-sm font-semibold text-ink-soft" role="status">
            <Loader2 size={16} className="motion-safe:animate-spin" aria-hidden />
            {text.loading}
          </p>
        )}
        {activeQuery.isError && (
          <p className="text-sm font-semibold text-danger" role="alert">
            {text.loadError}
          </p>
        )}
        {activeQuery.isSuccess && items.length === 0 && (
          <p className="text-sm font-semibold text-ink-soft">
            {source === 'library' ? text.emptyLibrary : text.emptyOwn}
          </p>
        )}
        <ul className="space-y-1.5">
          {items.map((asset) => {
            const selected = asset.id === audio?.assetId
            const available = isAvailable(asset)
            return (
              <li
                key={asset.id}
                className={`flex items-center gap-2 rounded-md p-2 ${
                  selected ? 'border-soft bg-primary-tint' : 'border-hair bg-surface-muted'
                }`}
              >
                <Button
                  variant="surface"
                  dense
                  size="sm"
                  className="shrink-0 px-0"
                  aria-label={`${previewing === asset.id ? text.stop : text.listen}: ${asset.title}`}
                  disabled={!available}
                  onClick={() => togglePreview(asset)}
                >
                  {previewing === asset.id ? (
                    <Pause size={16} strokeWidth={2.5} aria-hidden />
                  ) : (
                    <Play size={16} strokeWidth={2.5} aria-hidden />
                  )}
                </Button>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-bold text-ink">{asset.title}</p>
                  <p className="break-words text-xs font-semibold text-ink-soft">
                    {[
                      available ? null : text.unavailable,
                      asset.credit,
                      formatDuration(asset.durationSeconds),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <Button
                  variant={selected ? 'primary' : 'secondary'}
                  dense
                  size="sm"
                  className="shrink-0"
                  aria-pressed={selected}
                  disabled={!available}
                  onClick={() => choose(asset)}
                >
                  {selected ? text.chosen : text.choose}
                </Button>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

const UploadForm = ({
  onUploaded,
  onDisabled,
}: {
  onUploaded: (asset: Asset) => void
  onDisabled: () => void
}) => {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [credit, setCredit] = useState('')
  const [license, setLicense] = useState('')
  const [declared, setDeclared] = useState(false)
  const [problem, setProblem] = useState<AudioFieldProblem | null>(null)
  const [failure, setFailure] = useState<AudioErrorKey | null>(null)
  const create = useCreateAsset()

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFailure(null)
    const found = checkAudioForm({ file, title, credit, declared })
    setProblem(found)
    if (found || !file) return
    create.mutate(
      {
        file,
        kind: 'audio',
        title: title.trim(),
        credit: credit.trim(),
        license: license.trim() || undefined,
        rightsDeclared: true,
      },
      {
        onSuccess: (result) => {
          setFile(null)
          setTitle('')
          setCredit('')
          setLicense('')
          setDeclared(false)
          onUploaded(result.asset)
        },
        onError: (error) => {
          const key = classifyAudioError({
            status: isUnreachable(error) ? 0 : error instanceof ApiError ? error.status : -1,
            code: error instanceof ApiError ? (error.detail.code as string | undefined) : undefined,
          })
          if (key === 'audio_uploads_disabled') onDisabled()
          else setFailure(key)
        },
      }
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      <p
        role="note"
        className="border-hair rounded-md bg-surface-muted p-2 text-xs font-semibold text-ink-soft"
      >
        {text.rightsNotice}
      </p>
      <label className="block space-y-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
        {text.file}
        <input
          type="file"
          accept={[...AUDIO_MIME_TYPES, '.mp3', '.m4a'].join(',')}
          onChange={(event) => {
            const picked = event.target.files?.[0] ?? null
            setFile(picked)
            if (picked && !title) setTitle(picked.name.replace(/\.[^.]+$/, ''))
          }}
          className="block min-h-[44px] w-full text-sm font-semibold normal-case text-ink"
        />
      </label>
      <label className="block space-y-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
        {text.title}
        <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} />
      </label>
      <label className="block space-y-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
        {text.credit}
        <Input
          value={credit}
          onChange={(event) => setCredit(event.target.value)}
          maxLength={300}
          placeholder={text.creditPlaceholder}
          aria-required
        />
      </label>
      <label className="block space-y-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
        {text.license}
        <Input
          value={license}
          onChange={(event) => setLicense(event.target.value)}
          maxLength={120}
        />
      </label>
      <label className="flex min-h-[44px] items-start gap-3 text-sm font-semibold text-ink">
        <input
          type="checkbox"
          className={`${checkboxClass} mt-0.5`}
          checked={declared}
          onChange={(event) => setDeclared(event.target.checked)}
          aria-required
        />
        <span>{text.declaration}</span>
      </label>
      {(problem || failure) && (
        <p role="alert" className="text-xs font-bold text-danger">
          {problem ? problemText(problem) : failure ? errorText(failure) : null}
        </p>
      )}
      <Button type="submit" size="sm" disabled={create.isPending}>
        {create.isPending ? text.uploading : text.upload}
      </Button>
    </form>
  )
}
