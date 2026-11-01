import { useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCw, Settings2, Table2, X } from 'lucide-react'
import { Button, IconButton } from '../../components/ui/Button.tsx'
import { Select } from '../../components/ui/Select.tsx'
import { announce } from '../../components/ui/announce.ts'
import { es } from '../../i18n/es.ts'
import type { BubbleHeat } from '../course-map/types/course-props.types.ts'
import { useEmbed } from '../embed/EmbedContext.ts'
import type { CourseStats } from '../embed/protocol.ts'
import {
  HEAT_STOPS,
  buildHeatRows,
  computeInsights,
  minutesSince,
  percent,
  type HeatRow,
  type StepInput,
} from './insights.ts'
import { overlayFor } from './overlay.ts'
import { useHeatmap } from './useHeatmap.ts'

const text = es.heatmap

interface HeatmapPanelProps {
  // The level's activity bubbles, with the names the teacher sees.
  steps: StepInput[]
  onOverlay: (overlay: ReadonlyMap<string, BubbleHeat> | null) => void
  onHide: () => void
  // Offered only to an editor whose host can open the activity's settings.
  onConfigure?: (cmid: number) => void
}

// Lightness steps of the legend, as text ranges next to each swatch.
const LEGEND = HEAT_STOPS.map((color, index) => ({
  color,
  label: text.legendStep(
    Math.round((index * 100) / HEAT_STOPS.length),
    Math.round(((index + 1) * 100) / HEAT_STOPS.length)
  ),
}))

const HeatmapPanel = ({ steps, onOverlay, onHide, onConfigure }: HeatmapPanelProps) => {
  const embed = useEmbed()
  const { state, refresh, selectGroup } = useHeatmap(embed?.requestStats ?? noop)
  const [showTable, setShowTable] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const stats: CourseStats | null =
    state.status === 'ready' ? state.stats : state.status === 'loading' ? state.previous : null
  const receivedAt = state.status === 'ready' ? state.receivedAt : null
  const refreshing = state.status === 'loading'

  const rows: HeatRow[] = useMemo(
    () => (stats && !stats.suppressed ? buildHeatRows(steps, stats) : []),
    [steps, stats]
  )
  const insights = useMemo(() => computeInsights(rows), [rows])
  const hasCounts = rows.some((row) => row.kind === 'counts')

  // What the canvas draws. Gone with the panel.
  useEffect(() => {
    onOverlay(rows.length > 0 ? overlayFor(rows) : null)
  }, [rows, onOverlay])
  useEffect(() => () => onOverlay(null), [onOverlay])

  // "Actualizado hace N min" keeps counting between refreshes.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    if (receivedAt !== null) announce(text.announceUpdated)
  }, [receivedAt])

  return (
    <section
      aria-label={text.panelLabel}
      className="border-soft flex max-h-[60dvh] w-full flex-col gap-3 overflow-y-auto rounded-lg bg-surface p-3 shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-base font-extrabold text-ink">{text.title}</h2>
        <div className="flex items-center gap-1">
          <IconButton
            variant="secondary"
            aria-label={text.refresh}
            title={text.refresh}
            disabled={refreshing}
            onClick={refresh}
          >
            {refreshing ? (
              <Loader2 size={18} className="motion-safe:animate-spin" aria-hidden />
            ) : (
              <RefreshCw size={18} strokeWidth={2.5} aria-hidden />
            )}
          </IconButton>
          <IconButton variant="secondary" aria-label={text.hide} title={text.hide} onClick={onHide}>
            <X size={18} strokeWidth={2.5} aria-hidden />
          </IconButton>
        </div>
      </div>

      {state.status === 'loading' && !stats && (
        <p role="status" className="text-sm font-semibold text-ink-soft">
          {text.loading}
        </p>
      )}
      {state.status === 'silent' && (
        <p role="status" className="text-sm font-semibold text-ink">
          {text.silent}
        </p>
      )}
      {state.status === 'error' && (
        <div role="status" className="space-y-2">
          <p className="text-sm font-semibold text-ink">
            {state.error === 'capability' ? text.noPermission : text.unavailable}
          </p>
          {state.error === 'unavailable' && (
            <Button type="button" variant="secondary" size="sm" onClick={refresh}>
              {text.retry}
            </Button>
          )}
        </div>
      )}

      {stats && (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {stats.groups.length > 1 && (
              <label className="flex min-w-0 flex-1 items-center gap-2 text-xs font-bold text-ink">
                {text.groupLabel}
                <Select
                  value={String(stats.groupId)}
                  disabled={refreshing}
                  onChange={(event) => {
                    const id = Number(event.target.value)
                    selectGroup(id === 0 ? undefined : id)
                  }}
                >
                  <option value="0">{text.allGroups}</option>
                  {stats.groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </Select>
              </label>
            )}
            <p className="text-xs font-semibold text-ink-soft">
              {text.updated(minutesSince(stats.generatedAt, receivedAt ?? now, now))}
              {refreshing && ` · ${text.refreshing}`}
            </p>
          </div>

          {stats.suppressed ? (
            <div role="status" className="space-y-1">
              <p className="text-sm font-bold text-ink">{text.suppressed}</p>
              <p className="text-xs font-medium text-ink-soft">
                {text.suppressedWhy(stats.minCohort)}
              </p>
            </div>
          ) : stats.tracked === 0 ? (
            <p role="status" className="text-sm font-semibold text-ink">
              {text.empty}
            </p>
          ) : !hasCounts ? (
            <p role="status" className="text-sm font-semibold text-ink">
              {text.noTrackedSteps}
            </p>
          ) : (
            <>
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-wide text-ink">
                  {text.legendTitle}
                </p>
                <ul className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
                  {LEGEND.map((step) => (
                    <li
                      key={step.label}
                      className="flex items-center gap-1.5 text-xs font-semibold text-ink"
                    >
                      <span
                        aria-hidden
                        className="h-4 w-4 shrink-0 rounded-pill border-2 border-ink"
                        style={{ background: step.color }}
                      />
                      {step.label}
                    </li>
                  ))}
                </ul>
              </div>

              <ul className="space-y-0.5 text-sm font-bold text-ink">
                {insights.overall !== null && <li>{text.overall(percent(insights.overall))}</li>}
                <li className="font-semibold">
                  {insights.biggestDrop
                    ? text.biggestDrop(insights.biggestDrop.name, insights.biggestDrop.points)
                    : insights.trackedSteps > 1
                      ? text.noDrop
                      : null}
                </li>
              </ul>
            </>
          )}

          {!stats.suppressed && stats.tracked > 0 && rows.length > 0 && (
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                aria-expanded={showTable}
                aria-controls="heatmap-table"
                onClick={() => setShowTable((open) => !open)}
              >
                <Table2 size={16} strokeWidth={2.5} aria-hidden />
                {showTable ? text.hideTable : text.showTable}
              </Button>
              {showTable && <SummaryTable rows={rows} onConfigure={onConfigure} />}
            </>
          )}
        </>
      )}
    </section>
  )
}

const noop = () => undefined

// "Resumen del grupo": the same numbers as the rings, for the keyboard and the
// screen reader.
const SummaryTable = ({
  rows,
  onConfigure,
}: {
  rows: HeatRow[]
  onConfigure?: (cmid: number) => void
}) => (
  <div
    id="heatmap-table"
    role="region"
    aria-label={text.table.caption}
    tabIndex={0}
    className="overflow-x-auto rounded-md focus-visible:outline focus-visible:outline-2"
  >
    <table className="w-full min-w-[22rem] border-collapse text-left text-xs text-ink">
      <caption className="pb-1 text-left text-xs font-bold uppercase tracking-wide">
        {text.table.caption}
      </caption>
      <thead>
        <tr className="border-b-soft">
          <th scope="col" className="py-1 pr-2 font-bold">
            {text.table.activity}
          </th>
          <th scope="col" className="px-2 py-1 text-right font-bold">
            {text.table.tracked}
          </th>
          <th scope="col" className="px-2 py-1 text-right font-bold">
            {text.table.complete}
          </th>
          <th scope="col" className="px-2 py-1 text-right font-bold">
            {text.table.failed}
          </th>
          <th scope="col" className="py-1 pl-2 text-right font-bold">
            {text.table.percent}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.bubbleId} className="border-b-soft align-top">
            <th scope="row" className="py-1.5 pr-2 font-semibold">
              {row.name}
            </th>
            {row.kind === 'counts' ? (
              <>
                <td className="px-2 py-1.5 text-right">{row.students}</td>
                <td className="px-2 py-1.5 text-right">{row.complete}</td>
                <td className="px-2 py-1.5 text-right">{row.failed}</td>
                <td className="py-1.5 pl-2 text-right font-bold">
                  {text.badge(percent(row.rate))}
                </td>
              </>
            ) : (
              <td colSpan={4} className="py-1.5 pl-2 text-right">
                <span className="font-semibold">{text.table.untracked}</span>
                {onConfigure && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-2"
                    aria-label={text.configureAria(row.name)}
                    onClick={() => onConfigure(row.cmid)}
                  >
                    <Settings2 size={14} strokeWidth={2.5} aria-hidden />
                    {text.configure}
                  </Button>
                )}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

export default HeatmapPanel
