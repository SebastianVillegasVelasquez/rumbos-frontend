# Rumbos frontend

React + TypeScript + Vite + Tailwind + Konva. Renders a course as one or more
level maps: teachers place Moodle activities as bubbles on a background
image, style them with skins, and students open them. The UI is entirely in
Spanish (`<html lang="es">`); see `src/i18n/es.ts` for the string dictionary.

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
   mapas": a searchable grid of courses (multi-level courses show one card
   leading into their level carousel) with create/rename/delete.

In development the Vite dev server proxies `/api/*` to the backend
(`VITE_API_PROXY_TARGET`, with the `/api` prefix stripped), so no CORS setup is
needed.

## Routes

Navigation is a tiny `history.pushState`/`popstate` wrapper (`src/hooks/useRoute.ts`),
no router dependency:

- *(no query string)* — "Mis mapas" home.
- `?map=<course-map-uuid>` — opens that level directly.
- `?course=<moodleCourseId>` — the course's levels: a single level opens
  directly, several show the level carousel (`&entry=1` forces the carousel
  even with a single level), and none shows an empty state (an editor gets a
  "crear el primer nivel" CTA; a student sees there's nothing yet). This is
  also the future entry point when launched from Moodle.

## Running without a backend

Set `VITE_USE_MOCK_API=true`. The app then uses an in-memory mock that
follows the backend's contract v2: several levels per Moodle course (unique
per Moodle section, not per course), map settings/appearance, skins (four
built-in procedural skins plus whatever you create in the studio), an asset
store for uploaded images, and the full `/resolved` availability contract.
Its state resets on every full page reload, reseeded with a Fundamentos de
programación course that has three levels (different bubble counts, modes
and completion states) plus a few single-level courses.

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

### Forcing an asset-upload failure in the mock

Append `?mockAssets=<state>` to the appearance studio's URL to demo the
image-skin/background upload error states:

| Value | Effect |
| --- | --- |
| `quota` | Every upload fails with `asset_quota_exceeded` (507). |
| `down` | Every upload fails with `uploads_disabled` (503). |

### Debug flags

| Flag | Effect |
| --- | --- |
| `?debug=fps` | Shows a dev-only rolling FPS counter (top-left), independent of the shared ticker so it measures real frame time. |

## Procedural animation and quality tiers

Bubble idle/hover/pulse animation, the connector path's flow and traveler
dot, the ambient weather layer, and the level-complete celebration all live
under `src/fx/` and share one `Konva.Animation` ticker
(`src/features/course-map/viewport/ticker.ts`) with the pan/zoom camera —
never a second RAF loop. Quality is `auto | high | medium | low | off`:
"auto" samples real frame time for a few seconds and degrades one tier if
it's too slow (never upgrades mid-session, and never re-samples), and
`prefers-reduced-motion` always forces `off`. The chosen setting persists
per-viewer in `localStorage` (`rumbos:animation-quality`) and is controlled
from the appearance studio's "Animación" tab.

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

The map view (`MapCanvas`) and the appearance studio (`AppearanceStudio`,
whose skin previews pull in the same Konva machinery) are both code-split via
`React.lazy`, so Konva is only downloaded once either is actually opened,
keeping the "Mis mapas" home bundle lighter. `MapCanvas` and
`AppearanceStudio` share a single Konva-dependent chunk (`BubbleVisual` and
everything it imports), so opening one doesn't pay for Konva twice if you
later open the other. As of this sprint: the shared Konva chunk is ~338 KB
(~104 KB gzipped); the rest of the app (home, data layer, every non-Konva UI
component) is ~435 KB (~136 KB gzipped) and never touches Konva. Run
`pnpm build` to regenerate these numbers for any future change.

## Scripts

- `pnpm dev`: development server.
- `pnpm build`: type-check and production build.
- `pnpm lint`: ESLint.

## Structure

- `src/features/course-map/data/`: API types, the fetch client (`ApiError`),
  the real and mock API implementations, the asset URL resolver
  (`assets.ts`), and the TanStack Query hooks. Components use only the
  hooks, never fetch.
- `src/features/course-map/viewport/`: the single viewport controller
  (`useViewportController`) that owns pan/zoom/fly-to for the canvas, its
  pure math (`math.ts`), and the shared animation ticker (`ticker.ts`).
- `src/fx/`: the procedural animation engine - quality tiers
  (`quality.ts`), tunable constants (`constants.ts`), pure math
  (`math/`: easing, seeded RNG, polyline point sampling, a particle-pool
  stepper), the ambient weather layer (`AmbientLayer.tsx`), path-effect
  helpers (`path.ts`), and the dev FPS meter (`FpsMeter.tsx`).
- `src/features/course-map/visualState.ts`: `deriveVisualState`, the single
  pure function from a bubble's status/sequence/map-mode/resolved
  availability/viewer role to its on-screen state
  (locked/available/next/inProgress/complete/teaser/missing/unknown).
- `src/features/course-map/resolveSkin.ts`: the pure bubble→skin lookup
  (override → per-type rule → map default → built-in default → hard-coded
  fallback).
- `src/features/course-map/components/`: the home screen (`MapsHome`), the
  level carousel and course-entry screen (`LevelCarousel`, `CourseLevels`),
  map canvas, bubble rendering (`BubbleVisual`, shared by the canvas and
  every skin preview), sidebar, popovers, modals, the appearance studio
  (`AppearanceStudio`, `SkinStudio`, `SkinPreview`) and the student HUD.
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
  map-create dialog (alongside uploading your own background in the
  appearance studio).
