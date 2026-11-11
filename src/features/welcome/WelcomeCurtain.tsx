import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ArrowRight, Maximize2, Play, Volume2, VolumeX } from 'lucide-react'
import { Button } from '../../components/ui/Button.tsx'
import { useDataSaver } from '../../fx/dataSaverStore.ts'
import { es } from '../../i18n/es.ts'
import { readAudioPrefs } from '../audio/audioPrefs.ts'
import { NowPlayingDisc } from '../audio/NowPlayingDisc.tsx'
import { coverToLoad } from '../audio/nowPlaying.ts'
import { EnlargeableVideo } from '../content/EnlargeableVideo.tsx'
import { useVideoPanelWidth } from '../content/useVideoPanelWidth.ts'
import { resolveImageUrl } from '../course-map/data/assets.ts'
import type { MapWelcome } from '../course-map/data/types.ts'
import { viewerStorage } from '../quests/viewerStorage.ts'
import { WelcomeSparkles } from './WelcomeSparkles.tsx'
import {
  nextVideoLoad,
  playbackOf,
  playerOrigin,
  playerUrl,
  subscribeMessages,
  VIDEO_LOAD_TIMEOUT_MS,
  type VideoLoad,
} from './videoPlayer.ts'
import { curtainButtons, videoHostNote } from './videoControls.ts'
import { hasOptionalVideo, primaryAction } from './welcome.ts'

const text = es.welcome

type AudioSessionModule = typeof import('../audio/audioSession.ts')

interface WelcomeCurtainProps {
  welcome: MapWelcome
  // Already resolved (the {curso} placeholder replaced).
  title: string
  // The map's background, blurred under the scrim.
  imageUrl: string
  hasMusic: boolean
  // The track that will play, for the disc beside the music switch.
  track?: { title: string; coverUrl: string | null } | null
  // The editor's own look at the curtain: it touches neither the music nor
  // anything remembered.
  isolated?: boolean
  // Shows a visible way out ("Vista previa" and the editor's preview).
  showSkip?: boolean
  // Enters fullscreen without starting anything else; null while there is
  // nothing to offer (already fullscreen, or no way to do it).
  onEnterFullscreen?: (() => void) | null
  skipLabel?: string
  onDone: () => void
}

type Phase = 'intro' | 'video'

const FOCUSABLE = 'button:not([disabled]), [href], iframe, [tabindex]:not([tabindex="-1"])'

// The entry screen of a map: the map's own background blurred under a scrim, a
// title, an optional message and video, and one clear button. The button is the
// viewer's first gesture, so it also starts the music (unless they switched it
// off here or before). A modal dialog: focus starts on the primary button and
// stays inside; no Escape is needed to go on.
const WelcomeCurtain = ({
  welcome,
  title,
  imageUrl,
  hasMusic,
  track = null,
  isolated = false,
  showSkip = false,
  onEnterFullscreen = null,
  skipLabel = text.skipPreview,
  onDone,
}: WelcomeCurtainProps) => {
  const dataSaver = useDataSaver().active
  const [phase, setPhase] = useState<Phase>('intro')
  const [videoSeen, setVideoSeen] = useState(false)
  const [videoLoad, setVideoLoad] = useState<VideoLoad>('loading')
  const [musicOn, setMusicOn] = useState(() => !readAudioPrefs(viewerStorage()).muted)
  const rootRef = useRef<HTMLDivElement>(null)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const skipVideoRef = useRef<HTMLButtonElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const viewRef = useRef<HTMLDivElement>(null)
  const columnRef = useRef<HTMLDivElement>(null)
  const sessionRef = useRef<AudioSessionModule | null>(null)

  const video = welcome.video
  const src = video ? playerUrl(video.provider, video.videoId) : null
  const action = videoSeen ? 'start' : primaryAction(welcome)
  const canPlay = Boolean(video && src)
  const showPlay = action === 'play' && canPlay

  // The audio session loads while the viewer reads, so the click can start the
  // music in the same call stack (iOS Safari only allows that).
  useEffect(() => {
    if (!hasMusic || isolated) return
    let alive = true
    void import('../audio/audioSession.ts').then((module) => {
      if (alive) sessionRef.current = module
    })
    return () => {
      alive = false
    }
  }, [hasMusic, isolated])

  // Whatever way the curtain closes, the music is no longer held.
  useEffect(
    () => () => {
      sessionRef.current?.audioSession.hold(false)
    },
    []
  )

  // The button leaves while fullscreen is on, possibly with focus on it: keep
  // the focus inside the dialog.
  const canFullscreen = onEnterFullscreen !== null
  useEffect(() => {
    if (canFullscreen || rootRef.current?.contains(document.activeElement)) return
    if (phase === 'video') skipVideoRef.current?.focus()
    else primaryRef.current?.focus()
  }, [canFullscreen, phase])

  useEffect(() => {
    if (phase === 'video') skipVideoRef.current?.focus()
    else primaryRef.current?.focus()
  }, [phase])

  const finishVideo = () => {
    sessionRef.current?.audioSession.hold(false)
    setVideoSeen(true)
    setPhase('intro')
  }

  // The player says when the video ends.
  useEffect(() => {
    if (phase !== 'video' || !video) return
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== playerOrigin(video.provider)) return
      if (event.source === null || event.source !== frameRef.current?.contentWindow) return
      // The music yields while the video plays and comes back when it does not:
      // an autoplay the browser refused leaves the player at its own play button.
      const playback = playbackOf(video.provider, event.data)
      if (playback === 'ended') finishVideo()
      else if (playback === 'playing') sessionRef.current?.audioSession.hold(true)
      else if (playback === 'paused') sessionRef.current?.audioSession.hold(false)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [phase, video])

  // An iframe that has not fired its load event in time: say so quietly. This
  // is all a cross-origin frame can tell us, and nothing else waits for it.
  useEffect(() => {
    if (phase !== 'video') return
    const timer = window.setTimeout(
      () => setVideoLoad((state) => nextVideoLoad(state, 'timeout')),
      VIDEO_LOAD_TIMEOUT_MS
    )
    return () => window.clearTimeout(timer)
  }, [phase])

  const startMusic = () => {
    const session = sessionRef.current?.audioSession
    if (!hasMusic || isolated || !session) return
    session.setMuted(!musicOn)
    session.startFromGesture()
  }

  const enter = () => {
    startMusic()
    onDone()
  }
  const play = () => {
    startMusic()
    sessionRef.current?.audioSession.hold(true)
    setVideoLoad('loading')
    setPhase('video')
  }

  const trapFocus = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return
    const items = [...(rootRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  // In video mode the footnote gives way: the video gets the room.
  const inVideo = phase === 'video' && canPlay
  const hostNote = video && !inVideo ? videoHostNote(video.provider) : ''
  const buttons = curtainButtons({
    showPlay,
    offerOptionalVideo: hasOptionalVideo(welcome) && canPlay && !videoSeen,
    hasMusic,
    canFullscreen: onEnterFullscreen !== null,
  })
  const labelOf = (id: (typeof buttons)[number]['id']) =>
    buttons.find((button) => button.id === id)?.label ?? ''
  // The panel's width from the measured boxes; null until there is a real one
  // (the CSS in styles/video-panel.css holds the size meanwhile).
  const panelWidth = useVideoPanelWidth(viewRef, columnRef, inVideo)

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      data-video-load={inVideo ? videoLoad : undefined}
      aria-labelledby="welcome-title"
      aria-describedby={welcome.message ? 'welcome-message' : undefined}
      onKeyDown={trapFocus}
      className="absolute inset-0 z-50 overflow-hidden bg-ink text-white"
    >
      <div
        aria-hidden
        className="absolute inset-0 scale-110 bg-cover bg-center"
        style={{
          backgroundImage: `url(${JSON.stringify(resolveImageUrl(imageUrl))})`,
          filter: 'blur(14px)',
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: 'var(--welcome-scrim)' }}
      />
      {!inVideo && <WelcomeSparkles />}

      {showSkip && (
        <Button
          variant="surface"
          size="sm"
          dense
          className="absolute z-10"
          style={{
            left: 'max(0.5rem, env(safe-area-inset-left, 0px))',
            top: 'max(0.5rem, env(safe-area-inset-top, 0px))',
          }}
          onClick={onDone}
        >
          {skipLabel}
        </Button>
      )}

      <div
        ref={viewRef}
        className="relative flex h-full flex-col overflow-y-auto overscroll-contain"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div
          ref={columnRef}
          className={`m-auto flex w-full max-w-2xl flex-col items-center gap-5 px-4 text-center ${
            inVideo ? 'py-4' : 'py-14'
          } ${dataSaver ? '' : 'welcome-in'}`}
        >
          {inVideo && src && video ? (
            <>
              <h1 id="welcome-title" className="sr-only">
                {title}
              </h1>
              <EnlargeableVideo
                src={src}
                title={text.videoTitle}
                frameRef={frameRef}
                frameClassName="video-panel"
                frameStyle={panelWidth === null ? undefined : { width: panelWidth }}
                onLoad={() => {
                  setVideoLoad((state) => nextVideoLoad(state, 'load'))
                  for (const message of subscribeMessages(video.provider))
                    frameRef.current?.contentWindow?.postMessage(
                      message,
                      playerOrigin(video.provider)
                    )
                }}
                actions={
                  <>
                    {videoLoad === 'failed' && (
                      <p role="status" className="w-full text-sm font-semibold text-white/90">
                        {text.videoFailed}
                      </p>
                    )}
                    <Button
                      ref={skipVideoRef}
                      variant="surface"
                      size="sm"
                      dense
                      onClick={finishVideo}
                    >
                      {text.skipVideo}
                    </Button>
                    {/* Always there, whatever the video does: loading, playing,
                        paused by the browser, blocked or failed. */}
                    <Button variant="secondary" size="sm" dense onClick={enter}>
                      {text.start}
                      <ArrowRight size={16} strokeWidth={3} aria-hidden />
                    </Button>
                  </>
                }
              />
            </>
          ) : (
            <>
              <h1
                id="welcome-title"
                className="font-heading text-3xl font-extrabold text-balance break-words sm:text-5xl"
              >
                {title}
              </h1>
              {welcome.message && (
                <p
                  id="welcome-message"
                  className="max-w-xl text-base font-semibold whitespace-pre-line break-words sm:text-lg"
                >
                  {welcome.message}
                </p>
              )}
              <div className="flex flex-col items-center gap-3 pt-2">
                <Button ref={primaryRef} variant="secondary" onClick={showPlay ? play : enter}>
                  {showPlay ? <Play size={18} strokeWidth={3} aria-hidden /> : null}
                  {labelOf('primary')}
                  {!showPlay && <ArrowRight size={18} strokeWidth={3} aria-hidden />}
                </Button>
                {labelOf('watch') && (
                  <button
                    type="button"
                    onClick={play}
                    className="min-h-[44px] px-3 text-sm font-bold underline underline-offset-4"
                  >
                    {labelOf('watch')}
                  </button>
                )}
                {hasMusic && track && (
                  <p className="flex max-w-full items-center gap-2 text-sm font-bold">
                    <span className="block h-11 w-11 shrink-0 overflow-hidden rounded-pill border border-white/60">
                      <NowPlayingDisc
                        cover={coverToLoad({
                          coverUrl: track.coverUrl,
                          dataSaver,
                          startedOnce: true,
                          failed: false,
                        })}
                        state={{
                          spinning: false,
                          muted: !musicOn,
                          badge: musicOn ? 'playing' : 'muted',
                        }}
                      />
                    </span>
                    <span className="min-w-0 truncate">{track.title}</span>
                  </p>
                )}
                {hasMusic && (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={musicOn}
                    aria-label={text.musicLabel}
                    disabled={isolated}
                    onClick={() => setMusicOn((value) => !value)}
                    className="flex min-h-[44px] items-center gap-2 rounded-pill border border-white/60 px-4 text-sm font-bold"
                  >
                    {musicOn ? (
                      <Volume2 size={16} strokeWidth={2.5} aria-hidden />
                    ) : (
                      <VolumeX size={16} strokeWidth={2.5} aria-hidden />
                    )}
                    {musicOn ? text.musicOn : text.musicOff}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        {(hostNote || onEnterFullscreen) && (
          <div
            className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
          >
            <p className="pointer-events-none min-w-0 flex-1 text-xs font-semibold break-words text-white/85">
              {hostNote}
            </p>
            {onEnterFullscreen && (
              <Button
                variant="surface"
                size="sm"
                dense
                className="ml-auto shrink-0"
                onClick={onEnterFullscreen}
              >
                <Maximize2 size={16} strokeWidth={2.5} aria-hidden />
                {labelOf('fullscreen')}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default WelcomeCurtain
