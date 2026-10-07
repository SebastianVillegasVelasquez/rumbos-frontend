// Bundled background registry for the map-create dialog. Image upload does
// not exist yet (out of scope this sprint), so a new map's background is
// chosen from this fixed list.
//
// NOTE: the provenance of "/fondo.webp" is unverified — it was already in the
// repo before this sprint. Do not add further third-party/commercial game
// art here; production backgrounds must be original work or properly
// licensed before this registry grows.
export interface BackgroundOption {
    id: string;
    label: string;
    url: string;
}

export const backgroundOptions: BackgroundOption[] = [
    { id: "default", label: "Paisaje por defecto", url: "/fondo.webp" },
];

export const DEFAULT_BACKGROUND_URL = backgroundOptions[0].url;
