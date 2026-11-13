# Browser tests (Playwright)

`pnpm test:e2e` runs `e2e/*.spec.ts` in Chromium and WebKit. Playwright is a
devDependency, used only here; it never reaches the bundle. First run on a
machine: `pnpm exec playwright install chromium webkit` (about 150 MB).

The runner starts its own dev server on port 5174 with `VITE_USE_MOCK_API=true`
(it reuses one that is already up when not in CI) and drives the mock host, so
the app runs embedded, exactly as inside Moodle.

## What they check

`e2e/video-box.spec.ts` measures the welcome video panel (the iframe's parent)
and the video iframe in every cell of a matrix and fails when either is under
280x158, or when the panel's aspect ratio leaves 16:9 by more than 2 %:

- 8 viewports (1024x600, 1280x650, 1280x720, 1440x800, 1512x860, 1728x1000,
  768x1024, 360x640) at zoom 100, 125 and 150 % (the phone viewport at 100 % only);
- the Moodle iframe heights 500, 600 and 700, a phone in landscape (667x375) and
  the shortest iframes the site minimum allows (300 and 200);
- host fullscreen at every viewport;
- before the click (the curtain offers "Reproducir" and has no panel), after the
  click, and after the optional "Ver video de bienvenida" button;
- with a stand-in provider (a 300x150 intrinsic page, a page asking for 2400 px of
  height) and with the provider blocked.

Also covered: the curtain scrolls instead of squeezing, there is no "Ampliar video"
button, "Empezar viaje" is visible and reachable by keyboard at 360x640
(video loading, loaded and blocked), the load-failure message, `?debug=layout`
and `?diag=1` (which must make no request).

## The curtain's music control

`e2e/curtain-music.spec.ts` runs in both engines against the real audio session. Autoplay
policies make real playback unreliable in CI, so `e2e/audioStub.ts` stubs the media
element (`play`, `pause`, `load`, `paused`, `src`): a test asserts what the session asked
the element to do, not what a browser would let through. It covers: a click on the switch
does not start the music, off stays off at the button, on starts at the button, the disc
and the title are one switch, Space and Enter, the video hold and its release on skip,
switching while music plays, the HUD control agreeing afterwards, and a click that
arrives before the lazy audio chunk.

## The flow corrections

`e2e/welcome-flow-corrections.spec.ts` (solid segments in every state, card widths at 1280,
1366, 1920, 768 and 360), `e2e/welcome-music-real.spec.ts` (the flow's switch with a real
`<audio>`, a WAV and an MP3 made in `e2e/audioFixture.ts`, and the editor preview) and
`e2e/welcome-video-fullscreen.spec.ts` (a stubbed player.vimeo.com that requests
fullscreen; student and preview). Where an engine cannot decode audio the music spec says so
in a `relaxed` annotation.

## How the cells are made

- The host's iframe is sized so the app's own viewport is exactly the cell. A zoom
  of z is the cell divided by z (the browser shows the app a smaller viewport);
  device pixel ratio does not change CSS layout, so it is not varied.
- The provider is stood in for by `context.route`: a page fulfilled at the
  provider's own origin (so the curtain's origin checks stay real) or an aborted
  request.

## What they cannot tell you

**Playwright's WebKit is not Safari.** It is the WebKit engine without Safari's
codecs, autoplay policy, intelligent tracking prevention, fullscreen behavior or
its release schedule. It is good for CSS and layout, and says nothing about those.
They stay on the hand-test list (docs/EMBED.md, "The welcome video box").

Known engine difference seen here: Chromium fires an iframe's `load` event for
its own error page (a blocked provider looks loaded); this WebKit does not, so the
"No pudimos cargar el video." message only shows there.

## CI (proposal, not enabled)

Not part of the required checks yet. Proposal for a separate job, run on pull
requests that touch `src/**`, `e2e/**` or `index.html`:

- `pnpm install --frozen-lockfile`, then
  `pnpm exec playwright install --with-deps chromium webkit`;
- cache `~/.cache/ms-playwright` keyed on the Playwright version in `pnpm-lock.yaml`
  (the browsers are about 150 MB; a warm cache makes the install a few seconds);
- `pnpm test:e2e`: about 2 minutes locally for both engines;
- start as non-blocking, and make it required once it has run clean for a while.

## Welcome flow

`e2e/welcome-flow.spec.ts` and `e2e/welcome-flow-more.spec.ts` (Chromium and WebKit) run the
real player, reducer, persistence and host messages against the mock host, which plays the
plugin v5.8 side. Only the media element and the provider pages are stubbed. They use
`?mockStableIds=1` (map ids from a counter) so a reload is the same map; progress is keyed
by map id. `?mockWelcomeJson=<url-encoded MapWelcome>` loads any flow without the editor.

Covered: every step type and its gating; the host log; review mode writes nothing; a changed
`revision` and a step added later are asked alone; the local flag for `readonly` and a silent
host; a guest is memory only; the video way out (provider blocked: not before 10 s, then it
appears and records `fallback`; player ready: never; player error: at once; option off:
never); the quiz outcomes (passed, failed, hidden grade, pending grading, not found,
unavailable, no permission, silent host after 6 s); reduced motion; the fullscreen button;
controls inside the frame at 360x640, 640x360, 768x1024, 1024x768, 1280x720, 1920x1080.
`e2e/welcome-editor.spec.ts` covers the editor, `e2e/diag-probe.spec.ts` the video probe.

`e2e/welcome-flow-layout.spec.ts` checks the flow at 14 window sizes and text scales (320 to
1920 px wide, a phone in landscape, 130% and 200% text) with a long title: no sideways scroll,
the card never taller than the window, the primary action inside the window and at least
44 px tall. `e2e/welcome-flow-visual.spec.ts` keeps screenshot baselines of the five step
types at 1366, 768 and 412 px in both engines (`e2e/__screenshots__/<spec>/<engine>/`; the
path has no operating system, and 3% of pixels may differ). After an intended visual change
run `pnpm exec playwright test e2e/welcome-flow-visual.spec.ts --update-snapshots` and look
at the pictures before committing them. `src/features/welcome/flow/flowContrast.test.ts`
computes the contrast of the flow from the tokens.

### What these do not cover

Playwright's WebKit is not Safari: no codecs, no real autoplay policy, no real fullscreen,
no ITP. The YouTube and Vimeo pages are replaced by pages that post the events, so the real
providers' events are untested. The PDF viewer is not exercised (no PDF engine in CI).

### By hand, in a real Moodle (plugin v5.8)

- A student: the flow shows, each step gates, the completions are in Moodle, the flow does not
  come back, and it does after "Pedir de nuevo".
- A guest and "log in as": nothing is kept; the flow comes back on the next visit.
- A quiz attempt finished inside the overlay: the result appears after the overlay closes
  (the race the watcher covers). Also a hidden quiz, a restricted quiz, a hidden grade, and
  a quiz with a secure window (it must not be linkable in practice).
- Editor: "Reiniciar mi progreso" with editing mode on and off.
- 30 writes a minute: finish a 12-step flow quickly and check nothing is lost.

### By hand, on a real Mac (Safari and Chrome) and an iPhone

- Open `?diag=1`, "Probar eventos de video" with a YouTube id and a Vimeo id: the log must show
  ready, play, pause and ended. Copy it ("Copiar registro") and keep it.
- A video step: autoplay after the click, fullscreen, ended completes the step, and with the
  network blocked the way out appears after 10 s.
- The PDF step: the embedded viewer (needs `/assets` to allow framing) and "Abrir documento".
- Reduced motion on in the system settings.
- Look at the flow in fullscreen and inline: the card is centered and never taller than the
  window, the primary action is always visible, and the step transition is a short fade and
  slide (none with reduced motion on).
- iPhone Safari: the card against the home indicator and the notch, the address bar growing
  and shrinking (`dvh`), the music switch (first tap starts the music), the video poster and
  the player's own fullscreen. A mid-range Android Chrome: the same, and scroll performance
  of the card.
- A very long course name in the title; browser zoom 200% and 400%; large text in the system
  settings; forced colors (Windows high contrast) and "increase contrast".
- In the real Moodle as a student, a guest and a teacher, with the course's iframe height set
  to auto, viewport, 500, 600 and 700: the stage fills the iframe, the card centers in it and
  scrolls inside when short.
