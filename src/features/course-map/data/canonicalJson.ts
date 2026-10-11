// Deterministic JSON (object keys sorted at every depth) so two structurally
// equal values always serialize, and therefore hash, identically. The mock API
// uses it to derive the draft hash that PublishDialog sends back as `draftHash`.
export const canonicalJson = (value: unknown): string => {
    if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
    if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item === undefined ? null : item)).join(",")}]`;
    const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
};

const toHex = (buffer: ArrayBuffer) =>
    Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");

export const sha256Hex = async (input: string | ArrayBuffer): Promise<string> => {
    const data = typeof input === "string" ? new TextEncoder().encode(input) : input;
    return toHex(await crypto.subtle.digest("SHA-256", data));
};
