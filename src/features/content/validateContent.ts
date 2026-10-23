import { CONTENT_LIMITS, type Block, type Content } from './contentTypes.ts'

// The backend's content rules, mirrored so the editor can say what is wrong
// before saving and the mock API can answer 422 content_invalid the same way.
// The backend stays the authority: this never replaces its answer.

export interface ContentProblem {
  // Where: "title", "blocks.2.alt", "html"...
  path: string
  code: 'required' | 'too_long' | 'too_many' | 'too_large' | 'invalid' | 'not_https' | 'wrong_type'
}

const encoder = new TextEncoder()
export const byteLength = (text: string) => encoder.encode(text).length

export const blocksBodyBytes = (blocks: readonly Block[]) =>
  byteLength(JSON.stringify({ schemaVersion: 1, blocks }))

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/
const VIMEO_ID = /^\d{6,12}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const isVideoId = (provider: string, videoId: string) =>
  provider === 'youtube'
    ? YOUTUBE_ID.test(videoId)
    : provider === 'vimeo'
      ? VIMEO_ID.test(videoId)
      : false

const MAX_URL_LENGTH = 2000

// https only, no credentials in the address.
export const isHttpsUrl = (value: string): boolean => {
  if (value.length > MAX_URL_LENGTH) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.username === '' && url.password === ''
  } catch {
    return false
  }
}

const text = (
  problems: ContentProblem[],
  path: string,
  value: unknown,
  max: number,
  required = true
) => {
  if (typeof value !== 'string') {
    problems.push({ path, code: 'wrong_type' })
    return
  }
  if (required && value.trim() === '') problems.push({ path, code: 'required' })
  else if (value.length > max) problems.push({ path, code: 'too_long' })
}

const validateBlock = (block: Block, path: string, problems: ContentProblem[]) => {
  switch (block.type) {
    case 'heading':
      text(problems, `${path}.text`, block.text, CONTENT_LIMITS.headingMax)
      if (block.level !== 2 && block.level !== 3)
        problems.push({ path: `${path}.level`, code: 'invalid' })
      return
    case 'paragraph':
      text(problems, `${path}.text`, block.text, CONTENT_LIMITS.paragraphMax)
      return
    case 'image':
      if (typeof block.assetId !== 'string' || !UUID.test(block.assetId))
        problems.push({ path: `${path}.assetId`, code: 'required' })
      text(problems, `${path}.alt`, block.alt, CONTENT_LIMITS.altMax)
      if (block.caption !== undefined)
        text(problems, `${path}.caption`, block.caption, CONTENT_LIMITS.captionMax, false)
      return
    case 'video':
      if (!isVideoId(block.provider, String(block.videoId)))
        problems.push({ path: `${path}.videoId`, code: 'invalid' })
      text(problems, `${path}.title`, block.title, CONTENT_LIMITS.videoTitleMax)
      return
    case 'link':
      text(problems, `${path}.text`, block.text, CONTENT_LIMITS.linkTextMax)
      if (typeof block.url !== 'string' || !isHttpsUrl(block.url))
        problems.push({ path: `${path}.url`, code: 'not_https' })
      return
    case 'divider':
      return
    default:
      problems.push({ path, code: 'invalid' })
  }
}

export const validateContent = (content: Content): ContentProblem[] => {
  const problems: ContentProblem[] = []
  text(problems, 'title', content.title, CONTENT_LIMITS.titleMax)
  if (content.autoOpen !== 'never' && content.autoOpen !== 'first_visit')
    problems.push({ path: 'autoOpen', code: 'invalid' })

  if (content.type === 'blocks') {
    const blocks = content.body?.blocks
    if (content.body?.schemaVersion !== 1 || !Array.isArray(blocks)) {
      problems.push({ path: 'body', code: 'invalid' })
      return problems
    }
    if (blocks.length > CONTENT_LIMITS.maxBlocks)
      problems.push({ path: 'blocks', code: 'too_many' })
    if (blocksBodyBytes(blocks) > CONTENT_LIMITS.maxBodyBytes)
      problems.push({ path: 'body', code: 'too_large' })
    blocks.forEach((block, index) => validateBlock(block, `blocks.${index}`, problems))
  } else if (content.type === 'widget') {
    text(problems, 'altText', content.altText, CONTENT_LIMITS.widgetAltMax)
    if (typeof content.html !== 'string' || content.html.trim() === '')
      problems.push({ path: 'html', code: 'required' })
    else if (byteLength(content.html) > CONTENT_LIMITS.widgetHtmlMaxBytes)
      problems.push({ path: 'html', code: 'too_large' })
  } else {
    problems.push({ path: 'type', code: 'invalid' })
  }
  return problems
}

// What a content costs against the map's 1 MB allowance.
export const contentBytes = (content: Content): number => byteLength(JSON.stringify(content))
