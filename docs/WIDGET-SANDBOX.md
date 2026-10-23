# Widget sandbox

A widget is author-written HTML, CSS and JavaScript inside a content bubble. It is
the only place in the app where code written by someone else runs, so it runs in
an environment that can do almost nothing. This page says what that environment
is, why, how it is tested, and what is not covered.

Widgets are off by default. They exist only for tenants whose `GET /auth/me`
answers `features.widgets: true`. If a tenant stops allowing them, an existing
widget bubble shows a neutral message and never runs.

## The sandbox

All of it is built in one function, `src/features/content/widget/sandbox.ts`, and
pinned by `sandbox.test.ts`, which asserts the exact attribute and the full policy
string. A change that loosens either fails a test.

```html
<iframe
  sandbox="allow-scripts"
  srcdoc="..."
  referrerpolicy="no-referrer"
  title="... (contenido interactivo)"
></iframe>
```

- `allow-scripts` and nothing else. No `allow-same-origin`, so the frame keeps an
  opaque origin: it cannot read the app's DOM, `localStorage`, cookies or
  IndexedDB, and the browser treats it as a different site from the app.
- No `allow-forms`, `allow-popups`, `allow-top-navigation`, `allow-modals` or
  `allow-downloads`: no submitting, no new windows, no navigating the page, no
  `alert`/`confirm`, no downloads.

The document it gets starts with this policy, as its first element, so it governs
everything after it, including the author's markup:

```
default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';
img-src data: blob: <assets-origin>; media-src data: blob: <assets-origin>;
font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'
```

(`<assets-origin>` is the origin the app's assets are served from; it is
validated as a plain http(s) origin before it is placed in the policy.) Inline
script and style are allowed because the whole document is the author's; the
policy's job is to stop everything reaching out: no `fetch` or XHR, no other
scripts, images, frames or fonts, no forms, no `<base>`.

## What the widget can ask of the page

`window.rumbos` offers two calls, each a `postMessage` to the parent:

- `close()`: asks the viewer to close.
- `setHeight(px)`: asks for a height, clamped to 120–1600 px.

The wrapper accepts a message only if `event.source` is the frame's own
`contentWindow` and the message has exactly the expected shape (`source:
"rumbos-widget"`, a known `type`, no extra keys, a finite number for the height).
Anything else, however large, is ignored. Accepted messages are also rate-limited
to a handful per second.

## What students see

A visible label, "Contenido interactivo creado por el docente", above the frame; a
`title` on the frame; and the required text alternative, attached to the frame as
its description and shown on request by a "Ver descripción" button. The editor
shows a warning above the widget form (one i18n key,
`content.editor.widgetWarning`; it needs legal review) and a live preview in the
same sandbox.

## The hostile widget

`mock-host/hostile-widget.html` tries, and must fail at, each of: reading the
parent's DOM, `localStorage`, `document.cookie`, `fetch`, XHR, navigating `top`,
opening a window, submitting a form (aimed at `top`), loading a third-party script
and a third-party image, and flooding the parent with 3000 oversized or malformed
messages. `mock-host/widget-test.html` runs it in the exact sandbox the app builds
and checks the answers against secrets it planted in the page (a cookie and a
`localStorage` entry) and that the page did not move.

Run it with `pnpm dev` and open `/mock-host/widget-test.html`. `?loosen` adds
`allow-same-origin` on purpose, as a negative control: the table must then show
the DOM, `localStorage` and cookie reads as ESCAPED. It does, which is what shows
the harness can fail.

### Results

| Browser                             | Result                                                                 |
| ----------------------------------- | ---------------------------------------------------------------------- |
| Chrome 155 on Windows 11            | PASS, every attack blocked; negative control reports the three escapes |
| Firefox, Safari (macOS, iOS)        | not run here                                                           |
| Chrome on Android, Samsung Internet | not run here                                                           |

The flood left the harness responsive (slowest message handler about 40 ms for a
2 MB message), the page stayed put, and Chrome reported six policy violations
inside the frame (the blocked network, script and image attempts).

## What this does not cover

- A widget can still show anything inside its frame, including a fake sign-in
  form (it cannot submit it, but it can ask for a password and a person can type
  one). That is why the label is visible, why the editor warns teachers, and why
  widgets are an opt-in per tenant.
- Browser bugs. The defense is the browser's sandbox and policy; keep browsers
  current.
- CPU and memory. A widget can burn them. Whether its frame runs in a separate
  process from the app depends on the browser and is not something to rely on.
- Audio and video: `media-src` allows only `data:`, `blob:` and the assets
  origin, but no autoplay policy is enforced by the wrapper.
