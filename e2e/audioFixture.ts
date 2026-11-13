import type { BrowserContext } from '@playwright/test'

// A real audio file for the real <audio> element, made at test time (nothing is
// committed). The mock backend hands the app a blob: URL for its library tone; the
// init script below swaps that URL for one served over http by the test, with the
// right Content-Type, so the browser decodes it as it would a file from the
// backend. Only the file is replaced: the session, the element and the playback
// are real.

const SAMPLE_RATE = 22_050

// A mono 16-bit PCM WAV: a quiet sine, one second by default.
export const makeWav = (seconds = 1, frequency = 440): Buffer => {
  const samples = Math.floor(SAMPLE_RATE * seconds)
  const buffer = Buffer.alloc(44 + samples * 2)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + samples * 2, 4)
  buffer.write('WAVEfmt ', 8)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(SAMPLE_RATE, 24)
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(samples * 2, 40)
  for (let i = 0; i < samples; i++)
    buffer.writeInt16LE(
      Math.round(Math.sin((2 * Math.PI * frequency * i) / SAMPLE_RATE) * 0.25 * 32767),
      44 + i * 2
    )
  return buffer
}

// A real MP3 stream: MPEG-1 Layer III, 128 kbit/s, 44.1 kHz, mono-compatible
// frames of silence (a valid header and an all-zero payload decode as silence).
// It is the MP3 container and codec path the production tracks go through; it is
// not music, and nothing here is an encoder.
export const makeMp3 = (seconds = 1): Buffer => {
  const frameBytes = 417 // 144 * 128000 / 44100, no padding
  const frames = Math.ceil((seconds * 44_100) / 1152)
  const frame = Buffer.alloc(frameBytes)
  frame.set([0xff, 0xfb, 0x90, 0xc4]) // sync, MPEG-1 L3 no CRC, 128k 44.1k, mono
  return Buffer.concat(Array.from({ length: frames }, () => frame))
}

export type FixtureKind = 'wav' | 'mp3'

const TYPES: Record<FixtureKind, string> = { wav: 'audio/wav', mp3: 'audio/mpeg' }

export const serveAudioFixture = async (context: BrowserContext, kind: FixtureKind) => {
  const body = kind === 'wav' ? makeWav(3) : makeMp3(3)
  // Range requests are answered with 206, as the real backend does: WebKit (and
  // Safari) refuse media that cannot be read by range.
  await context.route('**/__fixture/tone.*', (route) => {
    const range = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers()['range'] ?? '')
    const headers: Record<string, string> = {
      'Content-Type': TYPES[kind],
      'Accept-Ranges': 'bytes',
    }
    if (!range) return route.fulfill({ status: 200, body, headers })
    const start = Number(range[1])
    const end = Math.min(range[2] ? Number(range[2]) : body.length - 1, body.length - 1)
    return route.fulfill({
      status: 206,
      body: body.subarray(start, end + 1),
      headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${body.length}` },
    })
  })
  await context.addInitScript((extension) => {
    const original = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (object: Blob | MediaSource) =>
      object instanceof Blob && object.type.startsWith('audio/')
        ? `${location.origin}/__fixture/tone.${extension}`
        : original(object)
  }, kind)
}

// Records every <audio> element the app creates, so a test can read the real one.
export const spyOnAudioElements = (context: BrowserContext) =>
  context.addInitScript(() => {
    const created: HTMLAudioElement[] = []
    const Native = window.Audio
    ;(window as unknown as { __audios: HTMLAudioElement[] }).__audios = created
    window.Audio = function (...args: ConstructorParameters<typeof Audio>) {
      const element = new Native(...args)
      created.push(element)
      return element
    } as unknown as typeof Audio
  })
