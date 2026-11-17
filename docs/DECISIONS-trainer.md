# Decisions: native assessment and practice trainer (English A1)

Log of judgment calls for the trainer and assessment work. Newest at the bottom of each
section. Contract and policy are in the task brief; this file records what the code audit
found and what was decided because of it.

## 0. Audit (before any code)

### Base

- Branch `feat/trainer-assessment`, from `main` at `87379bc` (after `git pull`). `main` already
  contains `fix/welcome-flow-corrections` and `fix/checkin-never-traps`, so the HUD, the
  full-viewport flow stage and the check-in escape are all present.
- Design package copied from the user's Downloads into `docs/design/trainer/` (it was not in
  the repo). Committed alone as `docs(design)`.
- `commit-msg` hook: `.husky/commit-msg` (untracked, local) rejects `co-authored-by` and
  `generated with`. Husky runs lint-staged (eslint, prettier) on commit.

### Real tokens versus the package (`src/styles/tokens.css` wins)

| Package value                         | Real Rumbos                                                 | Action                                                                                                              |
| ------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| navy `#14284B`                        | `--color-ink #12284a`                                       | use token                                                                                                           |
| yellow `#FFB703`, cream `#FFF1D6`     | `--color-accent`, `--color-paper` (identical)               | use token                                                                                                           |
| teal `#0F7173`                        | `--color-primary #0b7377`                                   | use token                                                                                                           |
| pink `#FF8FA3`                        | `--color-pop` (decorative only, never text)                 | use token, no text on it                                                                                            |
| slate `#4A5878`                       | `--color-slate-dark #4a5873`                                | use token                                                                                                           |
| error `#B3261E` on `#FFE0E3`          | `--color-danger` on `--color-danger-tint`                   | use token                                                                                                           |
| line `#C9D1E0`, disabled `#E6E9F0`    | none exact; `--color-slate-tint #eef0f4` close              | use token, `TODO(design-token)` if gap                                                                              |
| highlight `#FFE39A`                   | `--color-sun-tint #ffedb8`                                  | use token                                                                                                           |
| radius card 28 / panel 18 / button 14 | `--radius-lg 24`, `--radius-md 14`                          | use tokens (24 not 28)                                                                                              |
| shadow button 4px, card 10px (hard)   | `--shadow-md 5px`, `--shadow-lg 10px`                       | use tokens. The flow stage uses `--shadow-flow` (soft), not hard ink shadows, because they vanish on the dark scrim |
| border 2px                            | `--bw-soft 2px` (`--bw-strong 3px`)                         | use tokens                                                                                                          |
| fonts Outfit / Figtree                | `@fontsource-variable/outfit` and `figtree`, already loaded | no new font. Confirmed                                                                                              |
| HUD button 52 / 44 px                 | HUD `Button variant="surface" size="sm" dense`              | reuse; check 44 px min on compact                                                                                   |
| spacing 4,8,12,16,24,32               | Tailwind spacing, `--flow-pad`                              | reuse                                                                                                               |

The package's contrast table was computed on eyeballed hexes. Recomputed from the real tokens
(WCAG 2.x relative luminance):

| Pair                  | Ratio | Pair                             | Ratio       |
| --------------------- | ----- | -------------------------------- | ----------- |
| ink on surface        | 14.70 | primary on surface (and inverse) | 5.63        |
| ink on paper          | 13.17 | primary on paper                 | 5.04        |
| ink on accent         | 8.42  | primary on surface-muted         | 5.32        |
| surface on ink        | 14.70 | ink-soft on surface / paper      | 8.37 / 7.49 |
| slate-dark on surface | 7.16  | slate-dark on slate-tint         | 6.27        |
| ink on sun-tint       | 12.64 | ink on danger-tint               | 12.18       |
| danger on danger-tint | 5.41  | leaf-dark on leaf-tint           | 5.73        |
| ink on pop (pink)     | 6.80  | ink on primary-tint              | 12.54       |

All clear AA (4.5:1) for text. Pink is decorative only by the existing rule.

### Existing pieces to reuse

- **Flow stage**: `src/styles/welcome-flow.css` (`.flow-stage`, `.flow-card` with `data-wide`,
  `.flow-card-head` navy with a yellow edge, `.flow-card-scroll`, pinned `.flow-card-foot`,
  `.flow-seg` segmented progress), `WelcomeFlow.tsx`, `FlowSteps.tsx`, `stagePolicy.ts`
  (`wantsFullStage`), `flowReducer.ts` (pure, `FlowMode` normal/review/preview).
- **Quiz step** (`quizCheckin.ts`, `quizStepView.ts`, `quizOutcome.ts`, `quizWatcher.ts`) is the
  pattern to follow for the new `assessment` step: pure reducer, time passed in events, escape
  rule tested with a fake clock. Quiz step stays untouched as the fallback.
- **HUD**: `src/features/hud/StudentStage.tsx` top-left group has "Niveles", "Misiones" and the
  settings popover, all `Button variant="surface" size="sm" dense` with `hud-dimmable`. "Entrenar"
  goes in that group. `metrics.compact` already hides the label (`labelClass`) on phones.
- **Audio**: singleton `audioSession` (`features/audio/audioSession.ts`), `prefs.muted` is the
  stored source of truth, and `hold(held)` already pauses the music for the welcome video. Trainer
  and exam audio will use `hold`, not a second mechanism; "restore only if it was playing and not
  muted" needs a small addition (see Open points).
- **API layer**: `course-map/data/client.ts` `apiRequest` (bearer via embed auth hooks, 401 retry
  once after a token refresh, `ApiError`, status 0 = unreachable), `queries.ts` with TanStack
  Query, and a large mock (`mockCourseMapApi.ts`) switched by `VITE_USE_MOCK_API`.
- **Settings**: `MapSettings` in `course-map/data/types.ts:86` with `welcome`, `audio`; the
  editor tabs live in `features/welcome/editor/*`, `features/audio/editor/MusicTab.tsx`,
  `features/view3d/editor/View3dTab.tsx`.
- **Embed bundle budget**: `scripts/check-bundle-budget.mjs`, 350 KB gzipped, counts entry, html
  preloads and `EmbedRoot`, `App`, `MapCanvas` chunks with their static imports. Chunks behind a
  lazy boundary are not counted, which is where the trainer and runner go (pattern:
  `LazyWelcomeFlow.tsx`, `LazyAudioControl.tsx`).
- **Tests**: `node --test` on `src/**/*.test.ts` (no DOM), Playwright with Chromium and WebKit
  against `mock-host/`. Playwright's WebKit is not Safari (`docs/E2E.md`).

### Gaps and conflicts found

1. **No `openapi.json` in the repo** and no OpenAPI codegen dependency. Types will be hand-written
   from contract v2 in one file and checked by a contract test modelled on
   `openapiContract.test.ts` (skips when the file is absent). Swap for generated types when the
   backend lands.
2. **No DOM test library** (no jsdom, no Testing Library) and "no new dependencies". Component
   tests for item types and keyboard paths cannot run under `node --test`. Plan: put all
   behaviour (reorder, match selection, word counting, keyboard model, view state) in pure
   modules tested with `node --test`, and cover the rendered components with Playwright against
   the mock server. Logged here as a deviation from "component tests".
3. **Map nodes launch Moodle activities by URL** (`activityOpener.ts`: new tab or modal). There is
   no in-app node type that opens an app screen. Proposal for the final exam: the trainer home
   card (as briefed) and, optionally, an `assessment` bubble kind later. Not building a node type.
4. **Co-author reminder vs brief.** The tooling suggests a `Co-Authored-By` trailer; the brief and
   the local hook forbid attribution. The brief wins: no trailers, no tool names.
5. **Ambient music restore.** `hold()` is a boolean the video uses. If the trainer and the video
   both hold, a plain boolean can restore too early. Needs a counted or token hold. Will change
   `audioState` minimally and test it.
6. **Preview/editor detection** reaches the flow as `FlowMode 'preview'` and via the host
   capability messages (`protocol.ts`). The trainer's `preview` comes from the server
   (`catalog.preview`, `assessments.preview`); the frontend does not compute it.

### Fonts

Outfit Variable and Figtree Variable are already loaded through `@fontsource-variable`. No font
is added.

## 1. Decisions taken

- (D1) Branch from freshly pulled `main`, per the user. Date 2026-11-17.
- (D2) Design package lives in `docs/design/trainer/` (copied from Downloads by the assistant).
- (D3) Types hand-written until the backend OpenAPI exists; contract test skips without it.
- (D4) Behaviour in pure modules, DOM rendering covered by Playwright (no new test dependency).
- (D5) No attribution lines anywhere, overriding the tooling reminder.

## 2. To be confirmed in writing (client)

- Pass rule "strictly greater than 80 %" and automatic course completion on a pass (verbal).
- Exactly 80 % does not pass under `gt`, although the document labels 80 to 100 "A1 logrado".
- Writing and Speaking proxy rubric needs pedagogical sign-off.
- Retention of assessment records; legal text for the practice notice ("requiere revisión legal").
