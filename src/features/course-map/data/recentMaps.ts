// Local-only history of opened course maps, keyed by browser. There is no
// backend endpoint to list or search maps by moodleCourseId, so this is how a
// teacher gets back to a map they already created without memorizing its UUID.

import type { CourseMapSummary } from "./types.ts";

const STORAGE_KEY = "rumbos:recent-course-maps";
const MAX_ENTRIES = 8;

export interface RecentCourseMap {
    id: string;
    moodleCourseId: number;
    imageUrl: string;
    openedAt: string;
}

const readAll = (): RecentCourseMap[] => {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

export const getRecentCourseMaps = (): RecentCourseMap[] =>
    readAll().sort((a, b) => b.openedAt.localeCompare(a.openedAt));

export const rememberCourseMap = (map: Pick<CourseMapSummary, "id" | "moodleCourseId" | "imageUrl">) => {
    const rest = readAll().filter((entry) => entry.id !== map.id);
    const next = [{ ...map, openedAt: new Date().toISOString() }, ...rest].slice(0, MAX_ENTRIES);
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
        // Storage unavailable (private mode, quota). The history is a
        // convenience, so silently skip persisting it.
    }
};

export const forgetCourseMap = (id: string) => {
    const next = readAll().filter((entry) => entry.id !== id);
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
        // Same as above: non-fatal.
    }
};
