# The student HUD

Students, the editor's "Vista previa" and "Guardado" all get the same **stage**: the map
fills the screen and every control floats at an edge. The editor keeps its header.
Decisions that were not in the brief are in [`DECISIONS-hud.md`](DECISIONS-hud.md).

## Layout

| Where                 | What                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| Top left              | Niveles (several levels only), Misiones, Ajustes                                                          |
| Bottom right (column) | Zoom in/out, recentrar, 2D/3D (if the saved map has 3D), música (if the map has music), pantalla completa |
| Bottom left           | Level chip (title and progress); above it, on touch screens, "Mover el mapa" sits at the very bottom      |
| Bottom center         | Continuar                                                                                                 |
| **Top right**         | **Empty, always.** The host draws its exit control there in fullscreen                                    |

Below 480 px the level chip moves to the top, centered. Below 640 px the top-left buttons
are icon-only and Misiones is a bottom sheet instead of a side panel. The placement rules
are numbers in `src/features/hud/metrics.ts`; `metrics.test.ts` checks no overlap, no entry
into the 64 px corner and a 44 px minimum over 16 widths x 7 heights. Controls fade to 45 %
after 3 s idle and return on pointer, touch or key; the chip stays at 70 % so its text keeps
AA contrast against its scrim (`contrast.test.ts`).

An editor looking at the student view gets a small "Salir de la vista previa" pill at the
left edge, vertically centered. Students never see it.

## Misiones

One list that is also the accessible equivalent of the map: Siguiente, Disponibles,
Completadas, Bloqueadas, Próximamente. Each row has a state icon (never color alone), the
title and a status line; restricted rows show Moodle's plain-text availability info.
Tapping a row flies the camera (or the 3D pin) to it, "Abrir" opens it through the host.
A hidden activity is only ever "Próximamente": its name never reaches the list.

## Progress

An activity whose completion is `none` is **untracked**: open, "Sin seguimiento", never
"next", never blocking the guided sequence and left out of the progress count. A level
where nothing is tracked says "Este nivel no registra progreso". Completions are announced
once, per activity, as a toast and a polite live-region message ("Completaste: <nombre>"),
only for a not-complete to complete transition after the level's first state.

In the editor, untracked activities get a triangle on the bubble, a badge in the popover
and the overview, and (with a v5.4 host) a "Configurar en Moodle" button. A guided level
containing any shows a prominent alert; `courseCompletionEnabled: false` shows a banner.

## Data saver

On by itself for Save-Data or a slow-2g/2g connection; forced on or off in Ajustes. While
on: animation tier capped at low, no ambient particles, a remembered 3D choice is not
started, no audio autostart. It never preloads audio in any case.

## Music (unverified against a real backend)

Editors pick a track in Apariencia → Música (library by OBJ Digital, or their own upload
with a required credit and a rights declaration). Students get a corner control with a
switch, volume and the credit. Never plays before a gesture; autostarts only if the editor
allows it, the viewer has not muted and data saver is off; fades 400 ms; pauses under host
overlays and in hidden tabs; `preload="none"`. The tab and control exist only if the
backend answers `GET /assets?kind=audio&scope=library`.

## Bundle budget

`pnpm build && pnpm check:budget` fails when the JavaScript the embed student route needs
before the map is interactive exceeds **350 KB gzipped** (`EMBED_BUDGET_KB` overrides).
It counts the entry, the html preloads and the always-needed lazy chunks (embed shell, app
shell, 2D map) with their static imports; 3D, the studio and the audio player are lazy and
not counted.

| When                                                   | Embed student initial JS |
| ------------------------------------------------------ | ------------------------ |
| Before this work                                       | 268.4 KB                 |
| After the HUD, Misiones, resume, coach marks, warnings | about 276 KB             |
| After data saver and audio                             | 280.2 KB                 |

These are static sizes. A throttled-4G run on a mid-range Android was not measured.

## Accessibility: what was checked and where

- Contrast of the chip text against its scrim over white, gray, black, yellow and sky maps,
  at full and dimmed opacity: `contrast.test.ts`.
- 44 px targets and overlap-free layout: `metrics.test.ts`.
- State never by color alone: shapes and icons (lock, check, pin, arrow, dashed circle,
  triangle), plus a text status on every row.
- Reduced motion: no animation in coach marks; the quality store already honors it; the
  sheet and fades use `motion-safe`.
- Live announcements: one persistent polite region (`LiveRegion`).
- Focus: Misiones focuses its heading on open and returns to its button; the coach marks
  take and give back focus; an open sheet hides what it covers from the tab order.
- Not checked with a real screen reader or at 200 % text scaling on a device.
