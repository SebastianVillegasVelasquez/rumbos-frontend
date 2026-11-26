# Editor shell: top bar, left rail, full-view sections

The editor lives in a small Moodle iframe, so the navigation was rebuilt around one rule: **the
rail picks what the content area shows, and nothing floats over the map.** Style (colours, type,
buttons, 2px outlines) is unchanged; only structure moved.

## Layout

- `src/features/editor-shell/EditorShell.tsx`: a 48px bar, a 64px rail, and a content area that
  takes the rest of the width and height.
- Bar, in order: `Rumbos / <level>`, mode switch (Edición | Vista previa), one save status
  (`● v13 guardado`), **Guardar**, `⋯`, `⤢` (Pantalla completa, a `title` tooltip).
- Guardar is the solid primary button and is off only when the level has no changes.
  **Versiones guardadas**, **Descartar cambios** and the "open in fullscreen on start" switch are in
  the `⋯` menu (`components/ui/OverflowMenu.tsx`).
- The old "Guardado" tab (the third view mode) and the duplicated "Guardado" text are gone.
- Rail: Mapa, Actividades (count of activities not yet on the map), Niveles, Mapa de calor
  (only where the host can answer), Apariencia (dot when there are unsaved edits), Resumen.
  Below 520px the labels go and the rail is 48px wide.

## Behaviour

- No section, or **Mapa**: the map editor. Any other item: that section replaces the map at 100%
  of the content area, with its title and **← Volver al mapa**. The rail stays, so sections can be
  switched directly. No overlays, no side panels over the header or the map.
- The map stays mounted at full size (invisible and `inert`) while a section is open, so zoom,
  pan and selection are exactly where they were. A section, once opened, also stays mounted, so
  unsaved Apariencia edits survive switching.
- Actividades is the one partial section: a 240px strip beside the map (45% of the height under
  it below 520px), so activities can still be dragged onto the map. Each row also has
  **Colocar en el mapa**.
- Mapa de calor: the numbers panel is a section; the colouring still draws on the map once on.
- Niveles: the carousel becomes a wrapping grid here (`LevelCarousel layout="grid"`), and it never
  opens a level by itself (`CourseLevels embedded`).

## Inside a section

- `SubNavLayout`: a 150px vertical list on the left, content on the right. Under 520px the list is
  a `<select>` above the content. Apariencia's ten chips are that list, so they never wrap.
- Card lists (activities, resumen, levels) use
  `grid-template-columns: repeat(auto-fill, minmax(180px, 1fr))`.
- Step cards (Actividad de Moodle, Evaluación final, …) take the full width, truncate their title,
  and keep move up / down / duplicate / delete at a fixed width inside the card. Under 480px **of the
  card** (a container query, since the card sits beside the rail and the list) they fold into `⋯`.
  "Agregar paso" buttons wrap (`flex-wrap`).
- The only scroll is vertical, inside `ScrollRegion`. Containers carry `min-w-0` and
  `overflow-x-hidden`.

## Remembering

- Last section: `localStorage` (`rumbos.editor.section`), validated against the sections this
  editor can open; anything else falls back to the map.
- Fullscreen when the editor opens (embedded, editing host only): asked **once** per load, on by
  default, off from the `⋯` menu (`rumbos.editor.fullscreen`). The host still decides.

## Scroll and fullscreen around a PDF

- `ScrollRegion` keeps a scroll position per place (`appearance:welcome`, `levels`, …). It puts the
  person back after switching sections or tabs, and when the position was reset behind their back
  (window focus returns, the stage resizes, `fullscreenchange`, a preview closes). A hidden box
  reports a height of 0 and never overwrites the saved position.
- Opening a PDF (`Abrir`, `target="_blank"`) moves to another tab, which takes the browser's
  fullscreen with it and makes the host collapse its stage. `useKeepStageThroughTab`
  (`embed/tabFullscreenGuard.ts`) asks for the stage back **only** when it fell while the tab was
  away. Leaving fullscreen with the host's own control while looking at the page is never undone.

## Not done / judgement calls

- Actividades, Resumen and Niveles are single views, so they have no sub-list. A one-item list
  would only add a column.
- The course entry screen (`?course=`, several levels, no level open yet) still has the previous
  two-row header; the new shell is the level editor.
- The Apariencia form fields stay stacked; the auto-fill grid is for lists of cards.
