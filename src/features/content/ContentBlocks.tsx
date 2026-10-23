import { useState } from 'react'
import { Play } from 'lucide-react'
import { es } from '../../i18n/es.ts'
import { Button } from '../../components/ui/Button.tsx'
import { isAssetPath, resolveImageUrl } from '../course-map/data/assets.ts'
import type { Block } from './contentTypes.ts'
import { isHttpsUrl } from './validateContent.ts'
import { videoEmbedUrl } from './video.ts'

// Blocks are data. Every string below reaches the page as a React text node or
// as an attribute built from a validated value; there is no innerHTML anywhere
// in this feature.

const VideoBlock = ({ block }: { block: Extract<Block, { type: 'video' }> }) => {
  const [loaded, setLoaded] = useState(false)
  const src = videoEmbedUrl(block.provider, block.videoId)
  if (!src) return null
  const text = es.content.viewer
  return (
    <figure className="border-soft overflow-hidden rounded-md bg-surface-muted">
      <div className="relative aspect-video w-full">
        {loaded ? (
          <iframe
            src={src}
            title={text.videoFrameTitle(block.title)}
            className="absolute inset-0 h-full w-full border-0"
            allow="fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
            <p className="font-heading text-base font-bold text-ink">{block.title}</p>
            <Button variant="secondary" onClick={() => setLoaded(true)}>
              <Play size={16} strokeWidth={2.5} aria-hidden />
              {text.playVideo(block.provider)}
            </Button>
          </div>
        )}
      </div>
    </figure>
  )
}

const ImageBlock = ({ block }: { block: Extract<Block, { type: 'image' }> }) => {
  const [failed, setFailed] = useState(false)
  const path = `/assets/${block.assetId}`
  if (!isAssetPath(path)) return null
  return (
    <figure className="space-y-1">
      {failed ? (
        <p className="border-soft rounded-md bg-surface-muted p-3 text-sm text-ink-soft">
          {es.content.viewer.missingImage} {block.alt}
        </p>
      ) : (
        <img
          src={resolveImageUrl(path)}
          alt={block.alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="border-soft h-auto max-w-full rounded-md"
        />
      )}
      {block.caption && <figcaption className="text-sm text-ink-soft">{block.caption}</figcaption>}
    </figure>
  )
}

const BlockView = ({ block }: { block: Block }) => {
  switch (block.type) {
    case 'heading':
      return block.level === 2 ? (
        <h3 className="font-heading text-xl font-extrabold text-ink">{block.text}</h3>
      ) : (
        <h4 className="font-heading text-lg font-bold text-ink">{block.text}</h4>
      )
    case 'paragraph':
      return <p className="whitespace-pre-line text-base leading-relaxed text-ink">{block.text}</p>
    case 'image':
      return <ImageBlock block={block} />
    case 'video':
      return <VideoBlock block={block} />
    case 'link':
      // Defense in depth: the backend only stores https, and so do we.
      return isHttpsUrl(block.url) ? (
        <p>
          <a
            href={block.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary underline underline-offset-2"
          >
            {block.text}
            <span className="sr-only"> {es.content.viewer.opensInNewTab}</span>
          </a>
        </p>
      ) : null
    case 'divider':
      return <hr className="border-soft" />
    default:
      return null
  }
}

export const ContentBlocks = ({ blocks }: { blocks: readonly Block[] }) =>
  blocks.length === 0 ? (
    <p className="text-sm text-ink-soft">{es.content.viewer.empty}</p>
  ) : (
    <div className="space-y-4">
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} />
      ))}
    </div>
  )
