# 3D world: audit of the delivered folder

Source: `~/Downloads/3d` (the `Descargas/3d` folder handed over by management).
Everything below was checked against the real files; the "hypothesis" column
is what we were told secondhand.

## 1. What is really in the folder

| Item                                                                                                                                     | Verdict                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Region of Encounters 3D v8.html` is the valid version (~2,270 lines, `<script type="module">`, three.js 0.184 from unpkg via importmap) | **Confirmed.** 2,274 lines / 372 KB. One inline module script (lines 163-2272). three.js is pinned to `0.184.0` with SRI hashes.                                                                                                                                                                                                                                                                                     |
| v2-v7 are earlier iterations                                                                                                             | Confirmed, not imported. Also present: `Region of Encounters 3D.html`, `... Map.dc.html`, `Region de los Encuentros (offline).html` (2.6 MB), `uploads/Tablero-...offline vf 23 julio.html` (3.2 MB). Not used.                                                                                                                                                                                                      |
| World is procedural, no `.glb`                                                                                                           | **Confirmed.** Terrain, coast, rivers, roads, bridges, houses, boats, people, animals, trees are built from three.js primitives in code.                                                                                                                                                                                                                                                                             |
| 8 watercolor textures `textures/*.webp` (~5 MB)                                                                                          | **Partly wrong.** 8 textures exist, but the `.webp` set is **~0.6 MB**, not 5 MB (the `.png` twins are ~4.8 MB and v8 never loads them).                                                                                                                                                                                                                                                                             |
| Sprites in `assets/recursos/` (`pc_*.webp`, png icons)                                                                                   | **Partly wrong.** v8 loads only **8 `pc_*.webp` "postcards"** (`calle, valle, isla, embalse, pueblo, rio, bote, playa`), placed as framed boards inside the world. The 19 png icons (`ave`, `tucan`, ...) are dead code: `sticker()` starts with `return;`. `pc_caminante.webp` is not loaded either.                                                                                                                |
| 9 zones with hardcoded coordinates (`Z = {0..8}`), one pin per zone                                                                      | **Confirmed** (line 352). `Z = {1:[-17,17], 2:[22,-26], 3:[28,12], 4:[-4,46], 5:[4,-4], 6:[-30,-10], 7:[36,-8], 8:[10,32], 0:[34,44]}`. Each zone also has a color (`zoneColor`, line 264) and a radius (`ZR`, line 394). Pins are created by `hotspot(n, ...)` (line 620) into the `hotspots[]` array.                                                                                                              |
| Each point has title, description, image; ES/EN                                                                                          | **Partly wrong.** Built-in text (`INFO`, line 1527) is **Spanish only**: tag, subtitle, eyebrow, title, place, description and a list of "facts". The English fields are empty strings; English only exists for the UI chrome (`UI`, line 1645). **No point has a built-in image** (`info.img` is only filled by the admin editor).                                                                                  |
| Points come from JSON, `localStorage` or Moodle                                                                                          | Confirmed (`puntos-region.json` via `?datos=`, `roe_points_draft_v1`, Moodle web service). `puntos-region.json` is **not** in the folder.                                                                                                                                                                                                                                                                            |
| Own admin system (login, editor, drafts, Moodle publishing, token in `localStorage`)                                                     | **Confirmed**, see section 4.                                                                                                                                                                                                                                                                                                                                                                                        |
| IBM Plex fonts and own CSS                                                                                                               | Confirmed (Google Fonts `<link>`, line 24).                                                                                                                                                                                                                                                                                                                                                                          |
| `support.js` not needed                                                                                                                  | Confirmed: not referenced by v8.                                                                                                                                                                                                                                                                                                                                                                                     |
| `three-d-stage.js`: check what v8 imports                                                                                                | **Wrong that it is optional.** v8 is built on it: `<three-d-stage>` creates the WebGL renderer, lights, ground, `OrbitControls`, resize handling and the render loop. v8 uses `stage.ready`, `stage.setObject`, `stage._scene`, `_renderer`, `_camera`, `_controls`, `_key`, `_ground`, `_toolbar` and `shadowRoot`. We keep the file (as a module) and cut what v8 does not need (export toolbar, note, telemetry). |
| `scratch/`, `screenshots/`, `exports/*.mp4` not needed                                                                                   | Confirmed (22, 257 and 1 files). `uploads/` (~106 MB of reference images) and `vendor/three/` (a local copy of three 0.184.0 plus the OBJ/GLTF exporters) were not mentioned and are not imported.                                                                                                                                                                                                                   |

## 2. three.js version

`0.184.0` (importmap, `vendor/three/three.core.js` has `REVISION = '184'`).
`three@0.184.0` exists on npm, so we pin exactly that.

## 3. External network requests made by the delivered page

| Where                | Request                                                                                         | Disposition                                   |
| -------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------- |
| line 7-23            | `https://unpkg.com/three@0.184.0/...` (5 files: core, OrbitControls, OBJExporter, GLTFExporter) | Removed: three comes from npm and is bundled. |
| line 24              | `https://fonts.googleapis.com/css2?...IBM Plex...` (and `fonts.gstatic.com` woff2 behind it)    | Removed: fonts are self-hosted.               |
| line 1684            | `POST {c.site}/webservice/rest/server.php` (Moodle, user-configured, carries `wstoken`)         | Removed with the admin.                       |
| line 1695            | `GET puntos-region.json` (or `?datos=<any URL>`)                                                | Removed: points arrive through `setPoints`.   |
| stage `notifyExport` | `window.parent.postMessage({type:'omelette:notify-3d-export'...}, '*')`                         | Removed with the export toolbar.              |
| relative             | `textures/*.webp`, `assets/recursos/pc_*.webp`                                                  | Kept, same-origin static files under `/3d/`.  |

## 4. Use of risky APIs in v8 (line numbers refer to the delivered file)

- `innerHTML`: 1547, 1550 (floating labels and list buttons built from `INFO`
  text), 1568, 1652, 1702, 1729, 1734. All of the text rendered through
  template-string `innerHTML` is built-in today, but the same sink would take
  point text from outside once data is injected. Replaced by DOM APIs.
- `localStorage`: 1676, 1682, 1696 (language, Moodle config incl. **token**), 1716,
  1721 (point draft), 1764, 1768, 1772. `sessionStorage`: 1707, 1713 (admin
  session flag). All removed.
- `fetch`: 1684 (Moodle), 1695 (points JSON). Removed.
- `confirm()`: 1721, 1760, 1772 (admin). Removed.
- `eval`, `new Function`, `WebSocket`, `XMLHttpRequest`, `document.write`,
  `window.open`: none. (`postMessage` appears only in `three-d-stage.js`.)
- **Admin / Moodle / token code**: the block "Editable points" at lines
  1633-1788 (login modal with a client-side SHA-256 password check, point
  editor, drag/placing of pins, local drafts, Moodle web-service client
  `ws`/`moodleLoad`/`moodleSave`, token form), plus hooks in the click handler
  (`window.__admin`, lines 1618, 1624, 1787) and the lock button `#zadmin` (line 144).
- **Secret-like material**: line 1635, `PASS_HASH` = unsalted SHA-256 of the admin
  password. It is **not** committed anywhere in this repository: the
  "as delivered" import redacts that one line (see section 7). No plaintext
  passwords, tokens, API keys or URLs with credentials were found
  (placeholders only: `https://academia.ejemplo.co`, `https://su-moodle/...`).

## 5. What the points data looks like

`Z` holds the 9 hotspot positions (above). `INFO[n]` has `tag, sub, eb, t, pl,
d, f[]` (+ optional `img`, `link`). `order` is the pin display order
`[0, 8, 7, 6, 5, 1, 2, 3, 4]`. The facts `f` (hours, level, "Don Carlos",
"Unity: ... activador hotspot_NN_trigger") describe the original English-for-
tourism program, not the host's courses; they are **not** carried over.

Zone meaning (original program): 0 program intro, 1-4 the four seasons
(A1-B2), 5 plaza/showcase, 6 free-practice lab, 7 placement quiz, 8 guide page.

## 6. Provenance of textures and sprites

**Unknown / unverified license. Flagged, same risk class as the 2D background.**

Every image in `textures/`, `assets/recursos/` and the `uploads/` references
carries an embedded **C2PA content credential**:

- `uploads/recursos colombia*.png` (the sheet the sprites were cut from):
  `c2pa.created`, `digitalSourceType: trainedAlgorithmicMedia`, issuer **OpenAI**
  (AI-generated image).
- `uploads/referencia-*.png`: Adobe Photoshop in the manifest.
- The 8 textures and every sprite (png and webp): manifest with
  `softwareAgent: Claude / Anthropic` as the generating or processing tool,
  i.e. produced or transformed through an AI-assisted pipeline from the AI-made
  sheets above. The `texturas-*.png` uploads map 1:1 to the 8 textures.

So the art is AI-generated or AI-derived, with no license, author or terms
recorded anywhere in the folder. We ship only the 16 files v8 loads (8 textures,
8 postcards, ~1 MB total as `.webp`). **Management must confirm the right to
use and distribute them before production**; until then treat them like the
bundled backgrounds (`VITE_SHOW_BUNDLED_BACKGROUNDS`).

## 7. The "as delivered" import

The first import commit contains `three-d-stage.js` untouched, the 16
runtime images and `index.html` = v8 byte for byte **except line 1635**, where
the `PASS_HASH` value is replaced with `'REDACTED'` so no credential material
enters git history.

## 8. Changes made beyond the brief

Recorded in the sections below as they are made (see the commit log of
`feat/view3d`; each commit is one step).

_(Filled in as the work progresses.)_
