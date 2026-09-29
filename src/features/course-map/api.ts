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
    return Promise.resolve({ ...mockCourseMap, courseId });
}

export function getActivities(): Promise<Activity[]> {
    return Promise.resolve(mockActivities);
}
