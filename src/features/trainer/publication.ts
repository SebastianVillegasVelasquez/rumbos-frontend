// What an editor in preview is told about an item's publication_state. ASSUMPTION:
// the known values are published, draft, unpublished and archived; any other value is
// shown as it came, never hidden. Only `published` is visible to students.

export interface PublicationCopy {
  published: string
  draft: string
  unpublished: string
  archived: string
  other: (state: string) => string
}

export const studentsCanSee = (state: string | undefined): boolean | null =>
  state === undefined ? null : state === 'published'

export const publicationLabel = (
  state: string | undefined,
  copy: PublicationCopy
): string | null => {
  if (state === undefined) return null
  switch (state) {
    case 'published':
      return copy.published
    case 'draft':
      return copy.draft
    case 'unpublished':
      return copy.unpublished
    case 'archived':
      return copy.archived
    default:
      return copy.other(state)
  }
}
