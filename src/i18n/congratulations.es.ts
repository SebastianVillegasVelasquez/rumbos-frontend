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
    tooLong: 'El texto es demasiado largo.',
  },
} as const
