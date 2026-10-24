# 3D bridge: postMessage protocol v1

The 3D world runs in its own page (`/3d/`, entry `3d/index.html` → `3d/main.ts`)
inside an iframe of the app. The two sides only talk through `postMessage`.
Everything here is implemented once, in
[`src/features/view3d/protocol.ts`](../../src/features/view3d/protocol.ts), and
imported by both sides (the page's `3d/main.ts` and the host hook
`useView3dBridge.ts`), so the message shapes cannot drift apart.

All messages are JSON-compatible objects with `v: 1` and a `type`.

## Messages

```
3D page -> host
  { type: "rumbos:ready", v: 1 }                         sent once, when the page's bridge is listening
  { type: "rumbos:pin-click", v: 1, pointId }            the user selected a pin (or a label / list item)
  { type: "rumbos:open-activity", v: 1, pointId }        the detail panel's "Abrir" button
  { type: "rumbos:error", v: 1, code, message }          e.g. webgl_unavailable, load_failed, scene_unknown

host -> 3D page
  { type: "rumbos:init", v: 1, scene, locale: "es"|"en", reducedMotion: boolean,
    theme: { cssVars: Record<string,string> }, points: Point3D[] }
  { type: "rumbos:states", v: 1, states: Record<pointId, PinState> }   may be frequent
  { type: "rumbos:locale", v: 1, locale }
  { type: "rumbos:theme",  v: 1, cssVars }
  { type: "rumbos:focus",  v: 1, pointId }               fly to a pin and open its panel

Bare mode (the app's HUD owns every control; still `v: 1`, all additive):

  host -> 3D page
  { type: "rumbos:init", ..., ui: "bare" }       the page draws no controls, title, language
                                                  switch or places list: only the world, pin
                                                  labels and the detail panel
  { type: "rumbos:layout", v: 1, insets }         { top, right, bottom, left } CSS px the HUD
                                                  covers; labels under the HUD are hidden and
                                                  the detail panel stays inside
  { type: "rumbos:camera", v: 1, action }         "zoom-in" | "zoom-out" | "reset"
  3D page -> host
  { type: "rumbos:camera-state", v: 1, canZoomIn, canZoomOut }   the HUD disables its buttons

`/3d/?demo=1` sends no `ui`, so it keeps its own controls: bare is a flag, not a fork.
Auto-rotate and "hide pins" exist only in the standalone page; the HUD has no slot for them.

Point3D  = { id: string /* the bubble id */, zoneId: number, title: string|null,
             description: string|null, state: PinState }   // null text = the scene's built-in text
PinState = "locked" | "available" | "next" | "complete" | "teaser" | "missing"
```

`init` is idempotent: the host sends it again when the structure of the points
changes (another activity bound, a title edited); `states` carries only state
changes.

## Handshake

1. The host mounts the iframe and starts a 10 s timer.
2. As soon as the page's bridge is listening it sends `rumbos:ready`. This means
   "the page started", not "the world is built": building the world takes
   seconds on a slow tablet and shows the page's own loading screen, so it must
   not count against the 10 s. (`init` and later messages queue and are applied in
   order once the world exists.)
3. The host answers with `rumbos:init` and the status becomes ready.
4. No `ready` within 10 s (or an `error` message, which can also arrive later,
   e.g. no WebGL or a world that failed to load) → the host shows an error with
   _Reintentar_, which remounts the iframe and restarts the handshake. A device
   without WebGL (`webgl_unavailable`) gets a message and a way back to 2D
   instead of a retry.

## Security

Both directions:

- `event.origin === window.location.origin` and `event.source` is checked: the
  host accepts only its iframe's `contentWindow`, the page only `window.parent`.
- Messages are sent with an explicit `targetOrigin` (the same origin), never `"*"`.
- Every message goes through a hand-written type guard (`isHostMessage`,
  `isPageMessage`); unknown or malformed ones are ignored (logged in dev only).
- Sizes are bounded: at most 32 points, ids ≤ 100 chars, titles ≤ 500,
  descriptions ≤ 2000, ≤ 64 CSS variables.
- `cssVars` may only set `--r3d-*` properties and values with no `url(`,
  `@import`, `expression(`, braces, semicolons or angle brackets.
- Point text is plain text and is only ever assigned with `textContent`; the page
  has no `innerHTML`.
- The page never opens URLs or touches storage or the network: "Abrir" only
  sends `open-activity`, and the host opens the activity through the same opener
  as the 2D view.

Iframe attributes: `sandbox="allow-scripts allow-same-origin"` (our own
same-origin page loading its own assets; no top navigation, popups, forms or
downloads), `referrerpolicy="no-referrer"`, no `allow` features.

## Theme

At `init` and whenever the host theme changes (`data-theme`, class or style on
`<html>`), the host reads its design tokens and sends them as `--r3d-*`
variables (`src/features/view3d/themeVars.ts`):

| Variable                                               | Host token                                                   |
| ------------------------------------------------------ | ------------------------------------------------------------ |
| `--r3d-ink`, `--r3d-ink-soft`                          | `--color-ink`, `--color-ink-soft`                            |
| `--r3d-paper`, `--r3d-surface`                         | `--color-paper`, `--color-surface`                           |
| `--r3d-primary` (+ `-hover` mixed, `--r3d-on-primary`) | `--color-primary`                                            |
| `--r3d-tint`, `--r3d-accent`, `--r3d-accent-strong`    | `--color-primary-tint`, `--color-accent`, `--color-sun-dark` |
| `--r3d-border`                                         | mix of ink and surface                                       |
| `--r3d-radius-md`, `--r3d-radius-lg`                   | `--radius-sm`, `--radius-md`                                 |
| `--r3d-font-sans`, `--r3d-font-heading`                | `--font-body`, `--font-heading`                              |

`3d/world.css` reads each one with the original v8 value as the fallback, so the
page still looks right when nothing is sent (`/3d/?demo=1`). The host's web fonts
are not loaded inside the iframe, so the font stacks fall back to the system
font there; the page's own IBM Plex files are only used when no stack is sent.

## Behaviour notes

- **Locale.** The host's language is authoritative (`init`, `rumbos:locale`). The
  page keeps its own ES/EN switch (a local toggle); the next message from the
  host overrides it.
- **Pin states.** `locked`/`teaser` render grey with no ground ring, `missing` is
  dimmed and not clickable, `next` pulses, `complete` is green. The detail panel
  shows _Abrir_ only for `available`, `next` and `complete`.
- **Reduced motion.** `reducedMotion` (or the browser's own preference inside the
  frame) skips the opening flight, makes camera moves instant and stops pin bobbing.
- **Lifecycle.** Rendering pauses while the document is hidden and the WebGL
  context is released on `pagehide` (the host unmounts the iframe when leaving 3D).
- **Standalone.** `/3d/?demo=1` (optionally `&lang=en`) shows the 9 built-in zones
  with a mix of demo states and talks to nobody.
