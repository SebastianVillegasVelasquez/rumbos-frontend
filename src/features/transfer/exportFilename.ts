import { normalizeName } from './matching.ts'

const MAX_SLUG_LENGTH = 40

// "Introducción a la Ecología" -> "introduccion-a-la-ecologia"
export const slugify = (text: string): string => {
  const slug = normalizeName(text).replace(/ /g, '-').slice(0, MAX_SLUG_LENGTH).replace(/-+$/, '')
  return slug || 'curso'
}

const two = (n: number) => String(n).padStart(2, '0')

// rumbos-<course-slug>-<yyyy-mm-dd>.rumbos, with the date of the person's day.
export const exportFilename = (courseName: string | null | undefined, date: Date): string =>
  `rumbos-${slugify(courseName ?? '')}-${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}.rumbos`
