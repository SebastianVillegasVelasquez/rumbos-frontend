// Spanish copy of the native assessment (check-in and final). A sibling of es.ts
// on purpose: it loads with the lazy exam chunk, so the embed's first download does
// not carry it. Same rules as es.ts: "tú", every visible string a key.
// All of this wording needs the client's review (see docs/DECISIONS-trainer.md).

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

export const esAssessment = {
  titles: {
    check_in: 'Evaluación de entrada',
    final: 'Evaluación final',
  },
  // The document's own section names (the server's titles win when it sends them).
  sections: {
    listening: 'Listening',
    reading: 'Reading',
    use_of_english: 'Use of English',
    writing: 'Writing',
    speaking: 'Speaking',
  },
  preview: 'Vista previa: no se guarda.',
  loading: 'Preparando la evaluación…',
  close: 'Volver al mapa',

  // Before starting.
  intro: {
    questions: (n: number) => `${n} ${plural(n, 'pregunta', 'preguntas')}`,
    sections: (n: number) => `${n} ${plural(n, 'sección', 'secciones')}`,
    minutes: (n: number) => `${n} minutos`,
    attemptsLeft: (left: number) =>
      left === 1 ? 'Te queda 1 intento' : `Te quedan ${left} intentos`,
    timeRuns: 'Una vez que empiezas, el tiempo corre aunque cierres la página.',
    autosave: 'Tus respuestas se guardan a medida que avanzas.',
    speaking: 'La parte de Speaking se responde por escrito. No usamos tu micrófono.',
    start: 'Empezar',
    resume: 'Continuar la evaluación',
    starting: 'Empezando…',
    timeLeft: (clock: string) => `Te quedan ${clock}`,
  },

  // The runner.
  runner: {
    sectionLine: (index: number, total: number, title: string) =>
      `Sección ${index} de ${total} · ${title}`,
    progress: 'Secciones de la evaluación',
    sectionDot: (n: number, title: string, state: 'current' | 'visited' | 'pending') =>
      `Sección ${n}: ${title}${state === 'current' ? ' (actual)' : ''}`,
    timeLeft: 'Tiempo restante',
    timeLeftAria: (clock: string) => `Tiempo restante: ${clock}`,
    minutesLeft: (n: number) => (n === 1 ? 'Queda 1 minuto.' : `Quedan ${n} minutos.`),
    question: (n: number) => `Pregunta ${n}`,
    questions: (from: number, to: number) =>
      from === to ? `Pregunta ${from}` : `Preguntas ${from} a ${to}`,
    saving: 'Guardando…',
    saved: 'Guardado',
    saveFailed: 'No se pudo guardar. Lo que escribiste sigue aquí.',
    saveRetry: 'Reintentar guardado',
    previous: 'Anterior',
    next: 'Siguiente sección',
    review: 'Revisar y entregar',
    sectionLoading: 'Cargando la sección…',
    sectionError: 'No pudimos cargar esta sección.',
    sectionRetry: 'Reintentar',
    shared: 'Texto de apoyo',
    sign: 'Letrero',
    image: 'Imagen de apoyo',
  },

  // The review screen and the confirmation.
  review: {
    title: 'Revisa antes de entregar',
    loading: 'Reuniendo tus respuestas…',
    allDone: 'Respondiste todas las preguntas.',
    unanswered: (n: number) =>
      `${n} ${plural(n, 'pregunta sin terminar', 'preguntas sin terminar')}`,
    item: (n: number, section: string) => `Pregunta ${n} · ${section}`,
    partial: 'Incompleta',
    empty: 'Sin responder',
    go: (n: number) => `Ir a la pregunta ${n}`,
    goShort: 'Ir',
    confirmBodyUnknown:
      'No pudimos revisar todas las secciones. Ya no podrás cambiar tus respuestas.',
    back: 'Volver a las preguntas',
    submit: 'Entregar',
    confirmTitle: '¿Entregar la evaluación?',
    confirmBody: (unanswered: number) =>
      unanswered === 0
        ? 'Ya no podrás cambiar tus respuestas.'
        : `Te ${plural(unanswered, 'falta', 'faltan')} ${unanswered} ${plural(unanswered, 'pregunta', 'preguntas')} por terminar. Ya no podrás cambiar tus respuestas.`,
    confirm: 'Sí, entregar',
    keep: 'Seguir respondiendo',
    submitting: 'Entregando…',
  },

  // Answering.
  items: {
    choose: 'Elige una respuesta',
    listen: 'Escuchar',
    pause: 'Pausar',
    listening: 'Escuchando…',
    audioFailed: 'No pudimos reproducir el audio.',
    audioRetry: 'Reintentar el audio',
    audioLabel: (n: number) => `Audio ${n}`,
    speed: 'Velocidad',
    transcript: 'Transcripción',
    match: {
      hint: 'Elige un audio y luego el lugar que le corresponde. Para quitar una unión, elígela de nuevo.',
      joined: 'Unión hecha.',
      clipSelected: (n: number) => `Audio ${n}, elegido`,
      clipPaired: (n: number, place: string) => `Audio ${n}, unido con ${place}`,
      place: (text: string) => text,
      placePaired: (text: string, n: number) => `${text}, unido con el audio ${n}`,
      remove: 'Quitar unión',
      places: 'Lugares',
      clips: 'Audios',
    },
    wordsCounter: (count: number, min: number, max: number) =>
      `${count} ${plural(count, 'palabra', 'palabras')} · entre ${min} y ${max}`,
    wordsBelow: (n: number) => `Te ${plural(n, 'falta', 'faltan')} ${n}`,
    wordsAbove: (n: number) => `Te ${'pasaste'} por ${n}`,
    wordsWithin: 'En el rango',
    charsCounter: (used: number, max: number) => `${used} de ${max} caracteres`,
    fieldLabel: (label: string) => label,
    blank: (n: number) => `Espacio ${n}`,
  },

  // Failures that stop the exam. None of them traps the student.
  errors: {
    unreachable: 'No pudimos conectar con el servidor.',
    unauthorized:
      'Tu sesión venció. Vuelve a abrir la evaluación desde el curso y seguirás donde ibas.',
    no_attempts_left: 'Ya usaste todos tus intentos.',
    locked: 'Esta evaluación todavía no está disponible.',
    closed: 'La evaluación ya se cerró.',
    other: 'Algo salió mal.',
    retry: 'Reintentar',
    keepsAnswers: 'Tus respuestas guardadas siguen aquí.',
    submitFailed: 'No pudimos entregar todavía. Tus respuestas siguen aquí.',
  },

  // The result.
  result: {
    title: 'Tu resultado',
    percent: (value: string) => `${value} %`,
    expired: 'Se acabó el tiempo y entregamos lo que tenías respondido.',
    checkInTitle: 'Tu punto de partida',
    checkInBody: 'Esta evaluación nos dice por dónde empezar. No es una nota que te limite.',
    passed: 'Superaste la evaluación.',
    notPassedCheckIn: 'Este es tu punto de partida. A partir de aquí vas a avanzar.',
    notPassedFinal: (left: number) =>
      left > 0
        ? `Todavía no alcanzas el puntaje. Te ${plural(left, 'queda', 'quedan')} ${left} ${plural(left, 'intento', 'intentos')}.`
        : 'Todavía no alcanzas el puntaje y ya no te quedan intentos.',
    bands: {
      emerging: 'Inicial',
      developing: 'En desarrollo',
      consolidating: 'En consolidación',
      achieved: 'Logrado',
    },
    band: (label: string) => `Nivel: ${label}`,
    gain: (value: string) => `Frente a tu evaluación de entrada: ${value} puntos`,
    profile: 'Tu perfil por sección',
    profileRow: (title: string, percent: string) => `${title}: ${percent} %`,
    modules: 'Tu mapa por módulo',
    moduleRow: (module: string, percent: string) => `${module}: ${percent} %`,
    weight: (w: number) => `${w} % del total`,
    // What the passback is doing, said only as true as the backend says it.
    sync: {
      pending: 'Estamos registrando tu resultado.',
      synced: 'Tu curso quedó completado.',
      failed:
        'Tu resultado está guardado; tardará en verse reflejado. Si no aparece en 24 horas, escribe a soporte.',
      polling: 'Seguimos comprobándolo.',
    },
    attempts: (used: number, max: number) => `Intentos usados: ${used} de ${max}`,
    again: 'Intentar de nuevo',
    toMap: 'Volver al mapa',
    report: 'Reportar un error',
    // We never show which answers were right or wrong.
    noAnswers: 'Por seguridad de la evaluación no mostramos respuestas ni claves.',
  },

  report: {
    title: 'Reportar un error',
    reason: 'Qué pasó',
    reasons: {
      wrong_answer: 'Una respuesta parece incorrecta',
      unclear: 'No se entiende',
      audio: 'Problema con el audio',
      offensive: 'Contenido ofensivo',
      other: 'Otro',
    },
    note: 'Cuéntanos más (opcional)',
    noteMax: (max: number) => `Máximo ${max} caracteres`,
    send: 'Enviar reporte',
    sending: 'Enviando…',
    sent: 'Gracias, recibimos tu reporte.',
    failed: 'No pudimos enviar el reporte. Inténtalo de nuevo.',
    cancel: 'Cancelar',
    close: 'Cerrar',
  },

  // The step of the welcome flow.
  step: {
    available: 'Evaluación de entrada: te dice por dónde empezar.',
    inProgress: (clock: string) => `Tienes una evaluación en curso. Te quedan ${clock}.`,
    exhausted: 'Ya usaste tus intentos.',
    passed: 'Ya aprobaste.',
    locked: 'Esta evaluación todavía no está disponible.',
    // Why the step cannot offer the exam. Keys are ours, never the backend's codes.
    reasons: {
      not_available: 'La evaluación de entrada todavía no está lista en este curso.',
      locked: 'Esta evaluación todavía no está disponible.',
      disabled: 'Este curso no tiene evaluación de entrada.',
      no_form: 'La evaluación de entrada todavía no tiene preguntas.',
    },
    checking: 'Comprobando…',
    open: 'Empezar la evaluación',
    resume: 'Continuar la evaluación',
    retry: 'Reintentar',
    unreachable: 'No pudimos cargar la evaluación.',
    unreachableHelp: 'Revisa tu conexión e inténtalo de nuevo.',
    skip: 'Continuar de todos modos',
    skipNote: 'No se tomó tu punto de partida. Podrás hacer la evaluación más adelante.',
    done: 'Evaluación entregada.',
    waiting: 'Termina la evaluación para continuar.',
    editorNote: 'Vista previa: puedes continuar sin hacer la evaluación.',
  },

  // The same step in the closing flow (the final exam): only the words that name the
  // exam differ; the rest comes from `step`.
  stepFinal: {
    available: 'Evaluación final: muestra lo que aprendiste.',
    reasons: {
      not_available: 'La evaluación final todavía no está lista en este curso.',
      locked: 'Esta evaluación todavía no está disponible.',
      disabled: 'Este curso no tiene evaluación final.',
      no_form: 'La evaluación final todavía no tiene preguntas.',
    },
    skipNote: 'No se hizo la evaluación final. Podrás hacerla más adelante.',
    editorNote: 'Vista previa: puedes continuar sin hacer la evaluación.',
  },
} as const

export type Es = typeof esAssessment
