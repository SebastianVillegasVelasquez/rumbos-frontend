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

const parseBody = (text: string): unknown => {
    if (!text) return undefined;
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
};

export async function apiRequest<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
    const { method = "GET", body } = options;
    let response: Response;
    try {
        response = await fetch(`${API_BASE_URL}${path}`, {
            method,
            headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
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
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
    let response: Response;
    try {
        response = await fetch(`${API_BASE_URL}${path}`, { method: "POST", body: form });
    } catch {
        throw new ApiError(0, undefined);
    }

    const parsed = parseBody(await response.text());
    if (!response.ok) throw new ApiError(response.status, parsed);
    return parsed as T;
}
