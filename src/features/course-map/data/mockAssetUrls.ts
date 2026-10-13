// Blob URLs for assets uploaded in mock mode. Kept apart from
// mockCourseMapApi.ts so data/assets.ts can read it without pulling the whole
// mock into a production bundle.
export const assetObjectUrls = new Map<string, string>()

// There's no backend to serve "/assets/{id}" from in mock mode, so
// resolveImageUrl/resolveThumbUrl (data/assets.ts) look the blob URL up here.
export const getMockAssetObjectUrl = (assetId: string): string | null =>
  assetObjectUrls.get(assetId) ?? null
