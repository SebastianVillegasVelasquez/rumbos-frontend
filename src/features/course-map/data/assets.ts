import { API_BASE_URL } from "./client.ts";
import { getMockAssetObjectUrl } from "./mockCourseMapApi.ts";

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === "true";

const assetId = (path: string) => path.slice("/assets/".length).split("/")[0];

// Uploaded assets are "/assets/{uuid}". A production build also emits bundled
// files under "/assets/" (e.g. "/assets/default-3fa9c1.avif"), so a bare
// "/assets/" prefix is not enough to tell the two apart.
const ASSET_PATH = /^\/assets\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\/thumb)?$/i;
export const isAssetPath = (url: string) => ASSET_PATH.test(url);

// A map's imageUrl / skin state asset reference may be a bundled frontend
// path ("/assets/{id}" or a bundled import) or an uploaded asset ("/assets/{id}"). Only the
// latter needs resolving: against the API base URL in real mode, or against
// the mock's in-memory blob object URL store in mock mode (there's no
// backend to serve "/assets/{id}" from).
export const resolveImageUrl = (url: string): string => {
    if (!isAssetPath(url)) return url;
    if (USE_MOCK) return getMockAssetObjectUrl(assetId(url)) ?? url;
    return `${API_BASE_URL}${url}`;
};

export const resolveThumbUrl = (url: string): string => {
    if (!isAssetPath(url)) return url;
    if (USE_MOCK) return getMockAssetObjectUrl(assetId(url)) ?? url;
    return `${API_BASE_URL}${url}/thumb`;
};
