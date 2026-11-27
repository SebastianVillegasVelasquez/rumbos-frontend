# Welcome flow

A welcome flow is a short sequence of steps a student goes through when they first
open a map: a welcome message, a video, a piece of HTML (rules, an agreement), a PDF
and a Moodle quiz. It replaces the single welcome curtain when a map has `steps`;
maps without steps keep the legacy curtain untouched.

This document is the reference for what the app does, what it assumes about Moodle,
and what must be checked by hand. Decisions and their reasons are in
[`DECISIONS-hud.md`](DECISIONS-hud.md); the wire messages are in
[`EMBED.md`](EMBED.md) (contract v5.8).

## Steps

| Type      | Content                          | Completes when                                           |
| --------- | -------------------------------- | -------------------------------------------------------- |
| `welcome` | title, message, button label     | the student presses the button                           |
| `video`   | YouTube or Vimeo                 | the player reports `ended`, or the fallback exit is used |
| `html`    | author HTML and CSS, sandboxed   | minimum seconds elapsed and, if set, the box is checked  |
| `pdf`     | an uploaded document (`/assets`) | the student continues (the document is not tracked)      |
| `quiz`    | a Moodle quiz (`cmid`)           | Moodle reports a finished attempt, or a recorded exit    |

Each step has a `key` (`[A-Za-z0-9_-]{1,16}`), a `revision` (0..1000000) and a
`mandatory` flag. Raising the `revision` asks everyone who completed the step before
to complete it again ("Pedir de nuevo a quienes ya lo completaron").

### "Obligatorio" is not a lock

A mandatory step gates the flow in the app: Continue stays disabled, with the reason in
visible text, until the step is done. It is not access control. Moodle's own
restrictions are the only real lock; a student who closes the tab skips the flow, and
the app never blocks the course itself. Do not use the flow to enforce a legal
requirement.

## Video

Nothing is requested from the provider until the student presses play. "¿Problemas con
el video?" appears only when no start signal (ready or play) arrives within
`VIDEO_LOAD_TIMEOUT_MS` (10 s, `videoPlayer.ts`) of the click, or the player reports an
error. A video that plays for a long time never shows it. With working events the only
way to complete a mandatory video is `ended`. If events never arrive, the exit records
the method `fallback`; the editor warns that `allowFallback` lets a student past the
video.

To check a real browser, open the app with `?diag=1` and use "Probar eventos de video":
it loads the real player after a click and logs the messages it sends, with a "Copiar
registro" button.

## HTML

The content runs in a frame with `sandbox="allow-popups allow-popups-to-escape-sandbox"`
and a CSP of `script-src 'none'`: no scripts, no forms, no same-origin access. Images
come from `data:` or the Rumbos assets origin only. The client-side check of the HTML
and CSS rules (`htmlCheck.ts`) is a convenience for the editor, not a security
boundary: the sandbox and the server validation are.

## PDF

The document is shown in an embedded viewer with an always-present "Abrir documento"
button (a new tab).

**Framing requirement.** The inline viewer frames `/assets/<id>`. The backend must
allow that: `Content-Security-Policy: frame-ancestors` has to list the app origin and
the Moodle origin. If `/assets` forbids framing, the viewer stays blank and "Abrir
documento" is the only way to read the document. The step still works: it never depends
on the viewer. A document that is missing (`available: false`) is non-blocking and
records `unavailable`.

## Quiz

The app never reads grades from the backend. It asks Moodle (through the host) for the
viewer's result and shows it. The result is asked when the step opens, when the host
overlay closes, on every new `host-state`, and when the tab becomes visible, because the
host closes its overlay before it refreshes its state and an attempt ending inside the
overlay is only visible after that. Asks are coalesced (800 ms apart at most).

- With the grade hidden in Moodle, `percent` and `passedThreshold` arrive null: the
  result is neutral ("hay un intento terminado") and counts as done.
- `not_found` also covers a hidden activity. A quiz that is hidden, restricted, missing
  or unlinked does not block; the step records `unavailable`.
- If the host never answers (an older plugin) the step stops waiting after 6 s and
  records `unavailable`.
- **Quizzes with a secure window open in a separate window.** The editor shows a fixed
  notice on every quiz step: "Los cuestionarios con ventana segura se abren en una ventana
  aparte; permite las ventanas emergentes." (It used to say they do not work.)

### The step is never a trap

A mandatory step is a convention, not a lock: every cause that can keep a viewer on the
quiz step has a recorded way out. What the step says and how it records depends on the
answer (`quizOutcome.ts`; `reason` wins, the counts decide when it is absent):

| Answer                                               | Shows                                        | Records                                              |
| ---------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------- |
| `ok`, or a finished attempt (no reason)              | success, percent, the author's outcome text  | `completed`                                          |
| `no_attempts`                                        | open the quiz, answer it, send it, come back | waits                                                |
| `in_progress`, or an open attempt (no reason)        | "Tienes un intento sin enviar..."            | waits                                                |
| `preview_only`, `cannot_attempt`, `canAttempt:false` | "Tu cuenta no es de estudiante..."           | `fallback`                                           |
| `not_graded_yet`                                     | "pendiente de calificación"                  | `completed` with a finished attempt, else `fallback` |
| nothing known (an older plugin, 0 finished)          | "Todavía no vemos un intento terminado..."   | waits                                                |
| an error reply, or no reply                          | "Puedes continuar"                           | `unavailable`                                        |

- **"Comprobar de nuevo" always visibly does something.** Every check (the button, the
  overlay closing, a fresh host state, the window regaining focus) shows "Comprobando…",
  then "Última comprobación: hace unos segundos: 0 intentos finalizados", also when the
  answer did not change. The button is disabled only while a request is out; nothing
  answering within 5 s says so and gives it back. The line is `aria-live="polite"`.
- **Re-checks.** On the overlay closing (once) and on each fresh host state, 800 ms apart
  at most; on window focus at most once every 10 s.
- **"Continuar de todos modos"** records `fallback` through `flow-step-done` and moves on,
  with the line "El resultado no se registrará como completado." It appears after the
  viewer opened the quiz and two checks in a row did not confirm completion (answers
  within 3 s count as one look), or 45 s after they first opened it, or at once after an
  error or a missing reply. It is not shown before that, so it does not become a shortcut,
  and it arrives inside a live region and next in the tab order.
- **The editing role never blocks on this step** (`host-init.role === 'editor'`, whether
  or not Moodle's editing mode is on). It records `fallback` unless the quiz is done.

## Where the flow shows

While a flow is mandatory and unfinished inside the host, it asks for the host's full
stage (`request-fullscreen`) when it opens and gives it back when it ends: the height of
the inline frame is the plugin's, not the app's. A preview, a review and a flow with
nothing mandatory stay inline; the viewer can leave the stage with the host's exit
control and the flow does not pull them back in. The video is sized by width first (the
card's content width at 16:9) and the card scrolls inside itself, so a short window never
shrinks it.

## Persistence and privacy

Progress lives in Moodle (plugin v5.8) and nowhere in the Rumbos backend. A guest or a
preview (`persistent: false`) is kept in memory only: nothing is stored, so the flow comes
back on the next visit. When Moodle cannot keep it (an older plugin, `readonly`,
`unavailable`, no answer within 3 s) the app writes a per-viewer flag to `localStorage`
(`rumbos.welcome.flow.<mapId>.<stepKey>.<revision>`) holding only the method
(`completed`, `fallback`, `unavailable`). No grade, attempt count or timestamp is
stored.

Nothing about progress, completion or quiz results goes to the backend, to logs, or to
error reports. `privacy.test.ts` enforces it: a source scan of every flow module
(no API client, `fetch`, beacon, console, error reporting) and a full run with the
network and console watched.

Writes to Moodle are capped at 28 a minute (the plugin allows 30 per user); the queue
sends at once under that cap, retries with growing delays (3 s up to 60 s), gives up
after six attempts, and never loops. A failure never blocks the viewer.

## Modes

- **Normal**: gating and recording.
- **Review** (`show: always` after finishing): every step open, nothing written.
- **Preview** (the editor's "Probar el flujo" and "Vista previa"): every step open, nothing
  written. See below for exactly what it does.

### What "Probar el flujo" does and does not do

It plays the flow being edited, saved or not, in the real player.

It **does**:

- show every step as it is: the welcome step, video, HTML and PDF are drawn and loaded for
  real (a video that is played is played by its provider, which counts the view as any visit);
- let you move through every step, whatever is mandatory, and leave with "Saltar vista previa";
- ask the host for reads: for an activity step it asks for the course's activity list, to
  show which activity the step points at.

It **does not**:

- keep any progress (no `flow-step-done`, nothing in `localStorage`);
- create an exam attempt, or even read the assessments list: the exam step has no "Empezar",
  it only says that results are tried in "Simular recorrido";
- open a Moodle activity or quiz, or ask for a quiz result: those steps show "En la
  simulación no se abre la actividad".

The one exception is a button the editor has to press: **"Abrir de verdad (registra una vista
en tu cuenta de editor)"** opens the activity or quiz through the host, as a student's button
would. Moodle then records that view on the editor's own account.

The same rules hold for the whole of "Vista previa", including a bubble opened from the map
(a notice with that same button) and the flows "Simular recorrido" plays.

## Simular recorrido

The only simulator. It is a panel over the student view, offered to an **editor in "Vista
previa" with Moodle editing on**, when the map has a closing flow or a welcome check-in. An
editor with editing off is a student to the app: no panel, and their real flow records are
saved. Tip for editors: «Para probar, usa Vista previa con la edición activada.» Everything is in memory (`assessment/journeySimulation.ts`); leaving the preview or the
level ends it.

1. "Empezar simulación" plays the welcome flow. A map without a check-in step gets one added
   for the simulation, and the panel says so. The exam step takes a simulated result: pass,
   not pass, or exactly on the threshold. Threshold and operator are the map's
   (`settings.assessments`, 80 % strictly above when unset).
2. **Passed:** the congratulations, then the closing without the final exam. A closing that holds only
   the final is skipped: the congratulations, then the map.
3. **Not passed:** the map with the route-instructions card. "Simular todas las actividades
   completadas" draws every activity bubble as done and brings the closing card; the closing
   then has the final exam.
4. A final attempt is taken on the exam step or from the panel; both count on the same
   counter. A failure says which attempt it was and how many are left; the last one shows the
   "attempts spent" screen; a pass shows the final's congratulations.
5. "Reiniciar simulación" closes whatever is open and forgets every result and attempt.

The backend has no way to force a pass, and the simulator needs none. Tests:
`journeySimulation.test.ts` and `e2e/journey-simulation.spec.ts`, which asserts that a full
run makes no request but GETs and sends the host nothing but reads.

The route card and the two failure messages are Rumbos' copy (`assessment/journeyTexts.ts`):
the contract declares no map setting for them yet.

## Resetting your own progress

The editor's settings popover has "Reiniciar mi progreso de bienvenida". Moodle only
allows it with **editing mode on**; otherwise the host answers `readonly` and the app
says so. The help text next to the button explains this.

## Plugin v5.8 facts the app relies on

- `completedAt` is ISO-8601 UTC.
- `stepKey` matches `[A-Za-z0-9_-]{1,16}` and `revision` is 0..1000000.
- Hidden grade: `percent` and `passedThreshold` are null.
- `not_found` also covers hidden activities.
- 30 writes a minute per user.

## Assumptions (no backend exists yet)

Everything on the Rumbos API side is built to the brief. `openapiContract.test.ts`
reads a local `openapi.json` (env `OPENAPI_JSON`, default `openapi.json`) and checks the
fields this feature uses; it is skipped when the file is absent. The mock backend
(`?mockWelcome=...`, `?mockWelcomeJson=...`) stands in meanwhile. One assumed value: the
PDF page limit (200).

## Hand tests (cannot be automated here)

- Real Moodle: a student, a guest, "log in as", a quiz attempt finished inside the
  overlay, a hidden quiz, grade hidden.
- The check-in step, inside the real Moodle and on a real Mac in Chrome and Safari:
  1. A non-student account (a teacher or a manager, with editing mode on and off): the step
     must not block, and the progress must be recorded as `fallback`.
  2. A student with an unsent attempt: "Tienes un intento sin enviar", then send it from the
     overlay and see the step unlock without pressing anything.
  3. A student who finishes: the result and "Continuar", recorded as `completed`.
  4. A student who opens the quiz and comes back without finishing: "Continuar de todos
     modos" appears after two checks or 45 s and records `fallback`.
  5. The host honors `request-fullscreen` when the flow opens without a click, and the video
     is at least 560 px wide on a laptop window.
- Real Mac (Safari and Chrome) and an iPhone: YouTube and Vimeo ready/play/ended (use
  `?diag=1`), autoplay, fullscreen, the PDF viewer and "Abrir documento".
- Fullscreen from the real Vimeo/YouTube player: Chrome on Windows and a Mac (Safari and
  Chrome), an iPhone, inside real Moodle, in the student view and in the editor preview, with
  the flow inline and with the host's own "Pantalla completa". Open the app with `?diag=1`
  first: the panel now lists fullscreenEnabled, the Permissions Policy answer, the video
  frame's allow/allowfullscreen/sandbox and any inert or pointer-blocked ancestor. In
  Vimeo's small player the fullscreen button hides under the chevron ("Show controls").
- Music: the switch on the welcome step and the HUD control with a real MP3 on a Mac, an
  iPhone and inside Moodle (autoplay policy and iOS gestures are not reproducible in CI);
  the editor preview's switch answers but plays nothing, by design.
- The contract against the real `/openapi.json` once it exists.

## The editor

The studio tab "Flujo de bienvenida" (replacing "Bienvenida" on a backend with flows):

- Add, duplicate, delete and move steps with buttons (so the keyboard works). The
  welcome step is always first and unique; at most 12 steps and 3 quizzes.
- A form per type. HTML has starter templates (Reglas, Acuerdo, Instrucciones) and a live
  preview in the same sandboxed frame students get. PDF needs the rights declaration and
  warns about confidentiality. The quiz picker lists the course quizzes, has a
  "Sin vincular" state, and always shows the secure-window warning.
- "Pedir de nuevo a quienes ya lo completaron" raises the step revision.
- "Probar el flujo" runs the player in preview mode (see "What "Probar el flujo" does and
  does not do").
- Problems found by the client mirror of the backend validation are shown by step and
  block nothing by themselves; the backend answer wins.
- "Reiniciar mi progreso de bienvenida" (inside Moodle only) resets the editor's own
  progress, and only works with Moodle editing mode on.

## Closing flow (draft, not in the contract yet)

A second guided flow, shown when the student finishes the level, built from the same steps, the
same player (`WelcomeFlow` with `flowKey: "closing"`) and the same editor (`FlowTab` with
`flowKey: "closing"`, including add, remove and reorder) as the welcome flow. Nothing is
duplicated: only what differs lives in a table (`STEP_TYPES_BY_FLOW`, `PURPOSE_BY_FLOW`) and in the
copy.

- **Steps:** authored HTML (`html`, as the welcome flow's) and `assessment` with `purpose: "final"`.
  The welcome flow keeps `check_in` only. The gate is the same as step 5: completing the attempt
  opens "Terminar", passing is not required; a pass in either exam shows "Ya aprobaste".
- **Entry:** students have no button. The journey brings them (see "Where a student is on every load"). Only an
  editor looking at the student view has the "Cierre" button in the HUD, which opens the flow in preview.
- **Final-assessment step states** (the same component as the check-in, with the final exam's words):

  | State                                             | Says                                                                                                         | "Terminar"            |
  | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------- |
  | loading                                           | "Comprobando…" (`aria-busy`)                                                                                 | closed                |
  | available / in progress (resumes from the server) | invitation, "Empezar" or "Continuar la evaluación"                                                           | closed                |
  | submitted (any result)                            | "Evaluación entregada."                                                                                      | open                  |
  | already passed                                    | "Ya aprobaste." and "No necesitas hacer esta evaluación."                                                    | open                  |
  | attempts exhausted                                | "Ya usaste todos los intentos de la evaluación final."                                                       | open                  |
  | not available (reason)                            | the reason as a sentence, plus the recorded escape                                                           | open after the escape |
  | network / server error                            | "No pudimos cargar la evaluación." and Reintentar                                                            | closed                |
  | guard (`closing_not_available`, 409 or 403)       | "El cierre todavía no está disponible para ti…", only "Volver" (no retry); the step looks the state up again | closed                |

  A test fails when a state, a reason or a failure has no translation (`stepStates.test.ts`).

- **Preview:** an editor's attempt is labelled "Vista previa: este intento no se guarda ni cuenta." (banner in the
  runner, note on the step) and its result carries "Esto es una vista previa: no es el resultado de un estudiante."
  That is the backend's preview (`preview` on the assessments list). In "Vista previa" and "Probar el flujo" the exam is
  not reached at all, and "Simular recorrido" never talks to the backend.
- **Editor:** the final-assessment step says "Este paso se desbloquea cuando el estudiante completa todos los
  contenidos SCORM." The final exam is no longer in Entrenar.
- **Draft shapes** (`MapClosing`, `settings.closing` and the `closing_not_available` guard): the mock API gives a map a
  closing flow with `?mockClosingJson=`. The browser tests serve `GET /trainer/closing` themselves, checked against
  `contracts/openapi.json` (`e2e/closingStatus.ts`). The "Cierre" editor tab shows only when the backend sends the
  `closing` key.
- **Progress record:** each mandatory closing step is reported to the host (`flow-step-done`, the same table as the
  welcome flow; step keys are unique across both), so the flow resumes where Moodle says.
- **Deploy order:** backend first, with `CLOSING_GATE_MODE=observe` or `enforce`. With the gate `off` the status
  has no `outcome`, so no student is offered the closing flow.
- **Where the final exam comes from:** with the gate on, the backend leaves the final out of
  `GET /trainer/assessments`; the final step then takes its item from `GET /trainer/closing` and decides from
  `outcome.final.status`, never from the item's `state` (`assessment/finalOffer.ts`).

### Where a student is on every load

Worked out again on each load (`assessment/closingResume.ts`) from `GET /trainer/closing` and the closing steps'
records in Moodle. The client never compares a score. It counts activities only in `observe` mode (below). This
table is for `enforce`, where the server decides. Rows are read from the top.

| `outcome.final.status`           | Closing steps in Moodle        | The student sees                                                   |
| -------------------------------- | ------------------------------ | ------------------------------------------------------------------ |
| `exhausted`                      | any                            | the attempts-spent screen, once on every load                      |
| `passed`                         | any                            | the final's congratulations once, then the map with no prompt      |
| `not_required_passed_checkin`    | none, congratulations not read | the congratulations; their button opens the flow without the final |
| `not_required_passed_checkin`    | none, congratulations read     | the "Continuar al cierre" card                                     |
| `not_required_passed_checkin`    | some                           | the flow, resumed on the first pending step                        |
| `not_required_passed_checkin`    | all                            | the map, no prompt                                                 |
| `required` and `available`       | none                           | the card (never opened over the map)                               |
| `required` and `available`       | some                           | the flow, resumed on the first pending step                        |
| `required` and `available`       | all (the final was not passed) | the card; the flow opens on the final exam                         |
| `locked` [1]                     | any                            | the map with the route-instructions card, closable for the visit   |
| any other `locked`, no `outcome` | any                            | the map, no prompt, no reason code                                 |
| no answer                        | any                            | the map, no prompt                                                 |

With `not_required_passed_checkin` and a closing that holds only the final, no step is left: the congratulations
(until read in this browser, since Moodle never gets a closing record), then the map. No card, no flow, no final.

[1] `reason: scorm_incomplete` with the check-in `not_passed`: content is all that stands between the student and the
final exam. A student who has not sat the check-in (`not_taken`) is told nothing.

While Moodle has not answered, the first two rows apply and nothing else is shown. A deep link carries no closing
route: it reads as any other load. While the flow or a journey screen is up, the level's self-opening content and the
first-run guide wait.

Tests: `closingResume.test.ts` and `e2e/closing-resume.spec.ts` (Chromium and WebKit).

### In `observe` mode (`scorm_gate.reason: not_checked`)

The server does not check the content: it can report the final as `required` and available before the student has
done anything. The app then waits, in this order, before it offers or reopens the closing with the final: the
check-in is taken (where the map has one), and every required visible bubble is complete in the plugin's progress.
"Required visible" is the count of the map's progress bar for a student: content bubbles and hidden, missing or
untracked activities do not count. **This is what the screen shows, not a control:** a direct call to the backend
can still start the final.

| the student                         | content    | closing steps in Moodle | sees                                       |
| ----------------------------------- | ---------- | ----------------------- | ------------------------------------------ |
| check-in not taken                  | any        | any                     | the map                                    |
| plugin's progress not known yet     | unknown    | any                     | the map                                    |
| check-in not passed                 | incomplete | any                     | the route-instructions card                |
| a map without a check-in            | incomplete | any                     | the map                                    |
| check-in not passed, or no check-in | complete   | none, or all            | the "Continuar al cierre" card             |
| check-in not passed, or no check-in | complete   | some                    | the flow, resumed                          |
| check-in passed                     | any        | none                    | the congratulations, again on a new visit  |
| check-in passed                     | any        | some / all              | the flow resumed / the map. **Never card** |
| final passed, or attempts spent     | any        | any                     | as in `enforce`                            |

With the gate `off` there is no `outcome`, and nothing of this applies: the app behaves as before.

### The journey's texts

The editor (Entrenamiento tab) writes the congratulations and three more texts: `failure` (after a failed final;
its button label names the button that leaves the result), `exhausted` and `routeInstructions`. Each field left
empty is Rumbos' copy. Plain text. `failure` takes `{attempt}`, `{attempts_max}`, `{attempts_left}` and
`{threshold}`; the other two take none. The congratulations take `{score}` and `{threshold}`, each exam its own
(`outcome.checkin` or `outcome.final`). A field is offered only if the backend's map has the key.
