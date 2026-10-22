import { useEffect, useMemo, useState } from 'react'
import { Button } from '../../../components/ui/Button.tsx'
import { Input } from '../../../components/ui/Input.tsx'
import { Select } from '../../../components/ui/Select.tsx'
import { es } from '../../../i18n/es.ts'
import { getScene3d } from '../../../scenes3d/registry.ts'
import { ApiError } from '../../course-map/data/client.ts'
import { useUpdateView3d } from '../../course-map/data/draftMutations.ts'
import { useView3dScenes } from '../../course-map/data/queries.ts'
import type { Activity, CourseMapRead } from '../../course-map/data/types.ts'
import { DESCRIPTION3D_MAX_LENGTH, TITLE3D_MAX_LENGTH } from '../../course-map/data/view3dLimits.ts'
import { isWriteDiscarded } from '../../course-map/data/writeQueue.ts'
import {
  asView3dErrorCode,
  autoAssign,
  boundCount,
  clearBindings,
  formFromView3d,
  isDirty,
  overflowCount,
  setZoneBubble,
  setZoneText,
  toView3d,
  type View3dForm,
} from './view3dForm.ts'

const text = es.studio.view3d
const checkboxClass = 'h-5 w-5 shrink-0 accent-primary'
const areaClass =
  'border-soft min-h-[88px] w-full rounded-md bg-surface px-3 py-2 text-sm font-semibold text-ink placeholder:font-medium placeholder:text-slate-dark'

interface View3dTabProps {
  courseMap: CourseMapRead
  // The course's activities as the app's Moodle source reports them (the backend
  // standalone, the host embedded): only their names are read, for the zone list.
  activities: Activity[]
  // Opens the 3D view of the saved draft (the studio closes itself).
  onPreview: () => void
}

const errorMessage = (error: unknown): string | null => {
  if (isWriteDiscarded(error)) return null // the conflict dialog already told them
  if (error instanceof ApiError && error.status === 422) {
    const code = asView3dErrorCode(error.detail.code)
    if (code) return text.errors[code]
  }
  return text.errors.generic
}

// The editor side of the 3D view: enable it, pick the scene, say which
// activity goes in which zone and, optionally, override the texts. Saved with
// PUT /view3d through the map's guarded write queue.
export const View3dTab = ({ courseMap, activities, onPreview }: View3dTabProps) => {
  const scenesQuery = useView3dScenes()
  const update = useUpdateView3d(courseMap.id)

  // Backend scenes the frontend can also draw.
  const scenes = useMemo(
    () =>
      (scenesQuery.data ?? []).flatMap((backendScene) => {
        const definition = getScene3d(backendScene.id)
        return definition
          ? [{ definition, zoneCount: Math.min(definition.zoneCount, backendScene.zoneCount) }]
          : []
      }),
    [scenesQuery.data]
  )

  useEffect(() => {
    if (!import.meta.env.DEV) return
    for (const backendScene of scenesQuery.data ?? []) {
      const definition = getScene3d(backendScene.id)
      if (definition && definition.zoneCount !== backendScene.zoneCount) {
        console.warn(
          `[view3d] scene "${backendScene.id}": the backend has ${backendScene.zoneCount} zones, the frontend ${definition.zoneCount}`
        )
      }
    }
  }, [scenesQuery.data])

  const [form, setForm] = useState<View3dForm>(() => formFromView3d(courseMap.view3d, ''))
  const [baseline, setBaseline] = useState(courseMap.view3d)
  const [syncedAt, setSyncedAt] = useState(courseMap.updatedAt)

  // A newer draft (after our own save, a bubble deleted, a conflict reload)
  // replaces the form unless there are unsaved edits, which win.
  if (courseMap.updatedAt !== syncedAt) {
    setSyncedAt(courseMap.updatedAt)
    const hadEdits = isDirty(form, baseline)
    setBaseline(courseMap.view3d)
    if (!hadEdits) setForm(formFromView3d(courseMap.view3d, ''))
  }

  const sceneId = scenes.some((scene) => scene.definition.id === form.scene)
    ? form.scene
    : (scenes[0]?.definition.id ?? form.scene)
  const scene = scenes.find((item) => item.definition.id === sceneId)
  const effective: View3dForm = { ...form, scene: sceneId }

  const activityNames = useMemo(
    () => new Map(activities.map((activity) => [activity.activityId, activity.name])),
    [activities]
  )
  const bubbles = useMemo(
    () => [...courseMap.bubbles].sort((a, b) => a.sequence - b.sequence),
    [courseMap.bubbles]
  )
  const bubbleName = (bubbleId: string) => {
    const bubble = bubbles.find((item) => item.id === bubbleId)
    return bubble ? (activityNames.get(bubble.activityId) ?? `#${bubble.activityId}`) : bubbleId
  }

  const dirty = isDirty(effective, baseline)
  const bound = boundCount(effective)
  const needsBinding = effective.enabled && bound === 0
  const overflow = scene ? overflowCount(bubbles.length, scene.zoneCount) : 0
  const savedBindings = courseMap.view3d?.bindings.length ?? 0
  const canPreview = !dirty && courseMap.view3d !== null && savedBindings > 0

  const handleSave = () => update.mutate(toView3d(effective))
  const failure = update.isError ? errorMessage(update.error) : null

  const bindingElsewhere = (bubbleId: string, zone: number) =>
    Object.entries(form.rows).some(
      ([other, row]) => Number(other) !== zone && row.bubbleId === bubbleId
    )

  return (
    <div className="space-y-5">
      <label className="flex min-h-[44px] items-start gap-2 text-sm font-semibold text-ink">
        <input
          className={`${checkboxClass} mt-0.5`}
          type="checkbox"
          checked={form.enabled}
          onChange={(e) => setForm({ ...effective, enabled: e.target.checked })}
        />
        <span>
          {text.enable}
          <span className="block text-xs font-semibold text-ink-soft">{text.enableHint}</span>
        </span>
      </label>

      {form.enabled && (
        <>
          <p
            role="note"
            className="border-hair rounded-md bg-primary-tint px-3 py-2 text-xs font-bold text-ink"
          >
            {text.publishHint}
          </p>
          {scenesQuery.isError ? (
            <p role="alert" className="text-xs font-bold text-danger">
              {text.scenesError}
            </p>
          ) : scenes.length === 0 && !scenesQuery.isPending ? (
            <p className="text-xs font-bold text-danger">{text.noScenes}</p>
          ) : (
            <label className="block space-y-1">
              <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                {text.scene}
              </span>
              <Select
                value={sceneId}
                onChange={(e) => setForm({ ...effective, scene: e.target.value })}
              >
                {scenes.map(({ definition }) => (
                  <option key={definition.id} value={definition.id}>
                    {definition.label}
                  </option>
                ))}
              </Select>
              {scene && (
                <span className="block text-xs font-semibold text-ink-soft">
                  {text.sceneHint(scene.zoneCount)}
                </span>
              )}
            </label>
          )}

          {overflow > 0 && scene && (
            <p
              role="status"
              className="border-soft rounded-md bg-sun-tint px-3 py-2 text-xs font-bold text-sun-dark"
            >
              {text.overflow(scene.zoneCount, overflow)}
            </p>
          )}

          {scene && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-auto text-xs font-bold uppercase tracking-wide text-ink-soft">
                  {text.zones}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  dense
                  onClick={() =>
                    setForm(
                      autoAssign(
                        effective,
                        bubbles.map((bubble) => bubble.id),
                        scene.zoneCount
                      )
                    )
                  }
                  disabled={bubbles.length === 0}
                >
                  {text.assignAuto}
                </Button>
                <Button
                  size="sm"
                  variant="surface"
                  dense
                  onClick={() => setForm(clearBindings(effective))}
                  disabled={bound === 0}
                >
                  {text.clear}
                </Button>
              </div>

              <ul className="space-y-2">
                {scene.definition.zones.slice(0, scene.zoneCount).map((zone) => {
                  const row = form.rows[zone.id]
                  const zoneTitle = zone.title.es
                  // Free bubbles first; the ones taken by another zone stay
                  // visible but disabled.
                  const free = bubbles.filter(
                    (bubble) => bubble.id === row?.bubbleId || !bindingElsewhere(bubble.id, zone.id)
                  )
                  const taken = bubbles.filter((bubble) => !free.includes(bubble))
                  return (
                    <li key={zone.id} className="border-soft space-y-2 rounded-md bg-surface p-2.5">
                      <label className="block space-y-1">
                        <span className="text-xs font-bold text-ink">
                          {text.zoneName(zone.id + 1, zoneTitle)}
                        </span>
                        <Select
                          aria-label={text.pickActivity(zoneTitle)}
                          value={row?.bubbleId ?? ''}
                          onChange={(e) =>
                            setForm(setZoneBubble(effective, zone.id, e.target.value || null))
                          }
                        >
                          <option value="">{text.noActivity}</option>
                          {free.map((bubble) => (
                            <option key={bubble.id} value={bubble.id}>
                              {bubbleName(bubble.id)}
                            </option>
                          ))}
                          {taken.map((bubble) => (
                            <option key={bubble.id} value={bubble.id} disabled>
                              {bubbleName(bubble.id)} ({text.boundElsewhere})
                            </option>
                          ))}
                        </Select>
                      </label>

                      {row?.bubbleId && (
                        <details className="space-y-2">
                          <summary className="min-h-[44px] cursor-pointer py-2.5 text-xs font-bold text-ink-soft">
                            {text.overrides}
                          </summary>
                          <p className="text-xs font-semibold text-ink-soft">
                            {text.overridesHint}
                          </p>
                          {(['es', 'en'] as const).map((language) => (
                            <div key={language} className="space-y-1.5">
                              <label className="block space-y-1">
                                <span className="text-xs font-bold text-ink-soft">
                                  {language === 'es' ? text.titleEs : text.titleEn}
                                </span>
                                <Input
                                  density="compact"
                                  type="text"
                                  maxLength={TITLE3D_MAX_LENGTH}
                                  value={row.title[language]}
                                  placeholder={zone.title[language]}
                                  onChange={(e) =>
                                    setForm(
                                      setZoneText(
                                        effective,
                                        zone.id,
                                        'title',
                                        language,
                                        e.target.value
                                      )
                                    )
                                  }
                                />
                                <span className="block text-right text-[11px] font-semibold text-ink-soft">
                                  {text.counter(row.title[language].length, TITLE3D_MAX_LENGTH)}
                                </span>
                              </label>
                              <label className="block space-y-1">
                                <span className="text-xs font-bold text-ink-soft">
                                  {language === 'es' ? text.descriptionEs : text.descriptionEn}
                                </span>
                                <textarea
                                  className={areaClass}
                                  maxLength={DESCRIPTION3D_MAX_LENGTH}
                                  value={row.description[language]}
                                  placeholder={zone.description[language]}
                                  onChange={(e) =>
                                    setForm(
                                      setZoneText(
                                        effective,
                                        zone.id,
                                        'description',
                                        language,
                                        e.target.value
                                      )
                                    )
                                  }
                                />
                                <span className="block text-right text-[11px] font-semibold text-ink-soft">
                                  {text.counter(
                                    row.description[language].length,
                                    DESCRIPTION3D_MAX_LENGTH
                                  )}
                                </span>
                              </label>
                            </div>
                          ))}
                        </details>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {needsBinding && (
            <p role="status" className="text-xs font-bold text-sun-dark">
              {text.needBinding}
            </p>
          )}
        </>
      )}

      <div className="space-y-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={onPreview}
          disabled={!canPreview}
          title={dirty ? text.previewNeedsSave : canPreview ? undefined : text.previewDisabled}
        >
          {text.preview}
        </Button>
        {!canPreview && (
          <p className="text-xs font-semibold text-ink-soft">
            {dirty ? text.previewNeedsSave : text.previewDisabled}
          </p>
        )}
      </div>

      {failure && (
        <p role="alert" className="text-xs font-bold text-danger">
          {failure}
        </p>
      )}
      {update.isSuccess && !dirty && (
        <p role="status" className="text-xs font-bold text-leaf-dark">
          {text.saved}
        </p>
      )}

      {dirty && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setForm(formFromView3d(baseline, ''))
              update.reset()
            }}
          >
            {es.app.dismiss}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={update.isPending || needsBinding}>
            {update.isPending ? es.studio.saving : es.studio.save}
          </Button>
        </div>
      )}
    </div>
  )
}
