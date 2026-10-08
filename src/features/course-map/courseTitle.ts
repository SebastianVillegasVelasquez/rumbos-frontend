import type { CourseMapSummary } from "./data/types.ts";

// Derives a human course title from its levels' own titles (there's no
// separate "course" entity in the contract) - strips a trailing
// " — Nivel N" suffix when the first level follows that convention,
// otherwise falls back to the first level's own title.
export const courseTitleFrom = (levels: Pick<CourseMapSummary, "title">[]): string => {
    const first = levels[0]?.title ?? "";
    const stripped = first.replace(/\s*[—-]\s*Nivel\s*\d+\s*$/i, "");
    return stripped || first;
};
