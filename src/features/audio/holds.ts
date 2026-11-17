// Who is asking the ambient music to be quiet. The welcome video holds it with a
// plain on/off; the exam and the trainer hold it once per playing clip. The music
// comes back only when nobody holds it any more, so a clip ending while the video
// still plays cannot restore it too early. Whether it comes back at all is not
// decided here: the session resumes it only if the viewer wanted it and had not
// muted it (`prefs.muted` is the one source of truth).

export interface Holds {
  // The legacy switch (the welcome video).
  setSwitch(held: boolean): void
  // One hold per clip; the returned function releases it, once.
  acquire(): () => void
  // The curtain closed: the switch lets go, clip holds stay.
  resetSwitch(): void
  held(): boolean
}

export const createHolds = (onChange: (held: boolean) => void): Holds => {
  let switchHeld = false
  const tokens = new Set<symbol>()
  const emit = () => onChange(switchHeld || tokens.size > 0)
  return {
    setSwitch: (held) => {
      switchHeld = held
      emit()
    },
    acquire: () => {
      const token = Symbol('hold')
      tokens.add(token)
      emit()
      return () => {
        if (!tokens.delete(token)) return
        emit()
      }
    },
    resetSwitch: () => {
      switchHeld = false
      emit()
    },
    held: () => switchHeld || tokens.size > 0,
  }
}
