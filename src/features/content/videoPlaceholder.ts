import { es } from '../../i18n/es.ts'
import { videoHostNote } from '../welcome/videoControls.ts'
import type { Block } from './contentTypes.ts'

// What a video block shows before the viewer asks for the video: the title, one
// button, and a plain-text note about who hosts it. Nothing from the provider
// loads until the button is pressed.
export const videoPlaceholder = (block: Extract<Block, { type: 'video' }>) => ({
  title: block.title,
  buttonLabel: es.content.viewer.playVideo,
  note: videoHostNote(block.provider),
})
