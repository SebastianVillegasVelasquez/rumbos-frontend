// Mock-mode audio: there is no backend to serve music from, so the "library"
// tracks are short sine tones generated here and played from blob URLs. They
// are for exercising the UI only (the real backend serves MP3/M4A with Range
// support, which this does not verify).

const SAMPLE_RATE = 22_050

// A mono 16-bit PCM WAV of a quiet sine tone.
export const makeToneWav = (frequency: number, seconds: number): Blob => {
  const samples = Math.floor(SAMPLE_RATE * seconds)
  const buffer = new ArrayBuffer(44 + samples * 2)
  const view = new DataView(buffer)
  const text = (offset: number, value: string) =>
    [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)))
  text(0, 'RIFF')
  view.setUint32(4, 36 + samples * 2, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, SAMPLE_RATE, true)
  view.setUint32(28, SAMPLE_RATE * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, samples * 2, true)
  for (let i = 0; i < samples; i++) {
    // A slow envelope keeps the loop point from clicking.
    const envelope = Math.sin((Math.PI * i) / samples)
    const value = Math.sin((2 * Math.PI * frequency * i) / SAMPLE_RATE) * envelope * 0.25
    view.setInt16(44 + i * 2, Math.round(value * 32767), true)
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

export interface LibraryTrackSeed {
  title: string
  credit: string
  frequency: number
  seconds: number
}

export const LIBRARY_TRACKS: LibraryTrackSeed[] = [
  {
    title: 'Brisa de la isla (tono de prueba)',
    credit: 'OBJ Digital · tono generado para pruebas',
    frequency: 220,
    seconds: 4,
  },
  {
    title: 'Camino al faro (tono de prueba)',
    credit: 'OBJ Digital · tono generado para pruebas',
    frequency: 330,
    seconds: 6,
  },
]

// How long an uploaded file plays, read from its metadata; null when the
// browser cannot decode it.
export const readAudioDuration = (file: Blob): Promise<number | null> =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const audio = new Audio()
    const done = (value: number | null) => {
      URL.revokeObjectURL(url)
      resolve(value)
    }
    audio.preload = 'metadata'
    audio.onloadedmetadata = () =>
      done(Number.isFinite(audio.duration) ? Math.round(audio.duration) : null)
    audio.onerror = () => done(null)
    audio.src = url
  })
