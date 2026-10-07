# Rumbos frontend

React + TypeScript + Vite + Tailwind + Konva. Renders a course map from the
Rumbos backend: teachers place Moodle activities as bubbles on a background
image, and students open them. The UI is entirely in Spanish (`<html lang="es">`);
see `src/i18n/es.ts` for the string dictionary.

## Running against the backend

1. Start the backend (FastAPI, normally on http://localhost:8000).
2. Copy the env template and adjust if needed:

   ```sh
   cp .env.example .env
   ```

3. Install and start the dev server:

   ```sh
   pnpm install
   pnpm dev
   ```

4. Open `http://localhost:5173/`. With no query string the app shows "Mis
   mapas", a searchable grid of existing course maps with create/rename/delete.

In development the Vite dev server proxies `/api/*` to the backend
(`VITE_API_PROXY_TARGET`, with the `/api` prefix stripped), so no CORS setup is
needed.

## Routes

Navigation is a tiny `history.pushState`/`popstate` wrapper (`src/hooks/useRoute.ts`),
no router dependency:

- *(no query string)* — "Mis mapas" home.
- `?map=<course-map-uuid>` — opens that map directly.
- `?course=<moodleCourseId>` — looks up the map for that Moodle course (the
  future entry point when launched from Moodle); if none exists yet, opens
  the home screen with the create dialog pre-filled for that course id.

## Running without a backend

Set `VITE_USE_MOCK_API=true`. The app then uses an in-memory mock that follows
the backend's rules (multiple maps, list/search/pagination, patch, delete,
`/resolved`). Its state resets on every page reload, seeded with a few sample
maps.

### Forcing a Moodle-connectivity state in the mock

Append `?mockMoodle=<state>` to force every bubble's resolved availability,
for demoing the precise-availability-states UI without a real Moodle:

| Value | Effect |
| --- | --- |
| `down` | `moodleStatus: "unavailable"`; every bubble becomes `unknown`. |
| `hidden` | Every bubble resolves to `hidden`. |
| `missing` | Every bubble resolves to `missing`. |
| `cached` | `moodleStatus: "cached"`; availability resolves normally. |

Example: `http://localhost:5173/?map=<uuid>&mockMoodle=hidden`.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `/api` | Base URL the browser calls for the API. |
| `VITE_API_PROXY_TARGET` | `http://localhost:8000` | Dev-only target of the `/api` proxy. |
| `VITE_ACTIVITY_OPEN_MODE` | `tab` | `tab` opens a Moodle activity in a new window. `modal` shows it in an iframe with a new-tab link. |
| `VITE_USE_MOCK_API` | `false` | `true` swaps the backend for the in-memory mock. |

## Theming

Design tokens (colors, radii, fonts, shadows) live as CSS variables in
`src/index.css`, generated through Tailwind v4's `@theme`. A second theme,
`[data-theme="cliente"]`, overrides every color token with a client's own
brand palette to prove white-labelling — set `data-theme="cliente"` on the
`<html>` element to preview it.

## Production

The dev proxy does not exist in production. Serve the built app and the API
from the same origin through a reverse proxy, or enable CORS for the frontend
origin on the backend. The backend is not changed by this repository.

The map view (Konva + its React bindings) is code-split via `React.lazy` and
only downloaded once a map is actually opened, keeping the "Mis mapas" home
bundle lighter.

## Scripts

- `pnpm dev`: development server.
- `pnpm build`: type-check and production build.
- `pnpm lint`: ESLint.

## Structure

- `src/features/course-map/data/`: API types, the fetch client (`ApiError`),
  the real and mock API implementations, and the TanStack Query hooks.
  Components use only the hooks, never fetch.
- `src/features/course-map/components/`: the home screen (`MapsHome`), map
  canvas, bubbles, sidebar, popovers, modals and the student HUD.
- `src/features/course-map/activityOpener.ts`: how a student opens an activity,
  and the URL check that guards it.
- `src/features/course-map/data/recentMaps.ts`: a per-browser localStorage
  convenience behind the home screen's "Continuar donde lo dejaste" card —
  not the primary way to find a map now that `GET /course-maps` exists.
- `src/components/ui/`: the shared design-system primitives (Button, Dialog,
  ConfirmDialog, Popover, Tooltip, DropdownMenu, Toast, Card, Badge, ...).
- `src/i18n/es.ts`: the single Spanish string dictionary; components import
  from it instead of hard-coding text.
- `src/hooks/useRoute.ts`: the pushState/popstate routing hook.
- `src/assets/backgrounds/`: the bundled background registry for the
  map-create dialog (image upload is out of scope).
