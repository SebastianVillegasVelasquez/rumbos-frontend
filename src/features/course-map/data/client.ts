import type { ApiErrorDetail } from "./types.ts";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export class ApiError extends Error {
    readonly status: number;
    readonly body: unknown;

    constructor(status: number, body: unknown) {
        super(`Request failed with status ${status}`);
        this.name = "ApiError";
        this.status = status;
        this.body = body;
    }

    // Business errors use `detail = { code, message, ...extras }`. Falls back
    // to a generic code when the body doesn't match that shape (network
    // errors, plain-text 5xx responses, etc).
    get detail(): ApiErrorDetail {
        const body = this.body;
        if (body && typeof body === "object" && "code" in body && "message" in body) {
            return body as ApiErrorDetail;
        }
        return { code: "unknown_error", message: typeof body === "string" ? body : this.message };
    }
}

// Status 0 means the request never got a response (backend down, network).
export const isUnreachable = (error: unknown) => error instanceof ApiError && error.status === 0;

// 412 version_conflict: someone else changed the guarded resource first.
export const isVersionConflict = (error: unknown) => error instanceof ApiError && error.status === 412;

// 428 precondition_required: the client forgot If-Match. Always a client bug.
export const isPreconditionRequired = (error: unknown) => error instanceof ApiError && error.status === 428;

const parseBody = (text: string): unknown => {
    if (!text) return undefined;
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
};

// Guarded endpoints (contract v3) take the revision/version the client last
// saw as a quoted-number If-Match header.
const ifMatchHeader = (ifMatch: number) => `"${ifMatch}"`;

export async function apiRequest<T>(
    path: string,
    options: { method?: string; body?: unknown; ifMatch?: number } = {}
): Promise<T> {
    const { method = "GET", body, ifMatch } = options;
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (ifMatch !== undefined) headers["If-Match"] = ifMatchHeader(ifMatch);
    let response: Response;
    try {
        response = await fetch(`${API_BASE_URL}${path}`, {
            method,
            headers: Object.keys(headers).length > 0 ? headers : undefined,
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
    } catch {
        throw new ApiError(0, undefined);
    }

    if (response.status === 204) return undefined as T;

    const parsed = parseBody(await response.text());
    if (!response.ok) throw new ApiError(response.status, parsed);
    return parsed as T;
}

// Multipart upload for /assets. Separate from apiRequest because the body is
// FormData, not JSON (no Content-Type header: the browser sets the boundary).
// Also reports the HTTP status, since /assets answers 201 for new content and
// 200 when identical content already existed.
export async function apiUpload<T>(path: string, form: FormData): Promise<{ data: T; status: number }> {
    let response: Response;
    try {
        response = await fetch(`${API_BASE_URL}${path}`, { method: "POST", body: form });
    } catch {
        throw new ApiError(0, undefined);
    }

    const parsed = parseBody(await response.text());
    if (!response.ok) throw new ApiError(response.status, parsed);
    return { data: parsed as T, status: response.status };
}
