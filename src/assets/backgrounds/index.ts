// Bundled background registry: the "Predefinidos" tab of the background
// picker. Uploaded images live in the asset library instead; this list is only
// for demos.
//
// NOTE: the provenance of "default.avif" is unverified — it was already in the
// repo before this sprint. Do not add further third-party/commercial game
// art here; production backgrounds must be original work or properly
// licensed before this registry grows.

import defaultBackground from "./default.avif";

export interface BackgroundOption {
    id: string;
    label: string;
    url: string;
}

export const backgroundOptions: BackgroundOption[] = [
    { id: "default", label: "Paisaje por defecto", url: defaultBackground },
];

export const DEFAULT_BACKGROUND_URL = backgroundOptions[0].url;

// Bundled art has unverified provenance, so it must not be pickable in a
// production build. VITE_SHOW_BUNDLED_BACKGROUNDS=true|false overrides the
// default (true in dev, false in production builds).
const bundledFlag = import.meta.env.VITE_SHOW_BUNDLED_BACKGROUNDS;
export const SHOW_BUNDLED_BACKGROUNDS: boolean = bundledFlag ? bundledFlag === "true" : import.meta.env.DEV;
