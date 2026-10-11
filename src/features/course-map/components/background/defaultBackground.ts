import { DEFAULT_BACKGROUND_URL, SHOW_BUNDLED_BACKGROUNDS, backgroundOptions } from "../../../../assets/backgrounds/index.ts";
import type { BackgroundChoice } from "./BackgroundField.tsx";

// A new level starts on the bundled default only where bundled art may be
// picked; in production people must choose (or upload) a library image first.
export const DEFAULT_BACKGROUND_CHOICE: BackgroundChoice | null = SHOW_BUNDLED_BACKGROUNDS
    ? { imageUrl: DEFAULT_BACKGROUND_URL, label: backgroundOptions[0].label }
    : null;
