// What to do about audio that cannot be played. Pure, so each case is tested
// without a browser.

// `available` is optional on older backends: absent means "unknown", never
// "false", so only an explicit false counts as missing.
export const isAvailable = (item: { available?: boolean }): boolean => item.available !== false

export type AudioControlMode = 'normal' | 'hidden' | 'warning'

// Students get no error at all: the control just goes away for the session.
// Editors (and the preview) keep the control and see why the music is silent.
export const audioControlMode = (input: {
  failed: boolean
  diagnostics: boolean
}): AudioControlMode => {
  if (!input.failed) return 'normal'
  return input.diagnostics ? 'warning' : 'hidden'
}
