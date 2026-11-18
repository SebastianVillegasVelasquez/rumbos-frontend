import real from './previewCatalog.json' with { type: 'json' }

// GET /trainer/catalog as production answered an editor in preview (the bug report's
// JSON, verbatim): every activity a draft, no `preview` flag, nested under the modules.
// A fresh copy each time, so a test can break it without touching the others.
export const catalogFixture = (): unknown => structuredClone(real)
