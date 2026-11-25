// The congratulations screen: the default copy per purpose (used where the editor left a field
// empty) and the words of the editor that customises it. Spanish "tú". The placeholders
// `{score}` and `{threshold}` are substituted by the app, never by markup.
export const esCongratulations = {
  // Defaults, one per purpose. The check-in one depends on how the threshold was graded:
  // with `gt`, exactly the threshold does not pass ("más del"); with `gte` it does ("al menos el").
  defaults: {
    checkin: {
      title: '¡Lo lograste!',
      bodyGt: 'Completaste la evaluación diagnóstica con más del {threshold}%.',
      bodyGte: 'Completaste la evaluación diagnóstica con al menos el {threshold}%.',
      bodyUnknown: 'Completaste la evaluación diagnóstica.',
      ctaLabel: 'Continuar',
    },
    final: {
      title: '¡Terminaste el curso!',
      body: 'Aprobaste la evaluación final. Gracias por tu esfuerzo.',
      ctaLabel: 'Continuar',
    },
  },
  screenLabel: 'Felicitaciones',
  // The journey screens around it.
  simulator: {
    heading: 'Simular recorrido',
    banner: 'Simulación: no se guarda ni cuenta',
    start: 'Empezar simulación',
    scenarioA: 'Aprobó el diagnóstico',
    scenarioB: 'No aprobó el diagnóstico',
    allDone: 'Simular todas las actividades completadas',
    passAttempt: 'Intento de la final: aprobar',
    failAttempt: 'Intento de la final: no aprobar',
    attempts: (used: number, max: number) => `Intentos: ${used} de ${max}`,
    reset: 'Reiniciar simulación',
    exit: 'Salir de la simulación',
  },
  journey: {
    exhaustedTitle: 'Toca repasar el contenido',
    exhaustedBody:
      'Usaste los tres intentos de la evaluación final. Vas a volver a ver todo el contenido desde el principio, y luego podrás cerrar el curso.',
    exhaustedNote:
      'El reinicio lo hace Moodle, no esta pantalla. Mientras tanto, avisa a tu docente si no ves el contenido de nuevo.',
    exhaustedCta: 'Volver al mapa',
    closingCardTitle: 'Terminaste todo el contenido',
    closingCardBody: 'Ya puedes pasar al cierre del curso.',
    closingCardCta: 'Continuar al cierre',
    closingRemaining: (left: number) =>
      left === 1
        ? 'Te falta 1 actividad para el cierre.'
        : `Te faltan ${left} actividades para el cierre.`,
    attempts: (used: number, max: number) => `Intento ${used} de ${max}`,
  },
  // Said to a screen reader when the screen appears.
  announce: (title: string) => `${title}`,
  editor: {
    heading: 'Pantalla de felicitaciones',
    intro:
      'Es lo que ve el estudiante al aprobar. Si dejas un campo vacío, se usa el texto de Rumbos.',
    purposes: {
      checkin: 'Al aprobar la evaluación diagnóstica',
      final: 'Al aprobar la evaluación final',
    },
    title: 'Título',
    body: 'Mensaje',
    ctaLabel: 'Texto del botón',
    placeholders:
      'Puedes usar {score} para la nota y {threshold} para el mínimo para aprobar. Solo texto: no se permite formato ni enlaces.',
    counter: (used: number, max: number) => `${used} de ${max}`,
    preview: 'Así se verá',
    previewScore: '85',
    previewThreshold: '70',
    reset: 'Usar el texto de Rumbos',
    previewLabel: 'Vista previa de la pantalla',
    tooLong: 'El texto es demasiado largo.',
  },
} as const
