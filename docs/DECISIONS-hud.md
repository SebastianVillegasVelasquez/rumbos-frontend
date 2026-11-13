# HUD work: decision log

Judgment calls the specification did not settle: what was decided, why, and the
alternative. Newest last.

## Bundle budget

- **Measure.** "Embed student initial JS" is the gzipped size of the entry, the
  html preloads and the lazy chunks the student route always needs (embed shell,
  app shell, 2D map), each with its static imports, each chunk counted once.
  Baseline: 268.4 KB. An earlier estimate of 294 KB double-counted shared
  chunks. Alternative: enable the Vite manifest; rejected to keep the check a
  dependency-free script over `dist/`.

## Contract v5.4 and version skew

- **A malformed `courseCompletionEnabled` is "unknown".** Anything that is not a
  boolean is dropped from the state, instead of rejecting the whole state (which
  would blank the map over one optional flag). Alternative: reject, as for the
  other fields; rejected because the field is advisory.
- **"The host speaks v5.4" means `courseCompletionEnabled` is present.** The
  contract has no version field in `host-state`; this is the signal an older
  plugin cannot send by accident.

## State refresh

- **Minimum gap 3 s, overlay grace 1.5 s.** Requests inside the gap are deferred
  to its end and coalesced. After an overlay closes the app waits 1.5 s for the
  host's own refresh and asks once if none arrived. Alternative: ask at once and
  always; rejected because the host already refreshes and the two would storm it.

## Repository

- **`main` was not pushed from here.** A push to `main` runs the workflow that
  builds and publishes the `latest` image. The feature branch was already on
  `origin/main`; the two hygiene commits stay local until pushed deliberately.

## Progress

- **"Untracked" is a visual state of its own.** Completion `none` shows as an
  open bubble that never pulses as "next" and has no completion effect, and is
  excluded from counts. Alternative: reuse "available"; rejected so the HUD,
  Misiones and the editor warnings can tell the two apart.
- **What counts toward progress.** Tracked activities the viewer can see.
  Excluded: untracked ones, activities that no longer exist, and, for students,
  "Próximamente" teasers (their completion is unknown and a permanently hidden
  one would keep a finished level at 9/10). Restricted and unverifiable
  activities stay in. Alternative: count teasers; rejected for the reason above.
- **Guided "next" ignores what the student cannot see.** A hidden activity at a
  lower sequence no longer blocks the sequence for ever.
- **Completion notices are per level.** Only activities on the open level are
  announced (a completion elsewhere is not news about this map), and never a
  hidden one (its name must not leak). The toast is silent to assistive
  technology because the live region already speaks the same text.
- **Baseline.** The first state after the level's Moodle data is ready, and the
  first state after switching level, set the baseline; nothing is announced.

## Student HUD shell

- **Immersive for everything that is not the editor.** Students (host student
  mode), "Vista previa" and "Guardado" all render the same `StudentStage`; only
  the editor keeps the header. A standalone `?view=published` therefore has no
  header either. Alternative: keep the header outside host mode; rejected
  because the preview must show what students see.
- **Placement is computed, then tested.** `hud/metrics.ts` holds the layout
  rules as numbers and a test checks no overlap, no entry into the 64 px corner
  and a 44 px minimum over 16 widths x 7 heights x touch x levels x preview.
  Real CSS can still differ from the model, so it is also checked in the mock
  host (360-wide phone frame, desktop).
- **Top-left buttons are icon-only below 640 px and stacked below 480 px.**
  Their names stay as accessible text and a tooltip. Alternative: keep labels;
  rejected because at 360 px they would run into the centered chip.
- **The chip is two lines.** "Nivel 2 de 4" (only with several levels) over
  "<título> · 3/8"; the title is what gives way, never the progress. The spec's
  example shows "Nivel 2 · 3/8"; the title is what students recognize.
- **The chip dims to 70 %, the controls to 45 %.** At 45 % a white-on-scrim chip
  falls to about 1.4:1 over a light map. At 70 % with the 0.86 scrim it stays
  above 4.5:1 over white, gray, black, yellow and sky maps (hud/contrast.test.ts).
  The chip is information, not a control.
- **The chip is max min(56vw, 280px) at the top** (below the 60vw ceiling, so it
  clears the left buttons and the corner at 320 px) and min(34vw, 256px) at the
  bottom left, which leaves room for a centered "Continuar".
- **"Continuar" shortens to its verb** when it has under 96 px, and its width is
  capped by the widest neighbor on either side. On touch screens "Mover el mapa"
  becomes icon-only below 640 px for the same reason.
- **The preview pill sits at the left edge, vertically centered.** The top is
  taken by the buttons and the chip, the bottom by "Continuar", and the right by
  the corner and the cluster; this is the one spot free at every size. It reads
  "Salir de la vista previa" (or "Salir de la vista guardada" in Guardado).
- **The level picker has no header for students.** It floats the fullscreen
  toggle at the bottom right. The toggle is also gone while the host owns
  fullscreen.
- **Misiones opens the existing overview modal for now.** The panel replaces it
  in the next step; until then the button keeps both views reachable.
- **The 3D-only activity list is hidden for students** because Misiones is the
  one list. The editor's 3D preview in the Appearance studio is unaffected.
- **Degraded-state banners stay in the page flow** above the map (rare, and they
  must not be missed); the toast stack lifts above the bottom row.
- **Sighted preview banner text removed.** The header's screen-reader-only mode
  note went with the header; the preview pill is the visible and spoken cue.

## Misiones

- **One list, two shapes.** A side panel from 640 px up (left, below the top-left
  buttons, stopping above the bottom row so the chip and Continuar stay clear)
  and a bottom sheet below it with half and full positions (full stops 64 px
  short of the top, under the host's corner). Alternative: a dialog; rejected
  because the map stays visible and usable beside the list.
- **The sheet always starts closed; only the side panel's state is remembered.**
  A sheet that reopened itself would cover half the map on every visit.
- **The sheet resizes by handle drag (48 px threshold), by the chevron button
  and by Arrow keys.** Dragging down from half closes it.
- **An open sheet hides what it covers** (chip, cluster, Continuar, preview
  pill) and removes it from the tab order; the top-left buttons stay so
  Misiones can be toggled. Alternative: leave everything under it; rejected
  because focus would land on obscured controls.
- **"Siguiente" is Continuar's target in both modes.** In explorative mode that
  is the first open incomplete activity by sequence.
- **Untracked activities sit under "Disponibles"** with the status "Sin
  seguimiento" and a dashed-circle icon, instead of a group of their own.
  Alternative: a sixth group; rejected to keep the five the brief names.
- **Missing and unverifiable activities go under "Bloqueadas"** with their own
  status line and no "Abrir". Hidden ones are "Próximamente" with no real name.
- **The 3D-only list and its strings are gone;** Misiones drives the pins
  through the same focus request. The overview modal stays for the editor
  (header "Resumen de actividades"), which still needs its editor groups.

## Continuar and resume

- **Continuar is two taps.** The first flies the camera to the activity,
  highlights it (and its row in Misiones) and the button becomes "Abrir:
  <nombre>"; the second opens it through the host. The armed state belongs to
  that activity: if the target changes (it was completed, a lock lifted) the
  button goes back to "Continuar". Opening anything else does not disarm it.
- **Resume covers the last level and one camera view per level**, per viewer
  and course, in localStorage, validated on read (finite numbers, zoom clamped
  to 1..3, at most 30 views, oldest dropped first).
- **Resume jumps back into the last level once, at the start.** The picker is
  skipped only when the app first opens; "Niveles" still shows it. Only students
  (host student mode) resume; the editor always starts at the picker.
- **The camera is saved every 2 s while it changes, when the tab is hidden or
  closed, and when the level changes**, tagged with its level so a view is never
  filed under the next one. A resumed view opens without the fly-in intro.
- **"Reiniciar vista" lives in Misiones' footer (2D only)** and flies back to the
  map's own starting view; "Recentrar" in the corner still fits the whole map.
  Alternative: a second corner button; rejected to keep the cluster short.
- **MapCanvas remounts per level** (keyed by level id). Before, the "apply the
  starting view once" guard was never re-armed when moving between levels.
- **Not verified in the mock host:** the mock API issues new level ids on every
  page load, so a saved level never matches after a reload. The storage logic is
  unit tested; the end-to-end resume needs a real backend (stable ids).

## Coach marks

- **Three steps, in the brief's order:** "Recorre el mapa", "Toca una burbuja",
  "Abre Misiones". Shown once per viewer (localStorage) to students only, never
  in an editor's preview. If storage cannot be read the marks do not show,
  rather than nagging on every visit.
- **A non-modal dialog.** Focus moves to its button at each step so keyboard and
  screen-reader users meet it; Escape skips; focus returns to where it was. It
  steps aside (keeping its step) while Misiones is open or a host overlay is
  open. Alternative: a modal with a backdrop; rejected because the map should
  stay usable underneath.
- **Placement:** above Continuar, centered, at most 320 px and never reaching the
  bottom-right cluster; the last step sits under the Misiones button. There is
  no animation, so reduced motion needs no special case.
- **On touch screens the first step names "Mover el mapa"** (the scroll-trap
  button), since dragging only works after tapping it.

## Editor completion warnings

- **The warning is a triangle with "!" on the bubble** (shape, not just amber),
  and an amber badge "Sin finalización configurada" in the bubble's popover and
  in the activity overview, which is the editor's list. Misiones is the
  student HUD, so the editor's preview shows no warnings at all.
- **"Configurar en Moodle" only appears for an embedded editor whose host sends
  `courseCompletionEnabled`** (it speaks v5.4); an older host would ignore the
  message. It sits in the bubble popover and in each overview row.
- **The course banner needs the flag to be `false`.** Absent means unknown and
  says nothing. It is a polite status (amber), not an alert, because the editor
  cannot fix it from here.
- **The guided-mode warning is an alert** (red, thick border, above the map)
  with a second sentence giving how many activities lack it. It shows whenever
  the level is guided and has a visible untracked activity, in or out of the
  embed (the standalone app never marks an activity untracked, so it stays quiet
  there). Missing activities are not counted.

## Data saver

- **Automatic on Save-Data or an effective type of slow-2g or 2g.** 3g counts as
  fast enough. A browser that reports no connection (Safari, Firefox) is treated
  as not slow: the manual switch is the only way there.
- **A manual choice beats detection both ways** ("Activado" and "Desactivado"),
  with "Volver a automático" to hand control back. It is remembered per viewer.
- **Effects:** the animation tier is capped at "low" (a user setting of "high"
  or "medium" is held down while it is on); no ambient particles; a remembered
  3D choice is set aside at start (an explicit `?view=3d` link or the toggle
  still opens 3D); the audio code reads the same flag to skip preloading.
- **Smaller images: not done, on purpose.** The only variant the backend
  exposes is `/assets/{id}/thumb`, a list thumbnail, not a map-sized rendition;
  using it as the map background would blur the map. The level picker already
  uses thumbs. This needs a backend variant (a width parameter) to do properly.
- **The settings button is a third icon in the top-left group** (always icon-only)
  because the brief's corner cluster has no settings slot. When the saver is on
  it wears a leaf badge and its accessible name says so; that is the indicator.
- **The switch shows the effective state** ("on" when auto-detected), so one tap
  turns an automatic saver off.

## Music (UNVERIFIED against a real backend)

Built against the contract and the mock only. Not yet exercised: HTTP Range
requests (iOS Safari needs them), the 422/413/503 mappings against real
responses, real MP3/M4A decoding, `audioInfo` and `audioChanged` as the backend
actually sends them, and anything on a real phone. Treat as unverified.

- **Feature detection.** The Música tab exists only if the library listing
  (`GET /assets?kind=audio&scope=library`) succeeds; any error, including a 404
  from a backend that predates audio, hides the tab. For students the control
  appears only when the map has `settings.audio` and the server returned
  `audioInfo` (no credit, no control).
- **Uploads are discovered by failing.** There is no capability endpoint, so the
  "Subir propio" tab is there until an upload answers 503
  `audio_uploads_disabled`; then it is replaced by the explanation and does not
  come back during that session.
- **Playback rule** (pure, tested): never before a gesture; autostart after the
  first gesture only if the editor enabled it, the viewer has not switched it
  off and data saver is off; the viewer's button always wins; pause under a host
  overlay and while the tab is hidden; resume only what was playing.
- **A gesture earlier in the session counts.** A tap in the level picker already
  unlocked audio, so autostart applies as soon as a track with the option
  appears. Alternative: wait for a tap on the map; rejected as pointless friction.
- **The viewer's "off" persists; "on" does not autostart next time** unless the
  editor's option is set. The spec ties autostart to the editor's flag and the
  viewer not having muted, and nothing else.
- **The music is one module-level session**, so it survives the 2D/3D switch and
  levels sharing a track. Leaving the stage (the level picker) pauses it without
  forgetting.
- **Fades are 400 ms**, done on `element.volume`. iOS Safari ignores
  programmatic volume, so there the fade (and the volume slider) do nothing;
  start, stop and mute still work. Needs a real iPhone to confirm.
- **`preload="none"`, and the source is assigned only at the first play.**
- **Volume:** the viewer's own volume wins over the map's default once set.
- **The mock plays generated sine tones** (WAV blobs); `?mockAudio=off` makes the
  endpoints 404 and `?mockAudio=uploads-off` makes uploads answer 503.
- **Bug found while verifying:** the draft cache merged saves field by field and
  dropped `audioInfo`, so a saved track never reached the preview. Fixed.
- **Bundle:** the player, session and fades are a lazy chunk (about 2.5 KB gz).
  The editor strings and tab cost about 3 KB in the initial bundle.

## Mock host

- **The mock plays the v5.4 host:** a `courseCompletionEnabled` selector (true,
  false, absent = an older plugin), the exit control in fullscreen (64x64, top
  right, above the app) that answers `host-fullscreen`, `open-activity-settings`
  (editor only, known cmid), "Overlay close, no state" (the host forgets to
  refresh) and a quiz-submitted scenario.
- **Escape inside the iframe never reaches the host page in this mock.** A
  keydown with focus in the iframe goes to the iframe. The contract leaves
  Escape to the host; whether a real Moodle host sees it while the iframe has
  focus must be checked by hand (listed in the hand-test list).

## Never-empty states and preferred size (contract v5.5)

- **`empty_map` only when the open level is the course's only one.** With several
  levels, one empty level is not the whole course: sending `no-content` would make
  the host drop the area and strand the student without the other levels. The app
  says "Este nivel todavía no tiene actividades." and offers the level picker.
  Alternative: always send; rejected for that reason.
- **`no_saved_map` covers two cases:** a course with no saved level, and a link to a
  level that was never saved (404 `not_published`). A failed request is neither:
  nothing is sent.
- **Both reports are student-UI only and idempotent.** A host-student-mode editor
  also reports (and keeps the in-app message). The once-per-reason rule lives in
  `hostReports.ts`; it is per page load, not per condition change. Alternative:
  re-arm when content appears; rejected, a host that already fell back has left.
- **`preferred-size` is student UI only.** An editor needs the room the host gives
  them for the palette and dialogs. It is sent for every level that opens,
  including an empty one (harmless: the host is already falling back).
- **Aspect, not pixels.** `original` (large explorable canvas) asks for 16/9; the
  three fitting modes use the background's own ratio, read with `useImageSize`
  (a second request for the same image, served from cache). Until the size is known
  nothing is sent. The ratio is rounded to a thousandth before the duplicate check.

## Content bubbles

- **A content bubble is informational by one predicate** (`isContentBubble`,
  `kind === "content"`; a missing `kind` is an activity). Progress, "next", Continuar
  and the overview modal skip it; the canvas gives it `informational`, so it is always
  open; the quest log files it under "Información". Alternative: mark it untracked;
  rejected because untracked means "a Moodle activity without completion" and shows
  warnings to editors.
- **It sits beside the path, not on it.** The dashed path and the traveler dot join
  activities only; a content bubble in the middle of a route would read as a step.
- **The "info" icon is drawn but never stored.** The backend contract lists no `info`
  in the bubble icon set, so a content bubble with `icon: null` is drawn with it by
  default and the popover's icon picker is unchanged. A teacher who picks another icon
  stores one of the existing ones.
- **Feature detection is learned, not assumed** (`contentSupport.ts`): any bubble with
  `kind` says yes; a create refused with 400 or 422 that is not one of the content
  codes, or answered with a bubble that is not content, says no and hides the palette
  entry. While unknown the entry is offered (an empty map has nothing to learn from).
- **`/auth/me` fails closed.** `features` absent, a failed request, or anything but
  `true` means no widgets. It is fetched once per course session (5 min stale time).
- **Seen and first visit.** One localStorage record, bubble id plus a hash of the
  content, so editing the content makes it new. Opening by hand marks it at once; an
  auto-opened content is marked when it is closed (marking it while open made it
  disappear on the next render). At most one auto-open per level visit, for students
  only: not in an editor's previews (nothing is marked there either), not while a host
  overlay is open. It opens before the coach marks, which wait their turn.
- **Focus returns to what had it.** The canvas is one focusable element and its bubbles
  are not individually focusable, so "back to the bubble" is the element that opened the
  viewer: the canvas, the Misiones row, or the 3D frame. Radix restores it.
- **Video.** The placeholder shows the title and "Reproducir (se cargará desde
  YouTube/Vimeo)"; nothing third-party loads before the tap, data saver or not. The frame
  is `sandbox="allow-scripts allow-same-origin allow-presentation"` with its own
  `referrerpolicy="strict-origin-when-cross-origin"` (the embed route's `no-referrer`
  would otherwise be inherited, and YouTube refuses some embeds without a referrer: not
  verified against a real player).
- **Images** come from `/assets/{id}`, lazy, with alt text; one that fails shows its alt
  text instead. The `image` kind refuses AVIF client side (the contract lists PNG, JPEG,
  WebP).
- **Creating saves nothing until "Guardar contenido".** A bubble is not created empty and
  then edited; the dialog collects it, and a drop on the map supplies the position. An
  empty block list is allowed. The type (blocks or widget) is chosen at creation.
- **Reordering is by buttons, plus Alt+Arrow on a focused block.** Keys are stable, so
  focus stays on the moved block's buttons.
- **A widget whose tenant turned widgets off** renders the neutral message and the editor
  shows it read-only (save is disabled): the server would answer 403.
- **Message handling in the widget frame:** exact shape, finite height clamped to
  120..1600 px, at most one accepted message per 100 ms.
- **The level card's "N actividades" comes from the backend's `bubbleCount`,** which
  includes content bubbles (seen in the mock). Not changed here; the backend may want to
  count activities only.
- **Bundle.** The viewer (including the sandbox and widget frame) and the editor are lazy
  chunks. The initial JS grew from 280.2 KB (before this work) to the figure in
  `docs/HUD.md`: the Spanish strings and the editor/viewer state in `App` are in the
  entry; moving the dictionary per feature was out of scope.
- **Tests that need a real browser were run in Chrome 155 only** (the hostile widget and
  the mock-host scenarios). Safari, Firefox, iOS and Android are on the hand-test list.

## Welcome curtain, music by default and collision-free 3D

- **The backend was not running,** so `MapSettings.welcome` and `welcome_invalid` were
  built against the written contract and a mock, not checked against `/openapi.json`.
- **Feature detection** for the Bienvenida tab is "the settings carry a `welcome` key".
  The contract says null or absent both mean defaults, so absence alone cannot tell an old
  backend from a new one; this relies on the backend sending `welcome: null`. To confirm.
- **The map is not mounted behind the curtain.** It mounts when the curtain closes, so
  the 2D fly-in and the 3D intro play after it with no extra hold flag or message. The
  cost is that the 3D world starts loading after the click. The HUD is inert meanwhile.
- **The editor's `startAfterInteraction` is still honored.** The curtain button is the
  first gesture, but music starts only if the editor left that option on (now preselected
  when music is first added; maps that already stored false keep it). Data saver still
  blocks autostart.
- **"Sin música" on the curtain is the viewer's remembered mute** (the same preference as
  the volume popover), so it wins over the editor from then on, and turning it back on
  starts the music.
- **Music waits while the welcome video plays** (a new hold in the audio state) so the two
  do not talk over each other.
- **The "Video alojado en <proveedor>" footnote** is shown whenever the welcome has a
  video, as asked, and is easy to remove (one line in `WelcomeCurtain.tsx`) if legal review
  says the privacy policy suffices.
- **Video end detection** reads the providers' own postMessage events (YouTube
  `onStateChange` 0, Vimeo `finish`) with origin and source checks; "Saltar" always works
  if they never arrive. Not verified against real players.
- **Welcome changes count as "settings"** in the save dialog: the backend's change list
  has no separate welcome flag.
- **`first_visit` is keyed by map id and a hash of the welcome settings,** so editing the
  welcome shows it once more. "Vista previa" remembers nothing.
- **Removed in embed 3D:** auto-rotate and "hide pins", which the HUD has no slot for.
  The standalone `/3d/?demo=1` page keeps them.
- **The 3D page's own controls are hidden, not deleted,** in bare mode (`display: none`
  on `html[data-ui="bare"]`), so the world code keeps working unchanged.
- **Labels under the HUD are hidden, not moved,** in bare mode; the detail panel is
  positioned inside the insets. Insets are one rectangle per edge, so the right inset
  (the control column) reserves the full height on the right.
- **Pill in the level picker** moved from the left edge, centered, to the bottom left,
  because it overlapped the first level card (found by the layout check).
- **No button names the video provider.** The curtain says "Reproducir" / "Ver video de
  bienvenida" and the click-to-load block says "Reproducir video". "Video alojado en
  <proveedor>" is plain text outside the buttons, from one key (`welcome.videoHost`); an empty
  string hides it. The video block of content bubbles now shows the same footnote under its
  button, so the third-party disclosure survives the shorter label.
- **Curtain fullscreen button** sits in the bottom row, right, with the provider footnote
  on the left; the music switch stays in the centered column above (it was not moved).
  It follows host-fullscreen when embedded and the browser's `fullscreenchange` standalone
  (hidden without the Fullscreen API), and never starts the music or closes the curtain.
  If it had focus when it leaves, focus returns to the primary button.
- **Audio that cannot play:** one retry on the element's `error`, then the track is dropped
  for the session. `play()` rejections that the `error` event also reports (NotSupported,
  Abort) are not counted twice. Students lose the control silently; editors and the preview
  keep it with the warning. A track the backend marks `available: false` is never
  downloaded: students never get a control, editors get the warning.
- **Unavailable tracks in the pickers are shown disabled** with "No disponible" (not hidden),
  so an editor can still see that an upload exists. Absent `available` is treated as available.
- **"Editor" for the audio warning** means the preview/published-view exit is on screen, or
  the host's mode is editor.
- **Mock API tests:** `mockCourseMapApi.ts` cannot be imported under `node --test` (it
  imports an .avif asset), so the cases are tested through the pure helpers. The mock
  answers `?mockAudio=missing` and `?mockAudio=legacy` for manual checks.
- **One shared set of video iframe attributes** (`content/videoFrame.ts`), used by the curtain,
  the video blocks and the editor previews. `allow` is exactly `autoplay; fullscreen;
picture-in-picture`: `encrypted-media` is gone (the embeds play without it, and nothing else
  is delegated), and the video blocks now carry `autoplay` too so all three frames are alike.
  The sandbox keeps its three tokens (scripts, same-origin, presentation); popups stay out, so
  the provider's "watch on ..." links do nothing. Fullscreen has no sandbox token. A unit test
  pins both strings.
- **Branch base:** this work builds on `feat/curtain-fullscreen-audio-resilience`, not `main`,
  because the curtain's fullscreen button and its helpers only exist there.
- **"Ampliar video" was removed, from the curtain and from the video blocks** (root cause
  below). The shared component is now `content/VideoFrame.tsx`: an iframe in a box the caller
  sizes plus an optional row of actions. Fullscreen is the player's own button (the iframe
  attributes delegate it); the host's fullscreen button stays in the curtain.
- **Root cause of the tiny enlarged box (reproduced in Playwright's Chromium and WebKit by
  pressing the button, at 1100x240 up to 1800x1100).** The enlarged wrapper was
  `position: fixed; inset: 0`, but it sat inside the curtain's column, which carries
  `animation: welcome-in 450ms ease-out both`. With `fill-mode: both` the animation keeps
  applying `transform` after it ends (`matrix(1,0,0,1,0,0)`), and an element with a transform
  is the containing block of its fixed descendants. So `inset: 0` resolved against the 672x32
  column, not the viewport, and the player got only its floor, `min-h-[158px]`: a 656x158
  strip. Control runs with the animation absent (reduced motion, or the class removed) gave
  1440x800 with a 1424x732 player. Reduced-motion and data-saver viewers never saw it. **Rule
  for later: never put a `position: fixed` element under `.welcome-in`.** The earlier
  "Ampliar video keeps the 280x158 floor" decision below no longer applies.

## Export, import and the teacher heat map

- **Position in section is 1-based, in source order.** The host state carries no
  `positionInSection`, so the app derives it per section from the order the activities arrive.
  The plugin must send activities in course order for matching tier 4 to be meaningful.
- **Export and import live in a "Niveles" menu in the editor header.** A course with one level
  opens it directly and never shows the carousel, so a carousel-only entry would be unreachable.
- **Route detection is optimistic.** Both buttons show until a call answers 404/405/501 with
  `unknown_error`; then they hide for the session (the `contentSupport` pattern).
- **Matching:** tier 1 (exact name) and tier 2 (same `Qn` code) are "Coincide", but a code match
  needs the same modname or it is "Parecido (revisa)". Tiers 3 and 4 are always "Parecido".
  Assignment is greedy and one-to-one; ties break by descriptor, then target order.
- **All proposals are preselected;** "Aceptar las coincidencias exactas" restores the exact
  proposal on every row that was changed and marks it reviewed. Editing an exact row stops it
  counting as exact.
- **Standalone with zero levels has no activity list** to match against, so the wizard explains
  that instead of proposing targets.
- **Heat-map palette: ColorBrewer Blues, six sequential stops** (last two darkened to
  `#2171b5`, `#08306b` for contrast). One hue changing in lightness survives the common color
  blindnesses; the percentage is always written, never color alone. Untracked bubbles use a
  dashed grey ring and text.
- **Heat map offers no 3D badge.** It is editor-only and editing stays on the 2D map, so a 3D
  per-pin badge has no audience. Skipped on purpose.
- **Host silence:** no answer in 8 s means the host predates v5.7; the panel says so rather than
  spinning. A real error is shown with its own text and, for `unavailable`, a retry.
- **Stats are never cached.** Not in React Query, storage, logs or error reports; a static scan
  test enforces it, and the data is dropped when the switch goes off or the page hides.
- **Heat-map toggle sits in the editor header**, not in the HUD, which has layout rules tested
  to the pixel. In the editor's preview mode the header is gone, so a small button appears on
  the map instead.

## The welcome video box (robust sizing)

- **Reproduced before changing anything.** In Chromium and in Playwright's WebKit the
  video panel only collapsed when the app's viewport was under about 307 px high
  (a Moodle iframe that short needs a site minimum under 307 px, or a phone in
  landscape): the `max-width: min(100%, calc((100dvh - 150px) * 16/9))` cap shrank it
  to 267x150, 178x100 and 89x50, always keeping 16:9. The flat strip in the user's
  photos (width near 640, height far under 360) did **not** reproduce in either engine,
  in video mode, in host fullscreen, with a 300x150 or a tall stand-in iframe, or with
  the provider blocked. The `flex-shrink` / `min-height: auto` hypothesis was not
  confirmed: the panel computes `flex-shrink: 1`, but its column has no fixed height,
  so nothing squeezes it. Open: Safari itself (see the hand-test list).
- **The panel is sized from the measured boxes of the curtain**, width first, capped by
  the room left in height (`fitVideoPanel`), never under 280x158. The minimum wins over
  the height cap: the curtain scrolls instead. A container narrower than the minimum is
  not overflowed by it, and a zero or non-finite first measurement returns null so the
  CSS fallback keeps the panel (`styles/video-panel.css`: `flex: none`, explicit width,
  `min-width`, `aspect-ratio` with the padding-top fallback, `vh` then `dvh` as a
  maximum only).
- **The reserved height is 160 px** (column padding 32, gap and button row 64, footer
  56), not the old unexplained 150. In video mode the column's padding drops from 56 to
  16 px and the footnote is hidden; the title and message were already hidden.
- **"Empezar viaje" sits next to "Saltar" during the video.** Before, the only way in
  while the video was up was "Saltar" and then a second click. It stays in every state.
  The music toggle stays out of video mode as before (it is set before the click).
- **Load failure uses only what a cross-origin iframe gives:** its `load` event and a
  10 s timeout after the click. A provider page that loads and shows its own error (a
  removed video, a blocked embed) still fires `load`, so it counts as loaded; Chromium
  also fires `load` for its own error page when a request is blocked, while WebKit does
  not. The message "No pudimos cargar el video." therefore means "no load event in 10 s",
  and only that. It never replaces the button.
- **Playback is not assumed.** The curtain reads play, pause and end from the player
  (Vimeo now also subscribes to `play` and `pause`). The music is held on the click and
  while the video plays, and released on pause and end, so an autoplay the browser
  refused leaves the player's own play button usable and the music audible. It never
  waits for an `ended` to offer the way in. Not verified in real Safari.
- **Provider stand-ins are served by `context.route`, not by the dev server**, at the
  provider's own origin, so the origin checks in the curtain stay real.
- **`?diag=1` works in production, lazily, read-only.** One tiny listener in `main.tsx`
  keeps the last uncaught error in memory; the panel is its own chunk, measures the DOM
  every second and sends nothing (a source scan test and an e2e request check enforce
  it). Inside a real Moodle the iframe address is set by the plugin, so a viewer cannot
  append the flag there: ask them to open the app's own address with `?diag=1`, or have
  the plugin forward a flag from the Moodle page (a plugin change, out of scope).
- **Browser-support floor (provisional, to be confirmed with the client):** current and
  previous Chrome, Safari 16.4 or newer. 15.4 was the first proposal, from the video
  box's own CSS (`aspect-ratio` 15, `dvh` 15.4); the shipped stylesheet is higher:
  Tailwind v4 emits `@property` (Safari 16.4) and `color-mix()` (16.2). The video box
  keeps working before 16.4 by its own fallbacks (`vh` where there is no `dvh`, the
  padding-top trick where there is no `aspect-ratio`), but the rest of the app is not
  promised there.

## The welcome curtain's music control

- **Root cause (reproduced with the real audio session in Playwright Chromium and WebKit,
  with the media element stubbed).** The curtain's "Sin música" switch was local
  `useState`; the audio session, the single owner of `prefs.muted`, only heard about it
  when the primary button was pressed. Meanwhile the session's own global first-gesture
  listener (capture phase on `document`) counted the click on the switch as the viewer's
  first gesture and autostarted the music with `prefs.muted` still false. Measured before
  the fix: click "Sin música" gave `wants=true playing=true el.paused=false` (it started
  the music), after the video ended and the music resumed, toggling the switch changed
  nothing (`playing` stayed true until the primary button), a click on the disc or the
  title started the music, and a click made before the lazy audio chunk arrived was
  dropped (nothing stored), so the next click anywhere started music the viewer had
  switched off. Not the cause: no overlay or `pointer-events` covering it, no `disabled`
  (only in the editor preview, on purpose), no re-render resetting the state; the HUD
  and the curtain agreed afterwards because the primary button forced `setMuted`.
- **`prefs.muted` is the single source of truth.** The switch no longer holds state. It
  shows `wants`, or, while the viewer has not chosen, what the autostart rule will do at
  the button (editor's "Iniciar al empezar", data saver, remembered mute). A click calls
  `audioSession.setMuted`, which stores the mute and dispatches a new `mute` event.
- **The reducer owns the rules.** New `curtainWaiting` state with a `welcome` event
  (`waiting`, `started`, `closed`): while the curtain waits for its primary button a
  gesture neither starts nor decides anything, so no click inside the curtain starts the
  music; the session's global listener also keeps listening instead of removing itself.
  `closed` releases the video hold. Audio focus: `held` (the video) and `curtainWaiting`
  both make `isPlaying` false, so held music and a playing video are never heard
  together; tests pin every transition, including a noise sequence while held.
- **Judgment: the viewer's explicit "on" beats the editor's "Iniciar al empezar".** The
  switch left alone follows the editor and data saver (and then shows "Sin música"); a
  viewer who turns it on on that very screen gets music at the button. Data saver still
  blocks the default start only.
- **Judgment: the disc, the title and the state are one switch.** The disc looked
  tappable and was not; it is now inside the switch's button (decorative, `aria-hidden`),
  so there is no dead control. Still a native button: Space and Enter work, `aria-checked`
  is what a screen reader announces, the track title is its description.
- **Judgment: "stops immediately" means the fade starts at once.** The 400 ms fade
  (`fade.ts`) stays so the music never cuts with a click; the element is paused when it
  ends. The switch changes in the same frame.
- **A choice that races the lazy chunk is replayed, even if the curtain closes first.**
  `createCurtainMusic` (framework-free, `welcome/curtainMusic.ts`) remembers what the
  viewer did and applies it when the session arrives. A start replayed that late is not
  inside a gesture, so a browser that insists on one will start it at the next click.
- **No video-mode switch.** The switch stays out of the video phase (the curtain's video
  mode is dense); the music is held there, and the choice is made before or after.
- **Test limits, stated plainly.** The repo has no DOM test library and no new
  dependency was allowed, so the "component test with a fake session" is the controller
  that carries all of the component's logic, run against a fake session that uses the
  real reducer and autostart rule (`curtainMusic.test.ts`), plus Playwright
  (`e2e/curtain-music.spec.ts`, Chromium and WebKit) on the real component. What the
  Playwright stub fakes (`e2e/audioStub.ts`): `HTMLMediaElement.play`, `pause`, `load`,
  `paused` and `src` only; nothing is downloaded or decoded, the session, the reducer,
  the storage and the component are real. Playwright's WebKit has no media codecs, so
  without neutralising `src` it fires a real `error` and fails the track.

## Welcome flow (branch feat/welcome-flow)

- **Stacked on the corrections.** This branch starts from tip `b3f1535` of
  `fix/video-enlarge-and-curtain-music`, which is not yet on `main`. If the corrections
  are integrated with a squash, the rebase is `git rebase --onto main b3f1535`.
- **Build to the brief, not to a server.** The backend and the plugin are built in
  parallel; no running server has the new contract. Every field below is taken from the
  brief and marked as an assumption where the brief is silent. A contract test reads a
  local `openapi.json` (path in `OPENAPI_JSON`, skipped when absent) and checks the
  fields this feature uses.
- **Legacy welcome becomes steps with fixed keys.** `legacywelcome` (a `welcome` step
  from title and message) and `legacyvideo` (a `video` step). The derived video step is
  `mandatory: false` because today's curtain never forces the video. Only steps the
  editor creates or changes explicitly start with `mandatory: true`. The old "seen" flag
  is ignored by the flow: viewers of an old map see the derived flow once more.
- **Video fallback rule (corrects the brief).** "Problemas con el video?" shows only when
  no start signal (ready or play) arrives within one timeout from the click, or the
  player reports an error. Playing for a long time never shows it: with working events the
  only way to complete a mandatory video is `ended`. If events never arrive, the exit
  records `fallback`. One constant, `VIDEO_LOAD_TIMEOUT_MS` (10 s, `videoPlayer.ts`),
  serves the curtain and the flow; the brief's 12 s is replaced by it on purpose.
- **Quiz result races.** The host closes its overlay, then sends a fresh `host-state`
  (or the app asks after 1.5 s). The result request must not run before the state is
  fresh, and an attempt that finishes while the overlay is open is only visible after
  the refresh. The step therefore asks for the result on three triggers while it is
  active: the overlay closing, every new `host-state`, and the tab regaining focus. The
  asks are idempotent and coalesced; the latest answer wins.
- **PDF viewer needs framing.** `/assets` must allow being framed (`frame-ancestors`
  with the app origin and the Moodle origin). If it does not, the inline viewer stays
  blank and "Abrir documento" (a new tab) is the only way; it is always shown.
- **A flow with no mandatory step still leaves one presence mark.** On finishing, the
  last step is recorded with the method `completed`, so "show: first visit" has
  something to remember. Without it a flow made only of optional steps would reopen on
  every visit.
- **Legacy maps keep the legacy curtain at runtime.** The derivation (`legacywelcome`,
  `legacyvideo`) is used by the editor's first save, which converts the old welcome to
  steps. A map without `steps` renders exactly as before; no student sees a changed
  curtain until an editor saves a flow.
- **`readonly` and `unavailable` behave like silence.** The host cannot keep progress
  right now, so the flow falls back to the per-viewer flag, as it does for a guest or
  an older plugin. A student is never stuck because Moodle cannot write.
- **PDF unavailable is non-blocking and records `unavailable`.** A document the backend
  reports as missing must not trap a student; the step offers "Continuar" with an
  explanation.
- **A silent host stops the quiz wait after 6 s** and the step records `unavailable`.
  An older plugin never answers `request-quiz-result`; waiting forever would trap the
  student.
- **`flow-step-done` only for mandatory steps.** Optional steps leave no trace in
  Moodle; the per-viewer flag is used only when Moodle does not keep progress.
- **Video load timeout is 10 s, not the brief's 12 s.** One constant serves the curtain
  and the flow, so the two cannot disagree.
- **A plain cover while the host is asked (up to 3 s).** The student sees an empty dark
  screen rather than the map, then either the flow or nothing; otherwise the map would
  flash before the flow covers it.
- **Writes go out at once under a 28-a-minute window.** A fixed gap between writes lost
  the last completions when a quick viewer left; a flow has 12 steps at most, far under
  the plugin's 30 a minute.
- **The client mirror of the HTML and CSS rules is a convenience, not a security
  boundary.** The sandbox (no scripts) and the server validation are the boundary.
- **The diag video probe may post one message.** The read-only test for `?diag=1` now
  allows `postMessage` in `VideoEventProbe.tsx` only, to the player origin, after the
  click: YouTube and Vimeo send events only once the embedder subscribes.

## Welcome flow editor (branch feat/welcome-editor)

- **Stacked on `feat/welcome-flow`.** It needs the flow types, validation and player. If
  that branch is squash-merged, rebase with `git rebase --onto main <tip of feat/welcome-flow>`.
- **Feature detection by `welcomeDocuments`.** ASSUMPTION: a backend that supports flows
  always returns `welcomeDocuments` (an array, possibly empty) on map reads. When it is
  absent, the tab is the old Bienvenida form and offers no conversion; sending `steps`
  to such a backend would be refused. Replace with the real signal once `/openapi.json`
  exists.
- **Legacy maps keep their form until the author converts.** "Convertir en pasos" runs
  `convertLegacyToSteps` (message and video become steps, the legacy fields are cleared
  because the backend refuses both at once). Nothing converts by itself.
- **The reset button lives in the flow tab, not a settings popover.** The app has no
  settings popover; the studio tab is where an editor looks for it. It is shown only
  inside Moodle (the progress lives there) and says, before the click, that Moodle only
  allows it with editing mode on. A `readonly` answer is reported in text.
- **The import to-do is derived, not stored.** `flow_quiz_unlinked` and `document_dropped`
  are computed from the flow (a quiz step with no cmid, a pdf step with no servable
  document), so they also catch a step left unlinked by hand and clear themselves when
  fixed. The import wizard additionally words the two warning codes.
- **The welcome step has no "obligatorio" checkbox.** It is a message with one button; its
  completion is the press. Other steps start mandatory when the editor creates them.
- **Duplicating resets the revision to 1** and gives a new key: a copy is a new step for
  progress purposes. A welcome step is never duplicated (only one, only first).
- **The secure-window warning is fixed text on every quiz step**, shown whether or not a
  quiz is linked (the editor cannot know the quiz setting).
- **PDF picker lists the tenant's documents** and uploads through the generic asset
  endpoint with `kind=document`; the rights declaration must be ticked before the file
  is sent, and the confidentiality warning is always visible there.
- **HTML starter templates** are plain markup inside the allowed tags and are tested to
  pass the same validation as author text.
- **Embed initial JS +2.4 KB** (308.6 -> 311.0 KB): only the Spanish strings, which live in
  the dictionary; the editor stays in the lazy studio chunk.

## Welcome flow: visual polish

Layout and look only: no contract, state machine, backend or plugin change.

- **The language of the app, with one exception.** The tokens say "hard shadows, never
  blurred" and the app is neo-brutalist (3 px ink borders, offset shadows). The card keeps
  that language inside (soft 2 px ink borders on the music card and the waiting button, the
  raised yellow primary, 24 px radius), but its own shadow is one soft layered token
  (`--shadow-flow`): a hard ink shadow disappears on the dark stage and the card would have no
  depth. No glassmorphism. Alternative: a hard shadow in a light color; rejected as a second
  palette.
- **Brand header zone is navy with a yellow edge.** Both are existing tokens (`--color-ink`,
  `--color-accent`); nothing new in the palette. The only new tokens are the stage overlay, the
  soft shadow and the card padding (`--flow-pad`).
- **The stepper has four kinds, not three.** `current`, `done`, `visited` (reached, not done,
  not here) and `locked`. The old dots painted every reachable unfinished step as "current"
  while only `state.index` drove the label, so after "Atrás" the label said step 1 and dot 2
  was highlighted. That was a styling bug (furthest-reached drawn as current), not a state
  bug: the segments and the line now come from the same `state.index`
  (`stepperModel.ts`). A completed step you came back to is `current` and says "hecho".
- **The step name in "Paso N de M" is the kind of step** (Bienvenida, Video, Lectura, Documento,
  Evaluación), not the author's title, which can be 120 characters. The title is the heading.
- **The primary action on the first step is centered and alone.** The spec asks for it
  centered on the welcome and for "Atrás" left and the primary right elsewhere. The first
  step has no "Atrás" (there is nothing before it), so its footer centers the one primary.
- **Waiting is a state of the button, not of its opacity.** `aria-disabled` stays (the button
  must stay focusable so its reason is read); the look is the yellow tint, a dashed ink edge
  and a lock, with the reason beside it as a status line with an hourglass. The reason copy is
  now an instruction ("Termina el video para continuar.").
- **The video exit lives in the footer status area**, not under the video. Same rules
  (`showTroubleAction`), same texts and button name.
- **Poster, not thumbnail.** Before play the step shows a dark frame with a large play button.
  A Vimeo or YouTube thumbnail needs a request (oEmbed or an image host) before the click,
  which the privacy rules of the flow forbid ("nothing is requested from the provider until the
  student presses play"). Ask before adding one.
- **The video frame is always 16:9.** The real aspect ratio is not known without asking the
  provider, so a square or vertical video is letterboxed by the player inside the 16:9 frame.
  Knowing it would need the provider's metadata (the same request as the thumbnail) or a field
  on the step in the contract.
- **A sandboxed HTML step cannot report its height.** The frame has no scripts and no
  same-origin access (that is the security boundary), so the host cannot read its content
  height. The frame takes the room the window leaves (`100dvh - 480px`, between 220 and 640
  px) and scrolls its own content when it is longer. Alternative: `allow-same-origin` to
  measure; rejected.
- **HTML and PDF run edge to edge, always.** No signal tells whether the author's CSS "defines
  its own surface" (a gradient on `body`, a card), so the rule is simpler: the card is the only
  frame, the frame has no border, radius or padding, and the author's `body` padding and white
  base come from `BASE_CSS`. A step is never a card inside a card.
- **The music choice is a new component; the old curtain switch is untouched.** It reuses
  `NowPlayingDisc` and the same `useCurtainMusic` state (`prefs.muted` stays the only source of
  truth). It shows only on the first step and only when the map has a track.
- **Widths.** 720 px for welcome and HTML, 960 px for video, quiz and PDF. (Changed in the
  corrections below: text and HTML are now 840 px.)
- **The top-right 64 px corner stays free** (the host puts its exit there): below 1100 px the
  card header keeps 64 px of right padding.
- **Fullscreen button is icon-only below 480 px**, to give the first rows back to the content;
  the name stays for assistive technology.
- **Visual baselines are per engine, not per OS.** Fonts render slightly differently between
  Windows and Linux, so the comparison allows 3% of pixels to differ. They were generated on
  Windows; regenerate them on the CI image if a pipeline is added.

## Welcome flow: corrections

- **Segments: the dashed look was the locked state.** `.flow-seg[data-kind='locked']` was a
  `dotted` border at 70% opacity on a transparent fill, on an 8 px pill: it renders as dashes and
  shimmers when the bar is scaled. Every state is now a solid shape: a track (white mixed 40% into
  the header ink, 3.57:1 against it, computed in `flowContrast.test.ts` from the CSS), a white
  outline on the track for a visited step, the accent for done and a taller white bar for the
  current one. No animation, so reduced motion is identical. The states differ by height, fill and
  outline, plus the "Paso N de M" text and `aria-current="step"`.
- **Widths: 840 px for welcome and HTML** (from 720, +17%). Video, PDF and quiz stay at 960. The
  prose measure stays 65ch, so the extra width goes to the author's own layout. Checked at 1280,
  1366 and 1920 (margins of at least 200 px) and at 768 and 360 (unchanged).
- **The music switch in the editor preview works, in memory only.** The preview used to disable
  it (dimmed, no response) because it mounts no audio session. It now keeps its own state and
  starts where a student's would (the editor's "start on interaction" and data saver, never the
  editor's saved mute). It never reads or writes `prefs.muted`, and **the preview plays no sound**:
  the editor already has the music tab to listen to the track. Ask if the preview should play.
- **The three music failures: not one cause.** Curtain and HUD failures were state bugs in the
  audio session that the stubbed-media tests could not see. This one was a deliberate `disabled`
  in preview, plus a spec that only covered the legacy curtain's "Música de fondo", never the
  flow's "Música de ambiente". What they share is the test gap, now closed with real-audio e2e
  and a 50-toggle agreement test on the real session.
- **Fixture honesty.** The mock labels its WAV tone `audio/mpeg` in the asset metadata; the blob
  itself is typed `audio/wav`, so the mime was never what stopped WebKit. The e2e now serves a
  real WAV and a real MP3 (MPEG-1 Layer III frames, silent: a valid stream, not music) over http
  with the right Content-Type and Range support.
- **WebKit playback in CI.** Playwright's WebKit on this machine fails every media load
  (MEDIA_ERR_SRC_NOT_SUPPORTED), even a data: WAV, so the earlier "session playing, element
  paused" was the element failing to load, not a defect. The real-audio spec detects this at run
  time and, only then, relaxes `currentTime advancing` to "the session wants playback, is not
  muted and created the element with the file", with a `relaxed` annotation on the run. Where the
  engine plays, the full assertions run.
- **Video fullscreen: not reproduced.** Against the real player.vimeo.com/video/1236382396, with
  the host iframe at `allow="fullscreen; autoplay"` and the app's own video attributes, Chromium's
  fullscreen worked in the student view and in the editor preview (the embedder's
  `document.fullscreenElement` became the iframe). The DOM chains differ only in the preview's
  wrappers (a Radix portal over the studio drawer); none has `inert`, `aria-hidden`,
  `pointer-events`, `transform` or `contain`, and the video iframe's `allow`, `allowfullscreen`
  and `sandbox` are identical in both. Control: without `allow`, Vimeo hides its fullscreen
  button. In a 390 px player the button sits behind the chevron ("Show controls"). So the cause
  is outside what this repo and a mock host can show; the `?diag=1` panel now reports the
  deciding values from the real Moodle session.
- **No behavior change for fullscreen without evidence.** Nothing was altered in the video frame:
  a guess at "the flow's fullscreen wins" would have no test that could fail. The e2e
  (`welcome-video-fullscreen.spec.ts`) stubs player.vimeo.com with a local page that requests
  fullscreen and reports back, and guards the attributes and the policy.
- **Quiz notice reworded**: secure-window quizzes open in a separate window; "permite las ventanas
  emergentes". The text stays fixed on every quiz step.
