// PLACEHOLDER ILLUSTRATIONS. The matching task has a panel of scenes that the
// document draws; the designer did not deliver them. These are simple line icons in
// the Rumbos style (2 px ink strokes, flat fills from the tokens), chosen from the
// scene's own text. They must be replaced by the real art before launch (see
// docs/DECISIONS-trainer.md). The alt text is the scene's text from the content.

type Kind = 'hotel' | 'restaurant' | 'airport' | 'shop' | 'beach' | 'station' | 'generic'

const RULES: [RegExp, Kind][] = [
  [/hotel|room|reception|bed/i, 'hotel'],
  [/restaurant|caf[eé]|menu|table|lunch|dinner/i, 'restaurant'],
  [/airport|plane|flight|gate/i, 'airport'],
  [/shop|store|market|buy|souvenir/i, 'shop'],
  [/beach|sea|sun|swim/i, 'beach'],
  [/station|train|bus|taxi/i, 'station'],
]

const sceneKind = (text: string): Kind =>
  RULES.find(([pattern]) => pattern.test(text))?.[1] ?? 'generic'

const stroke = {
  stroke: 'var(--color-ink)',
  strokeWidth: 2.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

const drawings: Record<Kind, React.ReactNode> = {
  hotel: (
    <>
      <rect
        x="6"
        y="26"
        width="52"
        height="18"
        rx="3"
        fill="var(--color-primary-tint)"
        {...stroke}
      />
      <path d="M6 44v8M58 44v8M6 26v-10" {...stroke} />
      <rect x="12" y="18" width="16" height="8" rx="2" fill="var(--color-accent)" {...stroke} />
    </>
  ),
  restaurant: (
    <>
      <circle cx="32" cy="34" r="14" fill="var(--color-sun-tint)" {...stroke} />
      <path d="M10 14v14M14 14v14M18 14v14M14 28v22M50 14c-5 4-5 14 0 16v20" {...stroke} />
    </>
  ),
  airport: (
    <>
      <path
        d="M8 36l20-4-8-20h6l16 18 14-3c3 0 3 6 0 6l-14 3-16 18h-6l8-20-20-4z"
        fill="var(--color-primary-tint)"
        {...stroke}
      />
    </>
  ),
  shop: (
    <>
      <path d="M12 22h40l-3 32H15z" fill="var(--color-accent)" {...stroke} />
      <path d="M22 22v-4a10 10 0 0 1 20 0v4" {...stroke} />
    </>
  ),
  beach: (
    <>
      <circle cx="46" cy="18" r="8" fill="var(--color-accent)" {...stroke} />
      <path d="M4 46c6-6 10-6 16 0s10 6 16 0 10-6 16 0 6 6 8 4" {...stroke} />
      <path d="M4 56c6-6 10-6 16 0s10 6 16 0 10-6 16 0 6 6 8 4" {...stroke} />
    </>
  ),
  station: (
    <>
      <rect
        x="12"
        y="12"
        width="40"
        height="34"
        rx="6"
        fill="var(--color-primary-tint)"
        {...stroke}
      />
      <path d="M12 30h40M20 52l-4 6M44 52l4 6" {...stroke} />
      <circle cx="22" cy="38" r="2" fill="var(--color-ink)" />
      <circle cx="42" cy="38" r="2" fill="var(--color-ink)" />
    </>
  ),
  generic: (
    <>
      <path
        d="M32 58S12 38 12 26a20 20 0 0 1 40 0c0 12-20 32-20 32z"
        fill="var(--color-accent)"
        {...stroke}
      />
      <circle cx="32" cy="26" r="7" fill="var(--color-surface)" {...stroke} />
    </>
  ),
}

export const SceneIcon = ({ text, size = 56 }: { text: string; size?: number }) => (
  <svg
    role="img"
    aria-label={text}
    viewBox="0 0 64 64"
    width={size}
    height={size}
    focusable="false"
    data-placeholder="true"
  >
    <g fill="none">{drawings[sceneKind(text)]}</g>
  </svg>
)
