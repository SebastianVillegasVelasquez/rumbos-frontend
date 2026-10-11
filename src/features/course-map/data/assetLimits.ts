import type { AssetKind, AssetUsage } from "./types.ts";

// Upload limits from the API contract. The client checks them first so people
// get an instant, specific message instead of waiting for a 413/422.
export const ASSET_LIMITS: Record<AssetKind, { maxBytes: number; maxSide: number }> = {
    background: { maxBytes: 8 * 1024 * 1024, maxSide: 8192 },
    bubble: { maxBytes: 2 * 1024 * 1024, maxSide: 1024 },
};

export const ALLOWED_IMAGE_MIME = ["image/png", "image/jpeg", "image/webp"] as const;
export const TITLE_MAX_LENGTH = 120;
export const CREDIT_MAX_LENGTH = 300;

export type UploadCheckError = "notImage" | "tooLarge" | "tooBig";

export const checkFileBasics = (file: { type: string; size: number }, kind: AssetKind): UploadCheckError | null => {
    if (!(ALLOWED_IMAGE_MIME as readonly string[]).includes(file.type)) return "notImage";
    if (file.size > ASSET_LIMITS[kind].maxBytes) return "tooLarge";
    return null;
};

export const checkDimensions = (width: number, height: number, kind: AssetKind): UploadCheckError | null =>
    width > ASSET_LIMITS[kind].maxSide || height > ASSET_LIMITS[kind].maxSide ? "tooBig" : null;

export const isAssetInUse = (usage: AssetUsage) => usage.maps + usage.skins + usage.publications > 0;

// Width/height ratios differ "enough" to warrant a warning above this relative
// difference (5%), measured against the current ratio.
export const ASPECT_WARNING_THRESHOLD = 0.05;

export const aspectRatiosDiffer = (current: number, next: number) =>
    current > 0 && Math.abs(current - next) / current > ASPECT_WARNING_THRESHOLD;
