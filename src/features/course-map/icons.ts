// Fixed set of preset bubble icons. Deliberately NOT a free-form image/HTML
// upload system - see the sprint brief for why (XSS risk for a government
// client). Each icon is a small hand-authored flat SVG, inlined as a data
// URI so it can be loaded with use-image/Konva.Image like any other bitmap.

export const ICON_KEYS = ["question", "chest", "star", "flag", "book", "video", "trophy", "lock"] as const;

export type IconKey = (typeof ICON_KEYS)[number];

export const ICON_LABELS: Record<IconKey, string> = {
    question: "Question mark (default)",
    chest: "Chest",
    star: "Star",
    flag: "Flag",
    book: "Book",
    video: "Video",
    trophy: "Trophy",
    lock: "Lock",
};

const svgDataUri = (inner: string) =>
    `data:image/svg+xml;utf8,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${inner}</svg>`
    )}`;

// "question" has no entry here - it renders via the existing Konva Text "?"
// fallback in Bubble.tsx instead of an image, so untouched bubbles from
// before this feature keep rendering exactly as before.
export const ICON_DATA_URIS: Partial<Record<IconKey, string>> = {
    chest: svgDataUri(
        `<rect x="3" y="10" width="18" height="10" rx="1.5" fill="white"/>
         <path d="M3 10a9 5 0 0 1 18 0" fill="none" stroke="white" stroke-width="2"/>
         <rect x="10" y="12.5" width="4" height="3" rx="0.5" fill="#1f2937"/>`
    ),
    star: svgDataUri(
        `<path d="M12 2 L14.9 9.1 L22.5 9.1 L16.3 13.9 L18.6 21 L12 16.6 L5.4 21 L7.7 13.9 L1.5 9.1 L9.1 9.1 Z" fill="white"/>`
    ),
    flag: svgDataUri(
        `<line x1="5" y1="2" x2="5" y2="22" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
         <path d="M5 3 L20 7.5 L5 12 Z" fill="white"/>`
    ),
    book: svgDataUri(
        `<rect x="4" y="4" width="16" height="16" rx="1.5" fill="none" stroke="white" stroke-width="2"/>
         <line x1="12" y1="4" x2="12" y2="20" stroke="white" stroke-width="2"/>`
    ),
    video: svgDataUri(
        `<rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="white" stroke-width="2"/>
         <path d="M10 9 L16.5 12 L10 15 Z" fill="white"/>`
    ),
    trophy: svgDataUri(
        `<path d="M7 3h10v4a5 5 0 0 1-5 5 5 5 0 0 1-5-5V3z" fill="white"/>
         <path d="M9 12v2a3 3 0 0 0 6 0v-2" fill="none" stroke="white" stroke-width="2"/>
         <line x1="9" y1="21" x2="15" y2="21" stroke="white" stroke-width="2" stroke-linecap="round"/>
         <line x1="12" y1="17" x2="12" y2="21" stroke="white" stroke-width="2"/>`
    ),
    lock: svgDataUri(
        `<rect x="5" y="11" width="14" height="10" rx="2" fill="white"/>
         <path d="M8 11V7a4 4 0 0 1 8 0v4" fill="none" stroke="white" stroke-width="2.2"/>`
    ),
};
