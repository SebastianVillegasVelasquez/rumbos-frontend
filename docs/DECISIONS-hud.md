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
