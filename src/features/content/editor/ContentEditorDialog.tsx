import { useEffect, useMemo, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Button } from '../../../components/ui/Button.tsx'
import { Dialog } from '../../../components/ui/Dialog.tsx'
import { Input } from '../../../components/ui/Input.tsx'
import { SegmentedControl } from '../../../components/ui/SegmentedControl.tsx'
import { es } from '../../../i18n/es.ts'
import { ContentBlocks } from '../ContentBlocks.tsx'
import { CONTENT_LIMITS, type AutoOpen, type BlocksContent, type Content } from '../contentTypes.ts'
import { blocksBodyBytes, byteLength, contentBytes, validateContent } from '../validateContent.ts'
import { WidgetFrame } from '../widget/WidgetFrame.tsx'
import { BlocksEditor } from './BlocksEditor.tsx'
import { fromEditorBlocks, toEditorBlocks, type EditorBlock } from './blockOps.ts'
import { describeProblems } from './contentMessages.ts'

const text = es.content.editor

const kb = (bytes: number) => (bytes / 1024).toFixed(1)

const BLANK_BLOCKS: BlocksContent = {
  type: 'blocks',
  title: '',
  autoOpen: 'never',
  body: { schemaVersion: 1, blocks: [] },
}

interface ContentEditorDialogProps {
  // The content being edited, or null to start a new one.
  initial: Content | null
  widgetsEnabled: boolean
  // What the level's other content bubbles already weigh, for the 1 MB counter.
  otherBytes: number
  saving: boolean
  // The server's last answer, in Spanish, when the save failed.
  error: string | null
  onSave: (content: Content) => void
  onCancel: () => void
}

const PREVIEW_DEBOUNCE_MS = 500

export const ContentEditorDialog = ({
  initial,
  widgetsEnabled,
  otherBytes,
  saving,
  error,
  onSave,
  onCancel,
}: ContentEditorDialogProps) => {
  const start = initial ?? BLANK_BLOCKS
  const [type, setType] = useState<Content['type']>(start.type)
  const [title, setTitle] = useState(start.title)
  const [autoOpen, setAutoOpen] = useState<AutoOpen>(start.autoOpen)
  const [items, setItems] = useState<EditorBlock[]>(() =>
    start.type === 'blocks' ? toEditorBlocks(start.body.blocks) : []
  )
  const [html, setHtml] = useState(start.type === 'widget' ? start.html : '')
  const [altText, setAltText] = useState(start.type === 'widget' ? start.altText : '')
  // The widget preview follows the typing, but not every keystroke: the frame
  // reloads each time its document changes.
  const [previewHtml, setPreviewHtml] = useState(html)
  useEffect(() => {
    const timer = setTimeout(() => setPreviewHtml(html), PREVIEW_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [html])

  const content: Content = useMemo(
    () =>
      type === 'blocks'
        ? { type, title, autoOpen, body: { schemaVersion: 1, blocks: fromEditorBlocks(items) } }
        : { type, title, autoOpen, altText, html },
    [type, title, autoOpen, items, altText, html]
  )
  const problems = useMemo(() => describeProblems(content, validateContent(content)), [content])
  const widgetBlocked = content.type === 'widget' && !widgetsEnabled
  const canSave = problems.length === 0 && !saving && !widgetBlocked

  const levelBytes = otherBytes + contentBytes(content)

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onCancel()}
      size="lg"
      title={initial ? text.editTitle : text.createTitle}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            {text.cancel}
          </Button>
          <Button disabled={!canSave} onClick={() => onSave(content)}>
            {saving ? text.saving : text.save}
          </Button>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-2">
        <div className="min-w-0 space-y-4">
          {!initial && widgetsEnabled && (
            <SegmentedControl
              aria-label={text.kindLabel}
              value={type}
              onChange={(next) => setType(next)}
              options={[
                { value: 'blocks', label: text.kindBlocks },
                { value: 'widget', label: text.kindWidget },
              ]}
            />
          )}
          <label className="block space-y-1">
            <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">
              {text.contentTitle}
            </span>
            <Input
              value={title}
              maxLength={CONTENT_LIMITS.titleMax}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="flex items-start gap-2 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              checked={autoOpen === 'first_visit'}
              onChange={(e) => setAutoOpen(e.target.checked ? 'first_visit' : 'never')}
              className="mt-1 h-5 w-5"
            />
            {text.autoOpen}
          </label>

          {type === 'blocks' ? (
            <div className="space-y-3">
              <h3 className="font-heading text-base font-extrabold text-ink">
                {text.blocksHeading}
              </h3>
              <BlocksEditor items={items} onChange={setItems} />
              <ul className="space-y-0.5 text-xs font-semibold text-ink-soft" aria-label="Límites">
                <li>{text.counters.blocks(items.length, CONTENT_LIMITS.maxBlocks)}</li>
                <li>
                  {text.counters.size(
                    kb(blocksBodyBytes(fromEditorBlocks(items))),
                    kb(CONTENT_LIMITS.maxBodyBytes)
                  )}
                </li>
                <li>
                  {text.counters.level(kb(levelBytes), kb(CONTENT_LIMITS.maxContentBytesPerMap))}
                </li>
              </ul>
            </div>
          ) : (
            <div className="space-y-3">
              <div
                role="note"
                className="border-hair flex items-start gap-2 rounded-md bg-sun-tint p-3 text-sm font-semibold text-sun-dark"
              >
                <TriangleAlert
                  size={18}
                  strokeWidth={2.5}
                  aria-hidden
                  className="mt-0.5 shrink-0"
                />
                <p>{text.widgetWarning}</p>
              </div>
              {widgetBlocked && (
                <p role="alert" className="text-sm font-bold text-danger">
                  {text.widgetDisabledEditor}
                </p>
              )}
              <label className="block space-y-1">
                <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                  {text.widgetHtml}
                </span>
                <textarea
                  value={html}
                  spellCheck={false}
                  onChange={(e) => setHtml(e.target.value)}
                  className="border-soft min-h-[240px] w-full rounded-md bg-surface px-3 py-2 font-mono text-xs text-ink"
                />
              </label>
              <p className="text-xs font-semibold text-ink-soft">
                {text.counters.size(kb(byteLength(html)), kb(CONTENT_LIMITS.widgetHtmlMaxBytes))}
              </p>
              <label className="block space-y-1">
                <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                  {text.widgetAlt}
                </span>
                <Input
                  value={altText}
                  maxLength={CONTENT_LIMITS.widgetAltMax}
                  onChange={(e) => setAltText(e.target.value)}
                />
                <span className="block text-xs text-ink-soft">{text.widgetAltHint}</span>
              </label>
            </div>
          )}

          {problems.length > 0 && (
            <div role="status" className="border-hair rounded-md bg-sun-tint p-3">
              <p className="text-sm font-bold text-sun-dark">{text.fixProblems}</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-sun-dark">
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm font-bold text-danger">
              {error}
            </p>
          )}
        </div>

        <section aria-labelledby="content-preview-title" className="min-w-0 space-y-2">
          <h3 id="content-preview-title" className="font-heading text-base font-extrabold text-ink">
            {text.preview}
          </h3>
          <p className="text-xs text-ink-soft">{text.previewHint}</p>
          <div className="border-soft rounded-md bg-surface p-3">
            <p className="mb-3 font-heading text-lg font-extrabold text-ink">{title}</p>
            {content.type === 'blocks' ? (
              <ContentBlocks blocks={content.body.blocks} />
            ) : previewHtml.trim() === '' ? null : (
              <WidgetFrame title={title} altText={altText} html={previewHtml} />
            )}
          </div>
        </section>
      </div>
    </Dialog>
  )
}

export default ContentEditorDialog
