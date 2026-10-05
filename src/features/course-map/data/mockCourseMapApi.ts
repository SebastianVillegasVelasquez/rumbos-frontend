import { ApiError } from "./client.ts";
import type { CourseMapApi } from "./courseMapApi.ts";
import type {
    Activity,
    Bubble,
    BubbleCreate,
    BubbleUpdate,
    CourseMapCreate,
    CourseMapDetail,
    CourseMapSummary,
} from "./types.ts";

// In-memory stand-in for the backend, enabled with VITE_USE_MOCK_API=true so
// demos run without a server. Mirrors the backend's rules, including that it
// does not reject a second bubble for the same activity.

const DEFAULT_IMAGE_URL = "/fondo.webp";
const MOCK_MODULE_URL = "https://moodle.example.com/mod/";

const newId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `mock-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const now = () => new Date().toISOString();

interface MockActivity {
    activityId: number;
    name: string;
    modname: string;
    sectionName: string;
    sectionNumber: number;
    hidden: boolean;
}

const mockModules: MockActivity[] = [
    { activityId: 101, name: "Introduction Quiz", modname: "quiz", sectionName: "Week 1", sectionNumber: 1, hidden: false },
    { activityId: 102, name: "Welcome Video", modname: "url", sectionName: "Week 1", sectionNumber: 1, hidden: false },
    { activityId: 103, name: "Assignment 1: Environment Setup", modname: "assign", sectionName: "Week 2", sectionNumber: 2, hidden: false },
    { activityId: 104, name: "Course Syllabus", modname: "resource", sectionName: "Week 2", sectionNumber: 2, hidden: false },
    { activityId: 105, name: "Midterm Quiz", modname: "quiz", sectionName: "Week 3", sectionNumber: 3, hidden: false },
    { activityId: 106, name: "Lecture Recording: Week 3", modname: "url", sectionName: "Week 3", sectionNumber: 3, hidden: false },
    { activityId: 107, name: "Final Project Submission", modname: "assign", sectionName: "Week 4", sectionNumber: 4, hidden: true },
];

interface MockState {
    map: CourseMapSummary;
    bubbles: Bubble[];
}

const createState = (): MockState => {
    const timestamp = now();
    const id = newId();
    const seeded = [
        { activityId: 101, x: 0.18, y: 0.72, status: "complete" },
        { activityId: 102, x: 0.36, y: 0.45, status: "complete" },
        { activityId: 103, x: 0.52, y: 0.68, status: "in_progress" },
        { activityId: 105, x: 0.68, y: 0.38, status: "no_complete" },
        { activityId: 107, x: 0.84, y: 0.6, status: "locked" },
    ] as const;
    return {
        map: { id, moodleCourseId: 1, imageUrl: DEFAULT_IMAGE_URL, createdAt: timestamp, updatedAt: timestamp },
        bubbles: seeded.map((bubble) => ({
            id: newId(),
            courseMapId: id,
            activityId: bubble.activityId,
            x: bubble.x,
            y: bubble.y,
            icon: null,
            status: bubble.status,
            createdAt: timestamp,
            updatedAt: timestamp,
        })),
    };
};

let state: MockState = createState();

const notFound = (detail: string) => new ApiError(404, { detail });

const requireMap = (courseMapId: string) => {
    if (state.map.id !== courseMapId) throw notFound("Course map not found");
    return state.map;
};

const requireBubble = (bubbleId: string) => {
    const bubble = state.bubbles.find((item) => item.id === bubbleId);
    if (!bubble) throw notFound("Bubble not found");
    return bubble;
};

export const mockCourseMapApi: CourseMapApi = {
    async createCourseMap(input: CourseMapCreate) {
        if (state.map.moodleCourseId === input.moodleCourseId) {
            throw new ApiError(409, { detail: "A course map already exists for this course" });
        }
        const timestamp = now();
        state = {
            map: { id: newId(), moodleCourseId: input.moodleCourseId, imageUrl: input.imageUrl, createdAt: timestamp, updatedAt: timestamp },
            bubbles: [],
        };
        return state.map;
    },

    async getCourseMap(courseMapId: string): Promise<CourseMapDetail> {
        const map = requireMap(courseMapId);
        return { ...map, bubbles: state.bubbles.filter((bubble) => bubble.courseMapId === map.id) };
    },

    async getActivities(courseMapId: string, includeHidden: boolean): Promise<Activity[]> {
        requireMap(courseMapId);
        const placedBy = new Map(state.bubbles.map((bubble) => [bubble.activityId, bubble.id]));
        return mockModules
            .filter((module) => includeHidden || !module.hidden)
            .map((module) => ({
                activityId: module.activityId,
                name: module.name,
                modname: module.modname,
                url: `${MOCK_MODULE_URL}${module.modname}/view.php?id=${module.activityId}`,
                sectionName: module.sectionName,
                sectionNumber: module.sectionNumber,
                hidden: module.hidden,
                placed: placedBy.has(module.activityId),
                bubbleId: placedBy.get(module.activityId) ?? null,
            }));
    },

    async createBubble(courseMapId: string, input: BubbleCreate): Promise<Bubble> {
        const map = requireMap(courseMapId);
        const timestamp = now();
        const bubble: Bubble = {
            id: newId(),
            courseMapId: map.id,
            activityId: input.activityId,
            x: input.x,
            y: input.y,
            icon: input.icon ?? null,
            status: "locked",
            createdAt: timestamp,
            updatedAt: timestamp,
        };
        state = { ...state, bubbles: [...state.bubbles, bubble] };
        return bubble;
    },

    async updateBubble(courseMapId: string, bubbleId: string, input: BubbleUpdate): Promise<Bubble> {
        requireMap(courseMapId);
        const current = requireBubble(bubbleId);
        const updated: Bubble = { ...current, ...input, updatedAt: now() };
        state = { ...state, bubbles: state.bubbles.map((bubble) => (bubble.id === bubbleId ? updated : bubble)) };
        return updated;
    },

    async deleteBubble(courseMapId: string, bubbleId: string): Promise<void> {
        requireMap(courseMapId);
        requireBubble(bubbleId);
        state = { ...state, bubbles: state.bubbles.filter((bubble) => bubble.id !== bubbleId) };
    },
};
