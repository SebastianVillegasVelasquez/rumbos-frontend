import type { MapFit } from '../course-map/data/types.ts'

// A large explorable canvas has no ratio of its own worth asking the host for.
const ORIGINAL_FIT_ASPECT = 16 / 9

// The width / height the host may give the app for a level (contract v5.5), or
// null while the background's size is still unknown.
export const preferredAspectRatio = (
  fit: MapFit,
  image: { width: number; height: number } | null
): number | null => {
  if (fit === 'original') return ORIGINAL_FIT_ASPECT
  if (!image || image.width <= 0 || image.height <= 0) return null
  return image.width / image.height
}
