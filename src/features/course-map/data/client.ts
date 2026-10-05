const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export class ApiError extends Error {
    readonly status: number;
    readonly body: unknown;

    constructor(status: number, body: unknown) {
        super(`Request failed with status ${status}`);
        this.name = "ApiError";
        this.status = status;
        this.body = body;
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
