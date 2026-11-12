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
| `quiz`    | a Moodle quiz (`cmid`)           | Moodle reports a finished attempt                        |

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
- **Quizzes with a secure window do not work in the viewer.** The editor shows a fixed
  warning when a quiz is linked: use a quiz without the secure-window browser setting.

## Persistence and privacy

Progress lives in Moodle (plugin v5.8) and nowhere in the Rumbos backend. When Moodle
does not keep it (guest, preview, an older plugin, `readonly`, `unavailable`, no answer
within 3 s) the app writes a per-viewer flag to `localStorage`
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
- **Preview** (the editor's "Probar el flujo"): every step open, nothing written, no
  request to the host.

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
- Real Mac (Safari and Chrome) and an iPhone: YouTube and Vimeo ready/play/ended (use
  `?diag=1`), autoplay, fullscreen, the PDF viewer and "Abrir documento".
- The contract against the real `/openapi.json` once it exists.
