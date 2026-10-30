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
