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
