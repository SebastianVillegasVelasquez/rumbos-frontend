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
the host provides that data instead. The app never calls them in embed mode: all
Moodle data goes through the `MoodleStateProvider` (the host-based one here), and
the data layer rejects those three calls locally, without a request. Reaching one
is a programming error: it is logged in development, shows "Esta función no está
disponible en este modo." and is never reported to the host.

### Messages

Always `v: 1`. The iframe URL is `{APP_URL}/embed?host={hostOrigin}`. **No secrets
in URLs.** Both sides verify `event.origin` **and** `event.source`, and always pass
an explicit `targetOrigin` (never `"*"`).

| Direction  | Message                                                                  | Meaning                                                        |
| ---------- | ------------------------------------------------------------------------ | -------------------------------------------------------------- |
| app → host | `{ type: "rumbos:embed-ready" }`                                         | The iframe loaded; send me the init.                           |
| host → app | `{ type: "rumbos:host-init", mode, locale, courseId, assertion, state }` | Start the session.                                             |
| app → host | `{ type: "rumbos:request-state" }`                                       | Please send a fresh `CourseState`.                             |
| host → app | `{ type: "rumbos:host-state", state }`                                   | The current user's `CourseState`.                              |
| app → host | `{ type: "rumbos:request-launch" }`                                      | The token expired; send a new assertion.                       |
| host → app | `{ type: "rumbos:host-launch", assertion }`                              | A fresh assertion (only accepted after a request-launch).      |
| app → host | `{ type: "rumbos:open-activity", cmid }`                                 | Open this activity. The host looks the URL up itself.          |
| app → host | `{ type: "rumbos:request-fullscreen", on }`                              | Expand / restore the iframe.                                   |
| app → host | `{ type: "rumbos:error", code }`                                         | The app gave up; fall back to the standard course page.        |
| host → app | `{ type: "rumbos:host-overlay", open }` (v5.3)                           | An activity popup opened/closed above the app (see below).     |
| app → host | `{ type: "rumbos:open-activity-settings", cmid }` (v5.4)                 | Editor only: open the activity's settings page in a new tab.   |
| host → app | `{ type: "rumbos:host-fullscreen", on }`                                 | The iframe is (or stopped being) expanded. The app follows it. |
| app → host | `{ type: "rumbos:no-content", reason }` (v5.5)                           | A student has nothing to see; show the standard course page.   |
| app → host | `{ type: "rumbos:preferred-size", aspectRatio }` (v5.5)                  | The width / height the area would like (0.5 to 4).             |

`rumbos:error` codes: `not_embedded`, `invalid_host`, `handshake_timeout`,
`launch_invalid`, `tenant_disabled`, `origin_mismatch`, `course_mismatch`,
`backend_unreachable`, `session_expired`. The plugin should treat any of them as
"show the normal Moodle course content".

Only **handshake, launch (token exchange), token refresh, protocol and crash**
failures send `rumbos:error`; a failure of any other feature (a panel, a list, a
save) is handled inside the app with a friendly message and the map keeps working:

| Failure                                                           | Reports to the host? |
| ----------------------------------------------------------------- | -------------------- |
| Handshake (no/invalid `host-init`, timeout, bad origin or course) | yes                  |
| Protocol mismatch                                                 | yes                  |
| Initial `POST /auth/launch` fails                                 | yes                  |
| Token expired and cannot be refreshed                             | yes                  |
| Crash caught by the error boundary (`app_crashed`)                | yes                  |
| Any 4xx/5xx or network error on a feature                         | no (local message)   |
| `501 moodle_source_not_provided` (a bug in embed mode)            | no (log in dev)      |

The wire codes (v5.1) are unchanged. The policy lives in `features/embed/escalation.ts`.

### Mode and overlays (v5.3)

`host-init.mode` is `"editor"` if and only if the user has the edit capability **and**
Moodle's editing mode is on; otherwise `"student"`, even for a user whose assertion
role is `editor`. The assertion role stays capability-based and is what the backend
authorizes; the **UI mode is the host's**. In `"student"` mode the app renders no
editor UI (appearance studio, saving, saved versions, progress simulator) and uses the
saved map. If nothing is saved and the role is `editor`, it says "Aún no hay un mapa
guardado. Activa la edición del curso para configurarlo."

`rumbos:host-overlay { open }`: sent when the host opens or closes an overlay (an activity
popup) above the app. While open, the app pauses its animation loops (ambient particles,
path travelers, camera smoothing) and starts no new transitions. After closing, the host
sends `host-state`; completion changes in it play as live effects, not as a first load.

```ts
CourseState = { schemaVersion: 1, courseId, generatedAt,
  sections:   [{ id, number, name }],
  activities: [{ cmid, name, modname, sectionId, url | null,
                 availability: "available" | "restricted" | "hidden",
                 availabilityInfo: string | null,   // plain text
                 completion: "none" | "incomplete" | "complete" | "failed" }],
  unavailableCmids: [int],    // exist, but this user cannot see them at all
  courseCompletionEnabled?: boolean }   // v5.4; absent = an older plugin = unknown
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

## Build stamp

`index.html` carries `<meta name="rumbos-build" content="<short commit>@<build time>">`,
and embed mode prints it once in the console (`[rumbos-embed] build ...`). To see whether
`/embed` and `/` come from the same build:

```
curl -s https://HOST/embed | grep rumbos-build
curl -s https://HOST/      | grep rumbos-build
```

The Docker build has no `.git`, so pass the commit in:

```
RUMBOS_BUILD_COMMIT=$(git rev-parse --short HEAD) docker compose build
# or, to build and start in one go:
RUMBOS_BUILD_COMMIT=$(git rev-parse --short HEAD) docker compose up -d --build
```

Without the variable the stamp says `unknown` (compose falls back to it). In PowerShell:
`$env:RUMBOS_BUILD_COMMIT = (git rev-parse --short HEAD); docker compose build`. A local
`pnpm build` reads git itself. Check the result with `curl -s https://HOST/embed | grep rumbos-build`.

## Mock host (development)

`mock-host/` is a dev page that plays the plugin. Not part of the production build.

```
VITE_USE_MOCK_API=true pnpm dev
# open http://127.0.0.1:5173/mock-host/   (the app is framed from http://localhost:5173/embed)
```

Using `127.0.0.1` for the host and `localhost` for the app makes them genuinely
different origins, so the origin checks are exercised. It provides: student/editor
roles, an "editing on" switch (host-init `mode`), "Overlay open" / "Overlay close + state", a per-activity table (availability: available / restricted / hidden /
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
- **"Pantalla completa"** in the header sends `request-fullscreen { on: true }`. The
  host owns leaving fullscreen (contract v5.4): while `host-fullscreen { on: true }`
  holds, the host draws its exit control in the top-right 64x64 CSS px of the
  viewport, above the app. The app hides its own toggle until `host-fullscreen
{ on: false }`, keeps that square free of interactive controls, and never
  assumes it is fullscreen before the host says so.
- The 3D view is a nested iframe with its own touch handling (unchanged).

## Contract v5.4

- **`courseCompletionEnabled`** on `CourseState`: whether completion tracking is on for
  the course. **Absent is unknown, never false**: the plugin and the app deploy
  independently, so an older plugin shows no banner and no "Configurar en Moodle". Its
  presence also tells the app the host speaks v5.4.
- **`open-activity-settings { cmid }`**, editor mode only. The host checks the
  capability and that the cmid is in its last state, then opens the activity's settings
  page in a new tab. The app never sends a URL. The app offers the button only when the
  state carries `courseCompletionEnabled`.
- **Fullscreen layout rule.** While `host-fullscreen { on: true }` holds, the host draws
  its exit control in the top-right 64x64 CSS px of the viewport, above the app. The app
  keeps that square free (the HUD never uses the top-right corner at all), hides its own
  toggle until `host-fullscreen { on: false }`, and never assumes it is fullscreen
  before the host says so. Escape and the exit control belong to the host.
- **State refresh.** Requests are throttled to one per 3 s and the last one is deferred,
  not dropped. After `host-overlay { open: false }` the app waits 1.5 s for the host's own
  refresh and asks once if none arrived.

## Contract v5.5

Both messages are additive and always `v: 1`; a host that does not know them ignores
them, so the area simply keeps the size and content it had.

- **`no-content { reason }`**: `"no_saved_map"` (the course has no saved level, or the
  opened level was never saved) or `"empty_map"` (the course's only level has no
  bubbles). Sent once per reason, only after the data has loaded (never while loading
  or when a request failed), and only by the student UI. An editor in editing mode never
  sends it: they see the editor and its call to action. A teacher viewing the course as a
  student also sends it, and still sees "Aún no hay un mapa guardado. Activa la edición
  del curso para configurarlo." in the app. A level that is empty among several shows a
  message in the app instead, because one empty level is not the whole course.
- **`preferred-size { aspectRatio }`**: width / height, clamped to 0.5..4 on the wire.
  Sent by the student UI once the level is open (for the fit modes that show the whole
  image, the background's ratio; for `original`, the large explorable canvas, 16/9), and
  again when the level changes. Never twice with the same value. The app lays out for any
  height the host gives it.

### Content bubbles

Content bubbles are not Moodle activities, so nothing about them crosses the host
boundary: opening and closing the viewer sends no message, and the viewer is a modal
inside the app, not the host overlay. A video loads nothing from YouTube or Vimeo until
the student presses "Reproducir"; links open in a new tab with `noopener noreferrer`.
Widgets run in a sandboxed frame, see [`WIDGET-SANDBOX.md`](WIDGET-SANDBOX.md).

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

### Added by content bubbles and never-empty states (v5.5)

On an iPhone with Safari, a mid-range Android, and inside a real Moodle:

- **The plugin handles `no-content`:** a course with no saved level, and one whose only
  level is empty, both fall back to the standard course content and do not flash the
  empty app first. Check the fallback does not loop when the teacher saves a level.
- **The plugin handles `preferred-size`:** the area follows it on a phone in portrait and
  landscape and on desktop, never below a sensible minimum, without a layout jump on every
  level change (the app sends it again when the level changes).
- **A content bubble on a phone:** the viewer is usable with one thumb (close button
  reachable, long text scrolls inside the dialog, the on-screen keyboard is not involved),
  Escape/back behaviour, VoiceOver and TalkBack read the title, the blocks in order and
  the alt text, focus returns where it came from.
- **Video click-to-load on real networks:** nothing from YouTube or Vimeo loads before
  the tap (check the network panel or a content blocker), the video plays inside the
  frame, and fullscreen from the player works on iOS. The app's `Referrer-Policy:
no-referrer` on `/embed` is overridden for the player by the iframe's own
  `referrerpolicy`; YouTube refuses some embeds without a referrer, so check a real one.
- **Images** from the asset store (PNG, JPEG, WebP up to 2048 px) load on a slow
  connection, lazily, with alt text; an image that fails shows its alt text.
- **First-visit auto-open** happens once, before the coach marks, and not again after a
  reload (localStorage in the iframe; check Safari's cross-site storage partitioning in a
  real Moodle, where it may forget between visits).
- **Widgets (only on a tenant that enables them):** run the hostile widget from
  `mock-host/widget-test.html` in Safari on macOS and iOS and in Firefox, and a real
  widget inside the real plugin page; check `close()` and `setHeight()`, the visible label,
  and "Ver descripción" with a screen reader. A tenant that turns widgets off shows the
  neutral message.
- **A backend that predates content bubbles** shows no editor entry and no content bubbles.

### Added by the immersive HUD work (v5.4 and the student stage)

- **Quiz inside a popup:** hand in a quiz in the real Moodle popup, close it, and check
  the bubble completes within a few seconds with its toast and announcement. The mock host
  has a scenario for this; a real Moodle that completes a quiz late (cron) will not match.
- **Escape in fullscreen with focus inside the iframe:** the contract leaves Escape to the
  host. Check a real Moodle host actually receives it while the iframe has focus.
- **The host's exit control in the top-right 64x64** against the app in fullscreen on a
  phone in portrait and landscape, with a notch (safe-area insets on all four edges).
- **Apariencia → 3D → "Guardar" → student sees 3D**, in a real Moodle with a real backend.
- **Resume:** open a level, move the camera, leave, come back (stable level ids only exist
  against a real backend; the mock issues new ones on every load).
- **Music (unverified):** Range requests, MP3 and M4A on iPhone Safari (which ignores
  programmatic volume), playing after the first tap, silence under a popup and in a hidden
  tab, and the 422/413/503 messages from the real backend.
- **Data saver:** Chrome with Save-Data on, and a throttled 2G/slow connection.
- **Text scaling to 200 %** and a screen reader (VoiceOver, TalkBack) on Misiones, the coach
  marks and the live announcements.
