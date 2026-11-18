// GET /trainer/catalog as production answered an editor in preview: enabled, nested
// lessons, every activity a draft, no `enabled`/`available` on the items. Rebuilt from the
// bug report (the exact JSON was sent apart): replace it with that body when it lands.
export const previewCatalog = {
  enabled: true,
  preview: true,
  language: 'en',
  level: 'A1',
  title: 'Inglés A1 · Turismo',
  content_version: 'cd21235a2e5ee4e4',
  modules: [
    {
      key: 'M1',
      title: 'Asking for and giving personal information',
      lessons: [
        {
          id: '1.1',
          code: '1.1',
          title: 'Greetings',
          activities: [
            {
              id: 'en-a1-1.1-dialogue',
              skill: 'dialogue',
              title: 'Saying hello',
              publication_state: 'draft',
              state: 'not_started',
              best_percent: null,
            },
            {
              id: 'en-a1-1.1-grammar',
              skill: 'grammar',
              title: 'To be',
              publication_state: 'reviewed',
              state: 'not_started',
              best_percent: null,
            },
          ],
        },
      ],
    },
  ],
}
