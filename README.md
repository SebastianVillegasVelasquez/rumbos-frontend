# Rumbos frontend

React + TypeScript + Vite + Tailwind + Konva. Renders a course map from the
Rumbos backend: teachers place Moodle activities as bubbles on a background
image, and students open them.

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

4. Open `http://localhost:5173/?map=<course-map-uuid>`. With no `map` parameter
   the app shows a form to create a map for a Moodle course id.

In development the Vite dev server proxies `/api/*` to the backend
(`VITE_API_PROXY_TARGET`, with the `/api` prefix stripped), so no CORS setup is
needed.

## Running without a backend

Set `VITE_USE_MOCK_API=true`. The app then uses an in-memory mock that follows
the backend's rules. Its state resets on every page reload.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `/api` | Base URL the browser calls for the API. |
| `VITE_API_PROXY_TARGET` | `http://localhost:8000` | Dev-only target of the `/api` proxy. |
| `VITE_ACTIVITY_OPEN_MODE` | `tab` | `tab` opens a Moodle activity in a new window. `modal` shows it in an iframe with a new-tab link. |
| `VITE_USE_MOCK_API` | `false` | `true` swaps the backend for the in-memory mock. |

## Production

The dev proxy does not exist in production. Serve the built app and the API
from the same origin through a reverse proxy, or enable CORS for the frontend
origin on the backend. The backend is not changed by this repository.

## Scripts

- `pnpm dev`: development server.
- `pnpm build`: type-check and production build.
- `pnpm lint`: ESLint.

## Structure

- `src/features/course-map/data/`: API types, the fetch client (`ApiError`),
  the real and mock API implementations, and the TanStack Query hooks.
  Components use only the hooks, never fetch.
- `src/features/course-map/components/`: map canvas, bubbles, sidebar, popovers
  and modals.
- `src/features/course-map/activityOpener.ts`: how a student opens an activity,
  and the URL check that guards it.
