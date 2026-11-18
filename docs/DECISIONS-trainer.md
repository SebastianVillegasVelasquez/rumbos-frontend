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

## 3. Implementation decisions (Phase A)

- Wire types stay snake_case, as the contract names them.
- Exam copy lives in a sibling dictionary (`assessment.es.ts`) so it loads with the lazy chunk.
- Template blanks are written `{id}` (assumption). The word counter counts the template text plus the blanks.
- A match_audio item takes one item number per clip.
- Submit confirmation is inline, not a modal.
- The check-in step is recorded as done when the attempt ends. An exhausted or passed check-in counts as done; a locked or disabled one does not block.
- Scene icons are placeholders (`data-placeholder`).
- WebKit in this Playwright build cannot play audio: those tests assert the click and the element and are annotated `relaxed`.
- There is no DOM test library; DOM behaviour is covered by Playwright, pure logic by `node --test`.
- Editor panel: `form_id` defaults to `forma_a` (the contract lists no forms). Only English A1 is selectable.

## 4. Known test status

- `welcome-editor.spec.ts:174` ("Probar el flujo ... Guardar") fails on clean main too (Descartar stays after Guardar); not caused by this work.
- `assessment-flow.spec.ts:302` (deadline) failed once in the full run and passed on re-run: timing-sensitive.

## 5. Implementation decisions (Phase C)

- The trainer is one lazy chunk (`TrainerStage`), loaded when "Entrenar" is pressed. Its copy lives in `trainer.es.ts`, beside the chunk.
- "Entrenar" shows when `settings.trainer.enabled` (no extra request for the button). While the welcome flow is `run` or `checking` it is `aria-disabled` with the reason "Se activa al terminar la bienvenida"; pressing it shows the reason as text for 4 s. Editors are never disabled. In practice the flow's curtain already covers the HUD, so the disabled state is only visible in that short window.
- The stage reuses the flow's card classes (`.flow-stage`, `.flow-card`, pinned footer). It is a modal dialog at `z-40`; Esc and "Volver al mapa" always close it; the focus goes to each screen's title and back to the button on close.
- S1 acceptance is remembered per browser in `localStorage` (`rumbos.trainer.accepted.v1`); the server stores nothing about it. Without storage the notice shows each time. The S1 notice and the "what we store" text are marked LEGAL in the copy and need the client's review.
- S4 is a guided dialogue: the partner is a role (never a name, never "IA"); the translation is the authored one, on request; audio only if the line has it.
- Written answers show the closest answer, the authored error tags and a local word diff (LCS over words, punctuation apart). It is a comparison, not a grade; missing and extra words are marked by text as well as shape.
- A failed answer keeps the draft and the same `attempt_id`; there is no offline queue. A double submit is ignored by the reducer.
- A 401 in practice shows a banner ("Tu sesión venció..."); the embed layer already refreshes the token and reports `session_expired` to the host.
- Level aids (translation, starters, word bank, hints, slow audio) are configuration keyed by level (`levelConfig.ts`). Only A1 has content; A2 and B2 are proven with a fixture catalog.
- The final exam launches from the trainer home card ("Evaluación final"), reusing the exam runner inside the stage. The mock treats both purposes with one attempt counter.
- Proposal, not built: the final exam could also appear as a map node. Map nodes only open Moodle URLs (`activityOpener.ts`), so this needs a decision on a new node kind. Until then the entry point is the trainer card.
- For students who cannot hear: the exam's listening items cannot be answered without audio and the transcript is deliberately hidden in the exam. The client must decide the alternative (an accommodation, a transcript on request, or an exemption by the teacher).

## 6. Honest unavailable states and editor errors (branch `fix/training-partial-settings`)

### 6.1 Audit (before the changes)

**The button and the text.**

- Visibility: `App.tsx` showed "Entrenar" whenever `settings.trainer.enabled`, with no request. Enabled or disabled came
  only from the welcome flow (`welcomePending && !isEditor`). `isEditor` there is `viewMode === 'edit'`, and the HUD is
  not drawn in edit mode, so it was always false: editors were held by the flow after all, against the rule in section 5.
- Click: `StudentStage.tsx` opened `TrainerStage` (a lazy chunk) unconditionally when not disabled.
- The text "El entrenamiento no está disponible por ahora." was `esTrainer.unavailable`, shown by `TrainerStage` on two
  paths: catalog `enabled: false` (any reason, no way out but "Volver") and a catalog failure classified `closed` (404, 403,
  409). Every other failure said "No pudimos comprobar tu respuesta." (copy written for answers, wrong for a catalog).
- Paths that reached a dead end: catalog 404/403/409; `enabled: false`; an enabled catalog with no content (it rendered an
  empty home); a failed lazy chunk (offline, or hashes changed by a deploy): `lazy()` throws in render and nothing in the
  stage catches it (in the embed, the global boundary would replace the whole map).

**The payload of the check-in step.** Adding it creates
`{ key, title, mandatory: true, revision: 1, type: "assessment", purpose: "check_in" }`, which matches
`WelcomeAssessmentStep` and the contract's `{ type: "assessment", purpose: "check_in" }`. No drift in the step.
The drift is in the settings: `settings.assessments` is `null` until the author opens "Entrenamiento y evaluación"
and touches it. Adding the step alone therefore sent a flow with a check-in and `assessments: null` (or
`enabled: false`), which is what the backend refuses with `trainer_settings_invalid`. This is the most likely cause of the
reported 422. I could not confirm it against the real backend (I have no access to its answer), only that the editor
allowed that state.

**The message.** `useUpdateAppearance` → `AppearanceStudio` → `describeSaveFailure`. That function has a branch for
`422 welcome_invalid` (with `problems[]`) and falls through to `text.other(status, code)` for everything else, which is
exactly "No se pudo guardar (422, trainer_settings_invalid)".

**Part 3.** No built-in instruction component lists the HUD buttons: the coach marks (`es.coach`) are a first-run tour
(move, bubble, Misiones, audio) and the html step templates ("Reglas", "Acuerdo", "Instrucciones") do not name them.
Nothing was added; the welcome text stays what the author writes.

### 6.2 States of the button and the stage

| Catalog answer                                         | Button (student)                                                                | Button (editor in preview)           | Stage                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------ |
| pending                                                | spinner, `aria-busy`, not pressable; pressing says "Cargando…"                  | same                                 | loading card                                                       |
| `enabled: true`                                        | ready                                                                           | ready                                | home                                                               |
| `enabled: false`, `reason: disabled_for_map` (or none) | hidden                                                                          | disabled, note always visible        | "no está activado en este mapa" (+ how, in preview)                |
| `enabled: false`, `reason: no_published_content`       | disabled; "Pronto habrá ejercicios disponibles" on press and `aria-describedby` | disabled, note always visible        | "Pronto habrá ejercicios disponibles" (+ publish hint in preview)  |
| welcome flow not finished                              | disabled, "Se activa al terminar la bienvenida"                                 | ready (never held by the flow)       | -                                                                  |
| 404, 403, 409                                          | hidden                                                                          | disabled, "desactivado en este mapa" | same as `disabled_for_map`                                         |
| 401                                                    | pressable                                                                       | pressable                            | "Tu sesión venció…" (no retry: the host refreshes the token)       |
| network, 5xx, 429, other                               | pressable; opening the stage retries                                            | same                                 | "No pudimos cargar el entrenamiento" + Reintentar + Volver al mapa |

### 6.3 Decisions

- (D6) One decision function (`trainer/availability.ts`, pure and tested) feeds the button and the stage, and one query key
  (`useCatalog`) is shared, so pressing the button does not ask the server twice (`staleTime` 30 s).
- (D7) `enabled: false` without `reason` (a backend that predates it) is treated as `disabled_for_map`: hidden for
  students. It is the safe reading when the server does not say why.
- (D8) 404/403/409 on the catalog means "no trainer here", not "broken": hidden for students. Only network and server
  failures are errors with a retry.
- (D9) "Editor" in the HUD is `exitPreview !== null` (the app's own preview) or `catalog.preview === true` (the server's
  word; section 0 settled that the server decides preview). The test harness's "editing off" is the host's student mode,
  where only the server's flag identifies the editor.
- (D10) The button is `aria-disabled`, not `disabled`, so it stays focusable and pressing it says why (4 s), as before.
  Playwright treats `aria-disabled` as not actionable; the tests press with `force`, which is what a person does.
- (D11) Editors in preview see which lessons and activities are unpublished through an additive `published?: boolean` on
  the catalog's lessons and activities. ASSUMPTION: the field name, and that `false` means students cannot see it.
- (D12) Editor errors: `errors[].path` is read as the editor's own path (`assessments.check_in.form_id`,
  `welcome.steps[2]`); a leading `settings.` or `body.settings.` and `.2` indexes are normalized. `message_key` is
  translated from a dictionary of ASSUMED keys (`form_not_found`, `assessments_disabled`, `attempts_out_of_range`...).
  An unknown key is shown as "revisa este valor (key)", never hidden, so the first real answer tells us which keys to add.
- (D13) `warnings` are read from the successful response of the settings save (`CourseMapRead.warnings`). ASSUMPTION:
  same shape as `errors`, at the top level of the response. A known key (`content_unpublished`) has its own sentence.
- (D14) A check-in step with the assessments off is caught before the request (`checkTrainingSettings`) and shown in the
  same list. Adding the step switches the assessments on and says so inside the step (blocking would make the author do a
  second step to add a step). If they turn them off later, the step says it cannot be saved and offers to switch them on.
- (D15) The form of each evaluation became an editable text field (default `forma_a`, section 3). There is no catalog of
  forms to choose from, and without a field "el formulario seleccionado no existe" would not be fixable. Replace it with
  a select when the backend lists forms.
- (D16) The mock backend now answers `422 trainer_settings_invalid` with `errors[]`, and a save with `warnings[]`
  (`?mockTrainerUnpublished=1`). It mocks a shape the backend has not published; it is not the contract.
- (D17) A trainer chunk that fails to download (offline, or a deploy changed its hash) is caught by a boundary in
  `LazyTrainerStage`: it says "No pudimos cargar el entrenamiento" with Reintentar and Volver al mapa, and the map
  stays. The failed lazy component is renewed on catch, so a later press loads it. Its copy lives in `es.hud`
  because the trainer dictionary is in the chunk that failed. Tested with the chunk request blocked, in Chromium and
  WebKit; the in-place Reintentar button uses the same remount and has no test of its own.

### 6.4 Test status

- Full Playwright run (Chromium and WebKit, 386 tests): 380 passed, 6 failed. `welcome-editor.spec.ts:174` fails in both
  engines and is the one section 4 records as failing on clean `main`. The other four (three in
  `welcome-quiz-checkin`, one WebKit `welcome-flow-visual` at 768) passed on a rerun of those files: load flakes of a
  4-worker run.

## Catalog contract at the edge

- The crash ("reading 'find'" of undefined, in `FinalCard`) came from `GET /trainer/assessments`
  answering `{ enabled: false }` with no `items`, not from the catalog. It needed an enabled
  catalog to reach the home screen, so it showed with the third answer only.
- `parseCatalog` and `parseAssessmentList` check the response in the API client and raise
  `ContractError` (endpoint + fields) instead of letting a wrong shape reach a render. A disabled
  assessment list leaves with `items: []`; its type no longer promises a policy.
- An enabled catalog with no lessons (flat or nested) is `no_content`, for the button and the stage.
- **Open drift, not fixed here:** the backend nests lessons and activities under `modules[]`, names
  `language` by code, and has `state`/`best_percent` where the code reads `completed_count`/
  `best_score`/`locked`. The screens still read the flat shape, so with real data the lesson list
  is empty. No `openapi.json` is in the repo to compare against.
