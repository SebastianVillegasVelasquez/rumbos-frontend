import { API_BASE_URL } from "./client.ts";
import { getMockAssetObjectUrl } from "./mockCourseMapApi.ts";

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === "true";

const assetId = (path: string) => path.slice("/assets/".length).split("/")[0];

// A map's imageUrl / skin state asset reference may be a bundled frontend
// path ("/assets/{id}" or a bundled import) or an uploaded asset ("/assets/{id}"). Only the
// latter needs resolving: against the API base URL in real mode, or against
// the mock's in-memory blob object URL store in mock mode (there's no
// backend to serve "/assets/{id}" from).
export const resolveImageUrl = (url: string): string => {
    if (!url.startsWith("/assets/")) return url;
    if (USE_MOCK) return getMockAssetObjectUrl(assetId(url)) ?? url;
    return `${API_BASE_URL}${url}`;
};

export const resolveThumbUrl = (url: string): string => {
    if (!url.startsWith("/assets/")) return url;
    if (USE_MOCK) return getMockAssetObjectUrl(assetId(url)) ?? url;
    return `${API_BASE_URL}${url}/thumb`;
};
