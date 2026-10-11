import { ApiError, isUnreachable } from "../../data/client.ts";
import { es } from "../../../../i18n/es.ts";
import type { AssetUsage } from "../../data/types.ts";

const manage = es.background.manage;

// "2 mapas y 1 publicación", "1 mapa, 1 estilo de burbuja y 3 publicaciones".
export const describeUsage = (usage: AssetUsage): string => {
    const parts = [
        usage.maps > 0 ? manage.usageMaps(usage.maps) : null,
        usage.skins > 0 ? manage.usageSkins(usage.skins) : null,
        usage.publications > 0 ? manage.usagePublications(usage.publications) : null,
    ].filter((part): part is string => part !== null);
    if (parts.length <= 1) return parts[0] ?? "";
    return `${parts.slice(0, -1).join(", ")}${manage.and}${parts[parts.length - 1]}`;
};

export const inUseMessage = (usage: AssetUsage) => manage.inUse(describeUsage(usage));

const isUsage = (value: unknown): value is AssetUsage =>
    typeof value === "object" &&
    value !== null &&
    typeof (value as AssetUsage).maps === "number" &&
    typeof (value as AssetUsage).skins === "number" &&
    typeof (value as AssetUsage).publications === "number";

// The usage the backend attached to a 409 asset_in_use, if this is one.
export const usageFromConflict = (error: unknown): AssetUsage | null =>
    error instanceof ApiError && error.status === 409 && error.detail.code === "asset_in_use" && isUsage(error.detail.usage)
        ? error.detail.usage
        : null;

const uploadErrors = es.background.upload.errors;

export const uploadErrorMessage = (error: unknown): string => {
    if (isUnreachable(error)) return uploadErrors.unreachable;
    if (!(error instanceof ApiError)) return uploadErrors.unknown_error;
    const code = error.detail.code;
    if (code in uploadErrors && typeof uploadErrors[code as keyof typeof uploadErrors] === "string") {
        return uploadErrors[code as keyof typeof uploadErrors] as string;
    }
    // Statuses the contract names, for backends that omit the code.
    if (error.status === 413) return uploadErrors.asset_too_large;
    if (error.status === 503) return uploadErrors.uploads_disabled;
    if (error.status === 507) return uploadErrors.asset_quota_exceeded;
    return uploadErrors.unknown_error;
};

export const applyBackgroundErrorMessage = (error: unknown): string => {
    if (error instanceof ApiError) {
        const code = error.detail.code;
        if (code === "background_asset_not_found") return es.background.errors.background_asset_not_found;
        if (code === "background_asset_wrong_kind") return es.background.errors.background_asset_wrong_kind;
    }
    return es.background.errors.generic;
};
