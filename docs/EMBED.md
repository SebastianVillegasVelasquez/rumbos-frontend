# Embed mode (Moodle course format)

Rumbos can run as a **guest inside a Moodle page**. A thin plugin
(`format_rumbos`) embeds the app in an iframe and talks to it with
`postMessage`. Identity comes from a launch assertion the plugin signs, and the
Moodle data (which activities exist, which the current user may see, which are
restricted or completed) comes from the plugin, computed by Moodle for that
user. Standalone mode is unchanged.

```
Moodle page (plugin)                          iframe: {APP_URL}/embed?host={hostOrigin}
 ├─ signs an assertion (RS256, <= 60 s)  ─►   exchanges it:  POST /auth/launch -> bearer token (memory only)
 └─ computes CourseState for this user   ─►   draws the map from it; the backend still stores maps/bubbles
```

## Contract v5 (binding)

### Backend

```
POST /auth/launch { assertion } -> 200 { accessToken, tokenType: "Bearer", expiresIn,
                                         role: "editor"|"student", courseId, hostOrigin }
                                   401 launch_invalid | 403 tenant_disabled
GET  /auth/me                   -> 200 { role, courseId }
```

Every other call carries `Authorization: Bearer <accessToken>`. Students may only
call `GET /published/**` of their own course; editors may also use the draft
endpoints; another course's resources answer 404. In plugin mode
`/course-maps/{id}/activities`, `/course-maps/{id}/resolved` and
`/published/course-maps/{id}/resolved` answer `501 moodle_source_not_provided`:
the host provides that data instead (the app never calls them in embed mode).

### Messages

Always `v: 1`. The iframe URL is `{APP_URL}/embed?host={hostOrigin}`. **No secrets
in URLs.** Both sides verify `event.origin` **and** `event.source`, and always pass
an explicit `targetOrigin` (never `"*"`).

| Direction  | Message                                                                  | Meaning                                                   |
| ---------- | ------------------------------------------------------------------------ | --------------------------------------------------------- |
| app → host | `{ type: "rumbos:embed-ready" }`                                         | The iframe loaded; send me the init.                      |
| host → app | `{ type: "rumbos:host-init", mode, locale, courseId, assertion, state }` | Start the session.                                        |
| app → host | `{ type: "rumbos:request-state" }`                                       | Please send a fresh `CourseState`.                        |
| host → app | `{ type: "rumbos:host-state", state }`                                   | The current user's `CourseState`.                         |
| app → host | `{ type: "rumbos:request-launch" }`                                      | The token expired; send a new assertion.                  |
| host → app | `{ type: "rumbos:host-launch", assertion }`                              | A fresh assertion (only accepted after a request-launch). |
| app → host | `{ type: "rumbos:open-activity", cmid }`                                 | Open this activity. The host looks the URL up itself.     |
| app → host | `{ type: "rumbos:request-fullscreen", on }`                              | Expand / restore the iframe.                              |
| app → host | `{ type: "rumbos:error", code }`                                         | The app gave up; fall back to the standard course page.   |

`rumbos:error` codes: `not_embedded`, `invalid_host`, `handshake_timeout`,
`launch_invalid`, `tenant_disabled`, `origin_mismatch`, `course_mismatch`,
`backend_unreachable`, `session_expired`. The plugin should treat any of them as
"show the normal Moodle course content".

```ts
CourseState = { schemaVersion: 1, courseId, generatedAt,
  sections:   [{ id, number, name }],
  activities: [{ cmid, name, modname, sectionId, url | null,
                 availability: "available" | "restricted" | "hidden",
                 availabilityInfo: string | null,   // plain text
                 completion: "none" | "incomplete" | "complete" | "failed" }],
  unavailableCmids: [int] }   // exist, but this user cannot see them at all
```

The state is always the current user's. `"hidden"` appears only for users who can
see hidden activities (editors). The app **drops `url`** while parsing: it never
opens or passes URLs.

### Handshake

1. The iframe loads `/embed?host=…` and sends `embed-ready` to the `host` origin.
2. The host answers `host-init`. The app validates it (shape, sizes, `state.courseId`
   equals `courseId`) and `POST`s the assertion to `/auth/launch`.
3. The returned `hostOrigin` must equal the `host` parameter, and `courseId` must
   equal the one in `host-init`; otherwise the app aborts (`origin_mismatch` /
   `course_mismatch`) and tells the host.
4. The access token is kept **in memory only** (a closure in
   `features/embed/session.ts`): never `localStorage`, `sessionStorage`, URLs,
   logs or error reports. The **role comes from the token**, not from `mode`.
5. No `host-init` within 15 s → `handshake_timeout`.

### Token expiry

On a `401` the data layer pauses (the write queue is sequential, so a write waiting
for its retry holds back the ones behind it), sends `request-launch`, exchanges the
new assertion, **retries the call once** and resumes. Concurrent 401s share one
round trip. If the host does not answer within 10 s, or the new identity differs,
the app shows "Tu sesión expiró. Recarga la página." and sends
`error { code: "session_expired" }`. A replayed assertion is rejected by the backend
(`launch_invalid`), so a host must sign a fresh one per request.

### Strict message handling

Incoming messages are parsed by hand-written guards (`features/embed/protocol.ts`).
Anything unknown, versionless, malformed, oversize (lists are capped, strings are
truncated and stripped of control characters) or from the wrong origin/window is
ignored (a dev-only `console.debug`, never the payload). A malformed `CourseState`
is rejected as a whole. All host text is rendered as plain text, never HTML.

## Status derivation (shared rule)

Per bubble, from the host state (`cmid` = the bubble's `activityId`). This
**replaces the stored demo `status`** in embed mode.

| Host state for the bubble's cmid       | Result                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------- |
| in `unavailableCmids`                  | `teaser` ("Próximamente"); no activity data                             |
| in neither list                        | `missing` (editors: warning "Quitar del mapa")                          |
| `availability: "hidden"`               | editor badge "Oculta para estudiantes" (students never get this)        |
| `availability: "restricted"`           | locked visual; tooltip = `availabilityInfo` (text)                      |
| `completion: "complete"`               | `complete`                                                              |
| `completion: "incomplete"` or `"none"` | `no_complete` (explorative: available; guided: next / locked as before) |
| `completion: "failed"`                 | `in_progress`                                                           |

The first load never triggers transition effects; a completion that changes on a
later refresh does (unlock pop, completion burst). Known limit: in guided mode an
incomplete activity the student cannot see (teaser) still counts as the next
incomplete one.

## What the host must do

- Answer `embed-ready` with `host-init`; answer `request-state` with `host-state`;
  answer `request-launch` with a freshly signed `host-launch`.
- On `open-activity`, find the cmid in **its own** state and open that URL (the app
  sends nothing else). Ignore unknown cmids.
- On `request-fullscreen`, expand or restore the iframe (the layout is `dvh`-based and
  adapts). Mobile uses `80dvh` when not fullscreen.
- On `error`, fall back to the standard course content.
- Verify `event.origin` (the app origin) and `event.source` (the iframe's window).

The app asks for fresh state when the tab regains focus or visibility, every 60 s
while visible (paused when hidden), and after the person returns from an activity;
requests are throttled to one per 3 s.

## CSP and `frame-ancestors`

The app is embeddable **only by registered Moodle sites**. The nginx config
(`nginx/nginx.conf`) sends, for `/embed`:

```
Content-Security-Policy: frame-ancestors ${EMBED_FRAME_ANCESTORS}
```

and the same list (plus `'self'`) for `/3d/`. The 3D world is a second iframe
**inside** the embedded app, and browsers check _every_ ancestor, so a plain
`X-Frame-Options: SAMEORIGIN` would block it under a cross-origin Moodle page;
`/3d/` therefore uses `frame-ancestors` too. Everything else stays
`X-Frame-Options: DENY`.

`EMBED_FRAME_ANCESTORS` is a container environment variable (space-separated
origins, default `'self'`, i.e. nobody else), substituted when the container starts:

```
EMBED_FRAME_ANCESTORS="'self' https://moodle.example.edu https://campus.example.org"
```

Also required: the backend's CORS must allow the app origin with the
`Authorization` header, and the plugin's page must not set a `Permissions-Policy`
that blocks `fullscreen` for the iframe (`allow="fullscreen"`).

## Mock host (development)

`mock-host/` is a dev page that plays the plugin. Not part of the production build.

```
VITE_USE_MOCK_API=true pnpm dev
# open http://127.0.0.1:5173/mock-host/   (the app is framed from http://localhost:5173/embed)
```

Using `127.0.0.1` for the host and `localhost` for the app makes them genuinely
different origins, so the origin checks are exercised. It provides: student/editor
roles, a per-activity table (availability: available / restricted / hidden /
unavailable / missing, restriction text, completion) that pushes a new state on
every change, token TTL, "Expire token", "Host disappears", a wrong `?host=`, a
tenant the backend rejects or that reports another host, malformed and unsolicited
messages, desktop / tablet / phone frames and a message log. The mock API enforces
the access matrix (student → draft endpoints 403, other course 404, host-provided
endpoints 501, replayed assertions 401).

## Mobile behavior

- The shell is `100dvh` high inside whatever box the host gives it.
- **No scroll trap:** on touch screens, one finger scrolls the host page over the
  map; two fingers pinch-zoom it. A visible **"Mover el mapa"** button hands the
  canvas the touch (`touch-action: none`, only inside its own viewport) and turns
  into **"Seguir con la página"**, which gives the page back. The header and HUD sit
  outside the canvas and always scroll the page.
- **"Pantalla completa"** in the header sends `request-fullscreen { on }`; the label
  becomes "Salir de pantalla completa".
- The 3D view is a nested iframe with its own touch handling (unchanged).

## Testing by hand (needs real devices)

Automated and mock-host checks cover the protocol, derivation and access matrix.
These need a human on real hardware, inside a real Moodle page:

- Real phones (iOS Safari, Android Chrome): one-finger scroll over the map with
  the touch guard on, "Mover el mapa" / "Seguir con la página", pinch-zoom,
  tapping bubbles, the on-screen keyboard (editor dialogs), rotating the phone.
- The iframe inside the real plugin page at `80dvh`: no horizontal page scroll,
  header wraps cleanly from 360 px to tablet width.
- "Pantalla completa" on iOS Safari (the host must expand the iframe itself) and
  coming back; the 3D view's own touch behavior inside the iframe.
- The real `frame-ancestors` header from the deployed container, including `/3d/`
  under a cross-origin Moodle page, and the real CORS / `Authorization` header.
- The real assertion (RS256), `hostOrigin` registration and token expiry against the
  real backend; completion changes made in Moodle showing up on return.
