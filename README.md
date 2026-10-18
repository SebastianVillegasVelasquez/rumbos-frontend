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
(`VITE_API_PROXY_TARGET`, prefix kept, so the backend receives `/api/v1/...`), so no CORS setup is
needed.

## Routes

Navigation is a tiny `history.pushState`/`popstate` wrapper (`src/hooks/useRoute.ts`),
no router dependency:

- _(no query string)_ — "Mis mapas" home.
- `?map=<course-map-uuid>` — opens that level directly.
- `?view=published` (optional, combinable) — opens straight into the student
  experience (published data) instead of the editor.
- `?view=3d` — the student experience (published data) opened on the 3D view;
  it only has an effect on a level whose map has a 3D view (see below).
- `?course=<moodleCourseId>` — the course's levels: a single level opens
  directly, several show the level carousel (`&entry=1` forces the carousel
  even with a single level), and none shows an empty state (an editor gets a
  "crear el primer nivel" CTA; a student sees there's nothing yet). This is
  also the future entry point when launched from Moodle.

## Embed mode (Moodle course format)

`/embed?host=<hostOrigin>` is the app as a guest in a Moodle iframe: identity from a
launch assertion exchanged for an in-memory bearer token, Moodle data (availability,
restrictions, completion) from the plugin over `postMessage`, a fixed course, no
standalone navigation, and role-based UI (students only see the published map).
Standalone mode is unchanged and does not load any of it (the embed code is a lazy
chunk). The message protocol, the status-derivation table, the CSP /
`frame-ancestors` setup, the mock host and the mobile behavior are in
[`docs/EMBED.md`](docs/EMBED.md).

Try it without a backend or Moodle: `VITE_USE_MOCK_API=true pnpm dev`, then open
`http://127.0.0.1:5173/mock-host/`.

## 3D view

A level can have an optional **3D view**: a hand-authored three.js world,
"La Región de los Encuentros", where each activity is a pin on a fixed zone.
Students switch between **2D | 3D** (the control only appears when the map has
a `view3d`; the last choice is remembered in `localStorage`, default 2D). In 3D
the activity list stays on screen with every state and a way to fly the camera
to a pin or open it, so the canvas is never the only way in. Editors configure
it in **Apariencia → 3D** (enable, scene, which activity goes in which zone,
optional text overrides, preview of the draft) and it is published and restored
with the rest of the level (`view3dChanged` in the publish dialog).

**Phase 1 (this): an isolated page in an iframe.** The world is a second Vite
HTML entry served at `/3d/` (`3d/`, static images in `public/3d/`); the app
embeds it with `Map3DView` and talks to it through a small `postMessage`
protocol: see [`docs/3d/BRIDGE.md`](docs/3d/BRIDGE.md). What was found in the
delivered folder and what was changed is in
[`docs/3d/AUDIT.md`](docs/3d/AUDIT.md).

- **Develop the world alone:** `pnpm dev`, open `http://localhost:5173/3d/?demo=1`
  (add `&lang=en` for English). It shows the 9 built-in zones with demo states and
  needs no host or backend.
- **See it in the app without a backend:** `VITE_USE_MOCK_API=true pnpm dev`. The
  mock's "Fundamentos de programación — Nivel 2" has a configured 3D view; the
  other maps have none.
- **Scenes and the "9 fixed zones" limitation.** A scene is hand-authored with an
  exact number of zones (`region-encuentros`: 9, ids 0-8). It cannot adapt to an
  arbitrary course: with more activities than zones the extra ones do not appear in
  3D (the editor says so), with fewer the unused zones stay empty. The zone texts
  (ES/EN) live in `3d/scenes/region-encuentros.json`, the single source of truth
  read by the 3D page and by the editor; the frontend registry is
  `src/scenes3d/registry.ts` and the backend lists the scenes it accepts at
  `GET /view3d/scenes`. The editor only offers scenes present in both. The built-in
  English texts were written for this integration (the delivered world had none)
  and should be reviewed by someone who owns the content.
- **Contract:** API contract v4 (`view3d` on the draft and published reads,
  `PUT /course-maps/{id}/view3d`, `GET /view3d/scenes`); `src/features/course-map/data/types.ts`.
- **Textures and sprites** (`public/3d/`) are AI-generated or AI-derived with no
  recorded license: see section 6 of the audit before shipping.

### Serving it: CSP and caching

- The app frames only itself, so a Content-Security-Policy needs
  `frame-src 'self'` (and `default-src 'self'`; there are no third-party
  origins: no CDN, no web fonts, no analytics). The 3D page needs
  `script-src 'self'`, `style-src 'self' 'unsafe-inline'` (a few inline `style`
  attributes), `img-src 'self' data: blob:` (textures, postcards, procedural
  canvases), `font-src 'self'`, and `connect-src 'self'`. Send
  `frame-ancestors 'self'` with `/3d/`.
- `X-Frame-Options: DENY` (already set by `nginx/nginx.conf`) would stop the app
  from framing its own page, so `/3d/` is served with `SAMEORIGIN` while the rest
  of the site stays `DENY`.
- Recommended cache headers (already in `nginx/nginx.conf`, under `location ^~ /3d/`):

  ```nginx
  location ^~ /3d/ {
      add_header X-Frame-Options "SAMEORIGIN" always;
      add_header X-Content-Type-Options "nosniff" always;
      add_header Referrer-Policy "no-referrer" always;
      add_header Cache-Control "no-cache";          # /3d/ itself: always revalidate
      try_files $uri $uri/ =404;

      location ~* \.(?:webp|woff2)$ {               # stable names: 30 days, not immutable
          add_header X-Frame-Options "SAMEORIGIN" always;
          add_header X-Content-Type-Options "nosniff" always;
          add_header Referrer-Policy "no-referrer" always;
          add_header Cache-Control "public, max-age=2592000";
          access_log off;
      }
  }
  # The page's JS and CSS are hashed files under /assets/, served by the existing
  # `location ^~ /assets/` (immutable, one year).
  ```

  (`add_header` inside a location replaces the server-level ones, hence the
  repeated security headers.)

### Phase 2 notes (not started)

A native port (a TypeScript module drawing the world inside the app instead of an
iframe) would replace: the iframe and `useView3dBridge`/`protocol.ts` (the
message boundary), `3d/main.ts`, and the page's own HUD/panel/list/language UI
(re-done with the app's `Dialog` and tokens). What stays: the `Map3DView` props
(`scene`, `locale`, `points`, `onPinClick`, `onOpenActivity`, `focusPointId`,
`theme`), `buildPoints3d` and its tests, `Map3DPanel` and the accessible list,
the scene registry, the zone JSON, the editor tab, and the API contract. The
world code (`3d/world.js`, ~2,100 lines of untyped procedural three.js with a
`<three-d-stage>` shell) is the bulk of that work.

## Draft vs published

Editors work on a **draft**; students only ever see a **published** snapshot,
even while someone is editing.

- Everything the editor reads and writes (`/course-maps/...`) is the draft.
  Publishing (`POST /course-maps/{id}/publish`) stores an immutable snapshot;
  students read `/published/course-maps/...`. Bubble `status` and level
  `position` are always live and belong to neither the draft nor a snapshot.
- The map header shows a status chip (_Sin publicar_ / _Publicado · versión N_ /
  _Cambios sin publicar_), refreshed after every batch of successful writes,
  publish, discard and restore.
- **Publicar** reviews the changes (_Fondo cambiado_, _3 burbujas movidas_…) and
  sends the `draftHash` it showed, so a draft that changed during the review is
  rejected and re-reviewed instead of published unseen.
- **Descartar cambios** returns the draft to the published version;
  **Historial** lists the versions and **Restaurar en el borrador** loads one
  into the draft (it never publishes). Anything the server had to adjust (for
  example a deleted skin) is shown as a warning.
- View modes: **Edición** (draft, editable), **Vista previa (borrador)** (the
  draft as a student would see it) and **Publicado** (read-only, exactly what
  students see; disabled until the level has been published). `?view=published`
  opens the student experience directly. A link to a never-published level
  shows "Este nivel aún no está disponible."
- Rendering goes through one `RenderableMap` (`renderable.ts`) with two adapters
  (draft → renderable, published → renderable; published skins come from the
  snapshot's frozen copies). Draft and published data use separate TanStack
  Query roots (`course-maps/...` vs `published/...`): draft edits never
  invalidate published queries, and publishing refreshes only the published ones.

## Concurrent editing: the write queue

There is no authentication yet, so the UI never says _who_ edited, only that
_someone else_ did.

- Draft-content writes are guarded with `If-Match` (map `revision`, bubble
  `version`). Every guarded write of a map goes through **one FIFO queue**
  (`data/writeQueue.ts`, registry in `writeQueues.ts`). Jobs run one at a time and
  read the version they need when they _run_, after the previous response has
  already updated the query cache, so two quick edits never conflict with each
  other. Rapid drags of one bubble collapse into the latest position while
  queued.
- Status-only bubble PATCHes (the progress simulator) are live data: no
  `If-Match`, no queue.
- A draft fetch is only trusted if no guarded write overlapped it
  (`fetchDraftConsistently`), otherwise a refetch could return an older version
  than the cache.
- **412 on a bubble**: the queue halts, the draft is reloaded, the other
  person's version of the bubble wins and the local change is dropped, with a
  toast. **412 on the map** (title, appearance, background): a dialog offers
  _Recargar_ (discard mine) or _Aplicar los míos de todas formas_ (re-send with
  the fresh revision). **428** is a client bug: logged in the console, generic
  error in the UI.
- `WriteSyncHost` (mounted once at the root) owns all of this UI.

## Backgrounds and the asset library

The background picker (`components/background/`) is the only way to choose a
background, both when replacing a level's and when creating a level:
**Biblioteca** (search, paging, credit, usage badges, edit title/credit, delete
unused), **Subir nueva** (drag and drop, client-side checks, title and
_Autor, fuente o licencia_) and **Predefinidos** (bundled art). Choosing an
image shows it under the level's current bubbles with the old and new aspect
ratios; _Aplicar_ is a guarded change with a 10-second _Deshacer_. The previous
image is never deleted, and deleting an image that is in use is refused with
exactly where it is used. Bubble art for image skins reuses the same library
and uploader.

`VITE_SHOW_BUNDLED_BACKGROUNDS` controls the **Predefinidos** tab. It defaults to
`true` in development and `false` in production builds, because the bundled art
has no verified license.

## Tests

`pnpm test` runs `node --test` over `src/**/*.test.ts` (Node 24 strips types, no
new dependency). It covers the pure logic only: the write queue (ordering,
collapsing, conflicts), canonical JSON hashing, upload limits and the change
sentences. Component behaviour is checked by hand.

## Running without a backend

Set `VITE_USE_MOCK_API=true`. The app then uses an in-memory mock that
follows the backend's contract v3: draft vs published with snapshots, `If-Match` revisions/versions (428/412), the asset library (metadata, usage, delete with 409) and the `/published` read API, plus several levels per Moodle course (unique
per Moodle section, not per course), map settings/appearance, skins (four
built-in procedural skins plus whatever you create in the studio), an asset
store for uploaded images, and the full `/resolved` availability contract.
Its state resets on every full page reload, reseeded with a Fundamentos de
programación course that has three levels (level 1 published and up to date,
level 2 with unpublished changes on top of three publications, level 3 never
published), a few single-level courses and three generated library backgrounds
of different aspect ratios.

In development, `window.__rumbosMock` lets one tab act as "another editor" to
exercise the conflict flows: `editBubbleElsewhere(mapId, bubbleId)` and
`editMapElsewhere(mapId)` bump a version/revision behind the app's back, and
`maps()` / `bubbles(mapId)` list ids. `?mockLatency=300` adds artificial latency
to every call, which makes the write queue observable.

### Forcing a Moodle-connectivity state in the mock

Append `?mockMoodle=<state>` to force every bubble's resolved availability,
for demoing the precise-availability-states UI without a real Moodle:

| Value     | Effect                                                         |
| --------- | -------------------------------------------------------------- |
| `down`    | `moodleStatus: "unavailable"`; every bubble becomes `unknown`. |
| `hidden`  | Every bubble resolves to `hidden`.                             |
| `missing` | Every bubble resolves to `missing`.                            |
| `cached`  | `moodleStatus: "cached"`; availability resolves normally.      |

Example: `http://localhost:5173/?map=<uuid>&mockMoodle=hidden`.

### Forcing an asset-upload failure in the mock

Append `?mockAssets=<state>` to the appearance studio's URL to demo the
image-skin/background upload error states:

| Value   | Effect                                                |
| ------- | ----------------------------------------------------- |
| `quota` | Every upload fails with `asset_quota_exceeded` (507). |
| `down`  | Every upload fails with `uploads_disabled` (503).     |

### Debug flags

| Flag         | Effect                                                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------------------------- |
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

| Variable                        | Default                                     | Purpose                                                                                           |
| ------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL`             | `/api/v1`                                   | Base URL the browser calls for the API.                                                           |
| `VITE_API_PROXY_TARGET`         | `http://localhost:8000`                     | Dev-only target of the `/api` proxy.                                                              |
| `VITE_ACTIVITY_OPEN_MODE`       | `tab`                                       | `tab` opens a Moodle activity in a new window. `modal` shows it in an iframe with a new-tab link. |
| `VITE_USE_MOCK_API`             | `false`                                     | `true` swaps the backend for the in-memory mock.                                                  |
| `VITE_SHOW_BUNDLED_BACKGROUNDS` | `true` in dev, `false` in production builds | Shows the bundled demo backgrounds in the picker's _Predefinidos_ tab.                            |

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
component) is ~417 KB (~128 KB gzipped) and never touches Konva. Run
`pnpm build` to regenerate these numbers for any future change.

## Scripts

- `pnpm dev`: development server.
- `pnpm build`: type-check and production build.
- `pnpm lint`: ESLint.
- `pnpm test`: unit tests for the pure logic (Node's built-in runner).

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
- `src/features/view3d/`: the host side of the 3D view (`Map3DView` iframe seam,
  `useView3dBridge`, shared `protocol.ts`, `buildPoints3d`, the 2D|3D control,
  the activity list) and `editor/` (the Apariencia → 3D tab and its pure form
  model). `src/scenes3d/registry.ts` lists the scenes the frontend can draw.
- `3d/`: the 3D page (a separate Vite entry served at `/3d/`): `main.ts` (bridge,
  demo mode, WebGL fallback), `world.js` (the world), `three-d-stage.js` (the
  WebGL shell), `scenes/*.json`. Static images and fonts: `public/3d/`.
- `src/assets/backgrounds/`: the bundled background registry for the
  map-create dialog (alongside uploading your own background in the
  appearance studio).
