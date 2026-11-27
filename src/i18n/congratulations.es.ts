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
    editingNote: 'Para probar, usa Vista previa con la edición activada.',
    fold: 'Ocultar',
    unfold: 'Mostrar',
    // The step added when the map's welcome has no check-in of its own.
    checkinTitle: 'Evaluación de entrada',
    checkinPending: 'Recorre la bienvenida y elige el resultado del diagnóstico.',
    addedCheckin:
      'La bienvenida de este mapa no tiene la evaluación de entrada: se agrega solo en la simulación.',
    passRule: (threshold: number, strict: boolean) =>
      strict
        ? `Se aprueba con más del ${threshold} %.`
        : `Se aprueba con al menos el ${threshold} %.`,
    checkinResult: (passed: boolean) =>
      passed ? 'Diagnóstico: aprobado' : 'Diagnóstico: no aprobado',
    noClosing: 'Este mapa no tiene un flujo de cierre: la simulación termina en el mapa.',
    boundaryAttempt: (threshold: number) => `Intento de la final: justo ${threshold} %`,
    allDone: 'Simular todas las actividades completadas',
    passAttempt: 'Intento de la final: aprobar',
    failAttempt: 'Intento de la final: no aprobar',
    attempts: (used: number, max: number) => `Intentos: ${used} de ${max}`,
    reset: 'Reiniciar simulación',
    exit: 'Salir de la simulación',
  },
  journey: {
    exhaustedTitle: 'Toca repasar el contenido',
    // Pending the product owner's approval, as the route card and the failure message below.
    exhaustedBody: 'Agotaste tus intentos. Repasa el contenido del mapa y consulta con tu tutor.',
    exhaustedCta: 'Volver al mapa',
    routeTitle: 'Tu ruta hacia la evaluación final',
    routeBody:
      'No alcanzaste el puntaje mínimo. Recorre el mapa y completa todas las actividades; al terminar podrás presentar la evaluación final.',
    routeCta: 'Entendido',
    failureTitle: (used: number, max: number) => `Intento ${used} de ${max}: no aprobaste`,
    failureBody: (left: number, max: number) =>
      `No aprobaste este intento. Te quedan ${left} de ${max}.`,
    closingCardTitle: 'Terminaste todo el contenido',
    closingCardBody: 'Ya puedes pasar al cierre del curso.',
    closingCardCta: 'Continuar al cierre',
    closingRemaining: (left: number) =>
      left === 1
        ? 'Te falta 1 actividad para el cierre.'
        : `Te faltan ${left} actividades para el cierre.`,
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
    placeholders: {
      checkin:
        'Puedes usar {score} para la nota y {threshold} para el mínimo para aprobar. Solo texto: no se permite formato ni enlaces.',
      final:
        'Puedes usar {threshold} para el mínimo para aprobar. Solo texto: no se permite formato ni enlaces.',
    },
    scoreUnavailable:
      'Quita {score}: la nota de la evaluación final todavía no está disponible. Mientras esté, ese campo mostrará el texto de Rumbos.',
    counter: (used: number, max: number) => `${used} de ${max}`,
    preview: 'Así se verá',
    previewScore: '85',

    reset: 'Usar el texto de Rumbos',
    previewLabel: 'Vista previa de la pantalla',
    tooLong: 'El texto es demasiado largo.',
  },
} as const
