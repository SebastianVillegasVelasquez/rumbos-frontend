# Entrenamiento de {idioma} · paquete para Claude Code

Contenido:

- `Entrenamiento Docs.dc.html`: tokens, contraste, niveles, inventario, textos, interacción, hand-off y preguntas abiertas.
- `Entrenamiento Frames.dc.html`: marcos del botón Entrenar y de S1 a S10 (1366×768, 360×740, 1280×640).
- `assets/map.png`: captura de Rumbos usada como fondo difuminado.

Antes de implementar:

- Las tipografías (Outfit, Figtree) y los colores son lecturas a ojo de las capturas. Verifícalos contra el CSS real de Rumbos.
- El flujo de bienvenida no llegó: la tarjeta de escenario, la barra segmentada, el pie crema, el popover y el estado deshabilitado son propuestas.
- Los textos marcados "REQUIERE REVISIÓN LEGAL" no se publican sin revisión.

Prompt sugerido:
"Lee `Entrenamiento Docs.dc.html` (secciones Tokens y Hand-off) y `Entrenamiento Frames.dc.html`. Implementa el botón Entrenar en el HUD de Rumbos y la pantalla S4 con los tokens existentes. Donde no haya token, usa el valor propuesto y márcalo con un comentario TODO."
