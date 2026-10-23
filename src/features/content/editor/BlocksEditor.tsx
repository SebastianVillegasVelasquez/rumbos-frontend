import { useState, type KeyboardEvent } from 'react'
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2 } from 'lucide-react'
import { Button } from '../../../components/ui/Button.tsx'
import { Input } from '../../../components/ui/Input.tsx'
import { es } from '../../../i18n/es.ts'
import { resolveThumbUrl } from '../../course-map/data/assets.ts'
import { CONTENT_LIMITS, type Block } from '../contentTypes.ts'
import { isHttpsUrl } from '../validateContent.ts'
import { parseVideoInput } from '../video.ts'
import { blankBlock, moveItem, newKey, type EditorBlock } from './blockOps.ts'
import { ContentImagePicker } from './ContentImagePicker.tsx'

const text = es.content.editor

const BLOCK_TYPES: readonly Block['type'][] = [
  'heading',
  'paragraph',
  'image',
  'video',
  'link',
  'divider',
]

const fieldLabel = 'text-xs font-bold uppercase tracking-wide text-ink-soft'
const textareaClass =
  'border-soft min-h-[96px] w-full rounded-md bg-surface px-3 py-2 text-sm font-semibold text-ink'

const Field = ({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) => (
  <label className="block space-y-1">
    <span className={fieldLabel}>{label}</span>
    {children}
    {hint && <span className="block text-xs text-ink-soft">{hint}</span>}
  </label>
)

interface ItemProps<B extends Block> {
  block: B
  raw?: string
  onChange: (block: B, raw?: string) => void
}

const HeadingFields = ({ block, onChange }: ItemProps<Extract<Block, { type: 'heading' }>>) => (
  <div className="space-y-2">
    <Field label={text.level}>
      <select
        value={block.level}
        onChange={(e) => onChange({ ...block, level: e.target.value === '3' ? 3 : 2 })}
        className="border-soft min-h-[44px] w-full rounded-md bg-surface px-2 text-sm font-semibold text-ink"
      >
        <option value={2}>{text.level2}</option>
        <option value={3}>{text.level3}</option>
      </select>
    </Field>
    <Field label={text.text}>
      <Input
        value={block.text}
        maxLength={CONTENT_LIMITS.headingMax}
        onChange={(e) => onChange({ ...block, text: e.target.value })}
      />
    </Field>
  </div>
)

const ParagraphFields = ({ block, onChange }: ItemProps<Extract<Block, { type: 'paragraph' }>>) => (
  <Field label={text.text} hint={text.paragraphHint}>
    <textarea
      value={block.text}
      maxLength={CONTENT_LIMITS.paragraphMax}
      onChange={(e) => onChange({ ...block, text: e.target.value })}
      className={textareaClass}
    />
  </Field>
)

const ImageFields = ({ block, onChange }: ItemProps<Extract<Block, { type: 'image' }>>) => {
  const [picking, setPicking] = useState(false)
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        {block.assetId ? (
          <img
            src={resolveThumbUrl(`/assets/${block.assetId}`)}
            alt=""
            className="border-soft h-16 w-24 rounded-md bg-surface-muted object-cover"
          />
        ) : (
          <p className="text-sm text-ink-soft">{text.noImage}</p>
        )}
        <Button variant="secondary" dense size="sm" onClick={() => setPicking(true)}>
          <ImagePlus size={16} strokeWidth={2.5} aria-hidden />
          {block.assetId ? text.changeImage : text.chooseImage}
        </Button>
      </div>
      <ContentImagePicker
        open={picking}
        onOpenChange={setPicking}
        currentAssetId={block.assetId || null}
        onSelect={(asset) => onChange({ ...block, assetId: asset.id })}
      />
      <Field label={text.alt} hint={text.altHint}>
        <Input
          value={block.alt}
          maxLength={CONTENT_LIMITS.altMax}
          onChange={(e) => onChange({ ...block, alt: e.target.value })}
        />
      </Field>
      <Field label={text.caption}>
        <Input
          value={block.caption ?? ''}
          maxLength={CONTENT_LIMITS.captionMax}
          onChange={(e) => {
            const { caption: _caption, ...rest } = block
            void _caption
            onChange(e.target.value ? { ...rest, caption: e.target.value } : rest)
          }}
        />
      </Field>
    </div>
  )
}

const VideoFields = ({ block, raw, onChange }: ItemProps<Extract<Block, { type: 'video' }>>) => {
  const typed = raw ?? (block.videoId ? block.videoId : '')
  const parsed = typed.trim() === '' ? null : parseVideoInput(typed)
  return (
    <div className="space-y-2">
      <Field label={text.videoInput}>
        <Input
          value={typed}
          onChange={(e) => {
            const value = e.target.value
            const found = parseVideoInput(value)
            onChange(
              found
                ? { ...block, provider: found.provider, videoId: found.videoId }
                : { ...block, videoId: '' },
              value
            )
          }}
        />
      </Field>
      {parsed ? (
        <p className="text-xs font-semibold text-leaf-dark">
          {text.videoDetected(parsed.provider, parsed.videoId)}
        </p>
      ) : typed.trim() !== '' ? (
        <p role="alert" className="text-xs font-bold text-danger">
          {text.videoInvalid}
        </p>
      ) : null}
      <Field label={text.videoTitle}>
        <Input
          value={block.title}
          maxLength={CONTENT_LIMITS.videoTitleMax}
          onChange={(e) => onChange({ ...block, title: e.target.value }, raw)}
        />
      </Field>
    </div>
  )
}

const LinkFields = ({ block, onChange }: ItemProps<Extract<Block, { type: 'link' }>>) => (
  <div className="space-y-2">
    <Field label={text.linkText}>
      <Input
        value={block.text}
        maxLength={CONTENT_LIMITS.linkTextMax}
        onChange={(e) => onChange({ ...block, text: e.target.value })}
      />
    </Field>
    <Field label={text.linkUrl}>
      <Input
        type="url"
        value={block.url}
        onChange={(e) => onChange({ ...block, url: e.target.value })}
      />
    </Field>
    {block.url.trim() !== '' && block.url !== 'https://' && !isHttpsUrl(block.url) && (
      <p role="alert" className="text-xs font-bold text-danger">
        {text.linkInvalid}
      </p>
    )}
  </div>
)

const BlockFields = ({
  item,
  onChange,
}: {
  item: EditorBlock
  onChange: (item: EditorBlock) => void
}) => {
  const { block } = item
  const set = (next: Block, raw?: string) =>
    onChange({ ...item, block: next, rawVideo: raw ?? item.rawVideo })
  switch (block.type) {
    case 'heading':
      return <HeadingFields block={block} onChange={set} />
    case 'paragraph':
      return <ParagraphFields block={block} onChange={set} />
    case 'image':
      return <ImageFields block={block} onChange={set} />
    case 'video':
      return <VideoFields block={block} raw={item.rawVideo} onChange={set} />
    case 'link':
      return <LinkFields block={block} onChange={set} />
    case 'divider':
      return null
  }
}

interface BlocksEditorProps {
  items: EditorBlock[]
  onChange: (items: EditorBlock[]) => void
}

export const BlocksEditor = ({ items, onChange }: BlocksEditorProps) => {
  const [adding, setAdding] = useState<Block['type']>('paragraph')
  const full = items.length >= CONTENT_LIMITS.maxBlocks

  const move = (index: number, by: -1 | 1) => onChange(moveItem(items, index, by))

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    if (!event.altKey) return
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      move(index, -1)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      move(index, 1)
    }
  }

  return (
    <div className="space-y-3">
      <ol className="space-y-3">
        {items.map((item, index) => {
          const name = text.blockNames[item.block.type]
          return (
            <li
              key={item.key}
              onKeyDown={(event) => onKeyDown(event, index)}
              className="border-soft space-y-2 rounded-md bg-surface-muted p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-extrabold text-ink">
                  {index + 1}. {name}
                </p>
                <div className="flex gap-1">
                  <Button
                    variant="secondary"
                    dense
                    size="sm"
                    className="min-w-[44px] px-0"
                    disabled={index === 0}
                    aria-label={text.moveUp(index + 1, name)}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp size={16} strokeWidth={2.5} aria-hidden />
                  </Button>
                  <Button
                    variant="secondary"
                    dense
                    size="sm"
                    className="min-w-[44px] px-0"
                    disabled={index === items.length - 1}
                    aria-label={text.moveDown(index + 1, name)}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown size={16} strokeWidth={2.5} aria-hidden />
                  </Button>
                  <Button
                    variant="dangerGhost"
                    dense
                    size="sm"
                    className="min-w-[44px] px-0"
                    aria-label={text.remove(index + 1, name)}
                    onClick={() => onChange(items.filter((other) => other.key !== item.key))}
                  >
                    <Trash2 size={16} strokeWidth={2.5} aria-hidden />
                  </Button>
                </div>
              </div>
              <BlockFields
                item={item}
                onChange={(next) =>
                  onChange(items.map((other) => (other.key === item.key ? next : other)))
                }
              />
            </li>
          )
        })}
      </ol>
      <div className="flex flex-wrap items-end gap-2">
        <Field label={text.addBlock}>
          <select
            value={adding}
            onChange={(e) => setAdding(e.target.value as Block['type'])}
            className="border-soft min-h-[44px] rounded-md bg-surface px-2 text-sm font-semibold text-ink"
          >
            {BLOCK_TYPES.map((type) => (
              <option key={type} value={type}>
                {text.blockNames[type]}
              </option>
            ))}
          </select>
        </Field>
        <Button
          variant="secondary"
          disabled={full}
          onClick={() => onChange([...items, { key: newKey(), block: blankBlock(adding) }])}
        >
          <Plus size={16} strokeWidth={3} aria-hidden />
          {text.addBlock}
        </Button>
      </div>
    </div>
  )
}
