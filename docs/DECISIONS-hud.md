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
