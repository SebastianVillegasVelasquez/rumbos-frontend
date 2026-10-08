// Fixed set of preset bubble icons. Deliberately NOT a free-form image/HTML
// upload system - see the sprint brief for why (XSS risk for a government
// client). Each icon is a small hand-authored flat SVG, inlined as a data
// URI so it can be loaded with use-image/Konva.Image like any other bitmap.
//
// Two color variants exist because the "no_complete" bubble fill is the sun
// tone (#FFB703): a white icon on it fails WCAG contrast, so that status
// renders the dark-ink variant while every other (darker) status fill uses
// the white variant.

export const ICON_KEYS = ["question", "chest", "star", "flag", "book", "video", "trophy", "lock"] as const;

export type IconKey = (typeof ICON_KEYS)[number];

export const ICON_LABELS: Record<IconKey, string> = {
    question: "Pregunta (por defecto)",
    chest: "Cofre",
    star: "Estrella",
    flag: "Bandera",
    book: "Libro",
    video: "Video",
    trophy: "Trofeo",
    lock: "Candado",
};

// Derives a default icon from the Moodle module type when a bubble has no
// icon of its own, so every bubble reads as something other than "?".
const MODNAME_ICON: Record<string, IconKey> = {
    quiz: "question",
    scorm: "book",
    customcert: "trophy",
    assign: "flag",
    resource: "book",
    url: "video",
};

export const defaultIconForModname = (modname: string): IconKey => MODNAME_ICON[modname] ?? "star";

type IconPath = (color: string) => string;

const svgDataUri = (inner: IconPath, color: string) =>
    `data:image/svg+xml;utf8,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${inner(color)}</svg>`
    )}`;

const paths: Partial<Record<IconKey, IconPath>> = {
    chest: (c) =>
        `<rect x="3" y="10" width="18" height="10" rx="1.5" fill="${c}"/>
         <path d="M3 10a9 5 0 0 1 18 0" fill="none" stroke="${c}" stroke-width="2"/>
         <rect x="10" y="12.5" width="4" height="3" rx="0.5" fill="#1f2937"/>`,
    star: (c) => `<path d="M12 2 L14.9 9.1 L22.5 9.1 L16.3 13.9 L18.6 21 L12 16.6 L5.4 21 L7.7 13.9 L1.5 9.1 L9.1 9.1 Z" fill="${c}"/>`,
    flag: (c) =>
        `<line x1="5" y1="2" x2="5" y2="22" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
         <path d="M5 3 L20 7.5 L5 12 Z" fill="${c}"/>`,
    book: (c) =>
        `<rect x="4" y="4" width="16" height="16" rx="1.5" fill="none" stroke="${c}" stroke-width="2"/>
         <line x1="12" y1="4" x2="12" y2="20" stroke="${c}" stroke-width="2"/>`,
    video: (c) =>
        `<rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="${c}" stroke-width="2"/>
         <path d="M10 9 L16.5 12 L10 15 Z" fill="${c}"/>`,
    trophy: (c) =>
        `<path d="M7 3h10v4a5 5 0 0 1-5 5 5 5 0 0 1-5-5V3z" fill="${c}"/>
         <path d="M9 12v2a3 3 0 0 0 6 0v-2" fill="none" stroke="${c}" stroke-width="2"/>
         <line x1="9" y1="21" x2="15" y2="21" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
         <line x1="12" y1="17" x2="12" y2="21" stroke="${c}" stroke-width="2"/>`,
    lock: (c) =>
        `<rect x="5" y="11" width="14" height="10" rx="2" fill="${c}"/>
         <path d="M8 11V7a4 4 0 0 1 8 0v4" fill="none" stroke="${c}" stroke-width="2.2"/>`,
};

const buildVariant = (color: string) => {
    const uris: Partial<Record<IconKey, string>> = {};
    for (const key of ICON_KEYS) {
        const path = paths[key];
        if (path) uris[key] = svgDataUri(path, color);
    }
    return uris;
};

// "question" has no entry - it renders via the existing Konva Text "?"
// fallback in BubbleVisual.tsx instead of an image.
export const ICON_DATA_URIS_LIGHT: Partial<Record<IconKey, string>> = buildVariant("white");
export const ICON_DATA_URIS_DARK: Partial<Record<IconKey, string>> = buildVariant("#1E2A4A");

// Arbitrary-color variant, for a procedural skin's icon.color (which can be
// any hex, not just the two precomputed light/dark variants above).
export const iconDataUri = (icon: IconKey, color: string): string | null => {
    const path = paths[icon];
    return path ? svgDataUri(path, color) : null;
};
