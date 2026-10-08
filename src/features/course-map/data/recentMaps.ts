// Local-only history of opened course maps, keyed by browser. Now that
// GET /course-maps exists, this is purely the per-viewer "Continuar donde lo
// dejaste" convenience on the home screen, not the primary way to find a map.

import type { CourseMapRead } from "./types.ts";

const STORAGE_KEY = "rumbos:recent-course-maps";
const MAX_ENTRIES = 8;

export interface RecentCourseMap {
    id: string;
    title: string;
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

export const rememberCourseMap = (map: Pick<CourseMapRead, "id" | "title" | "moodleCourseId" | "imageUrl">) => {
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
