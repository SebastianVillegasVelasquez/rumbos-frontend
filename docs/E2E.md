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
