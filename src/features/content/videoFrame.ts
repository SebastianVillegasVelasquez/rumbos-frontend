// The one place that decides what a video iframe may do. The curtain, the video
// blocks and the editor's previews all spread this, so none can drift looser.

// Permissions delegated to the player (the host's own iframe must delegate them
// too, see docs/EMBED.md):
//  - autoplay: starts after the viewer's click on "Reproducir".
//  - fullscreen: the player's own fullscreen button.
//  - picture-in-picture: the player's own PiP button.
// Nothing else (no camera, microphone, clipboard, encrypted-media, ...).
export const VIDEO_FRAME_ALLOW = 'autoplay; fullscreen; picture-in-picture'

// Sandbox tokens, each one needed by the player:
//  - allow-scripts: the player is a script.
//  - allow-same-origin: it reads its own cookies and storage (without it the
//    player's origin is opaque and it fails to start).
//  - allow-presentation: casting and AirPlay from the player.
// Deliberately absent: allow-popups ("Mirar en YouTube" links do nothing),
// allow-forms, allow-top-navigation, allow-modals, allow-downloads. Fullscreen
// has no sandbox token; it is gated by `allow` alone.
export const VIDEO_FRAME_SANDBOX = 'allow-scripts allow-same-origin allow-presentation'

export const videoFrameAttributes = () =>
  ({
    allow: VIDEO_FRAME_ALLOW,
    allowFullScreen: true,
    referrerPolicy: 'strict-origin-when-cross-origin',
    sandbox: VIDEO_FRAME_SANDBOX,
  }) as const
