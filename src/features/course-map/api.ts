import type { Activity, CourseMap } from "./types/course-props.types.ts";
import backgroundImage from "../../assets/fondo.webp";

// Mocked data layer. Shaped exactly like a future FastAPI response so
// swapping these for real fetch calls later only touches this file.

const mockActivities: Activity[] = [
    { id: 1, name: "Introduction Quiz", type: "quiz" },
    { id: 2, name: "Welcome Video", type: "url" },
    { id: 3, name: "Assignment 1: Environment Setup", type: "assign" },
    { id: 4, name: "Course Syllabus", type: "resource" },
    { id: 5, name: "Midterm Quiz", type: "quiz" },
    { id: 6, name: "Lecture Recording: Week 3", type: "url" },
    { id: 7, name: "Final Project Submission", type: "assign" },
];

const mockCourseMap: CourseMap = {
    courseId: 1,
    imageUrl: backgroundImage,
    bubbles: [
        { bubbleId: 1, activityId: 1, x: 0.18, y: 0.72, status: "complete" },
        { bubbleId: 2, activityId: 2, x: 0.36, y: 0.45, status: "complete" },
        { bubbleId: 3, activityId: 3, x: 0.52, y: 0.68, status: "in_progress" },
        { bubbleId: 4, activityId: 5, x: 0.68, y: 0.38, status: "no_complete" },
        { bubbleId: 5, activityId: 7, x: 0.84, y: 0.6, status: "locked" },
    ],
};

export function getCourseMap(courseId: number): Promise<CourseMap> {
    const stored = readStoredCourseMap();
    if (stored) return Promise.resolve(stored);
    return Promise.resolve({ ...mockCourseMap, courseId });
}

export function getActivities(): Promise<Activity[]> {
    return Promise.resolve(mockActivities);
}

// -----------------------------------------------------------------------
// TEMPORARY, DEV-ONLY PERSISTENCE - DO NOT TREAT THIS AS REAL STORAGE.
//
// This persists the course map to the current browser's localStorage so
// bubble placement survives a page refresh while developing/demoing
// locally. It is per-browser, not shared between users viewing the "same"
// course, has no versioning or conflict handling, and will be replaced by
// real backend persistence once one exists. Components only ever call
// getCourseMap/saveCourseMap/resetCourseMap - they don't know or care that
// this is localStorage today.
// -----------------------------------------------------------------------
const STORAGE_KEY = "rumbos:course-map";

function readStoredCourseMap(): CourseMap | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as CourseMap) : null;
    } catch {
        return null;
    }
}

export function saveCourseMap(courseMap: CourseMap): Promise<void> {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(courseMap));
    } catch {
        // Storage unavailable (private browsing, quota, ...) - this is a dev
        // convenience, not a guarantee, so fail silently.
    }
    return Promise.resolve();
}

export function resetCourseMap(): void {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        // ignore
    }
}
