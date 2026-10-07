import { ApiError } from "./client.ts";
import type { CourseMapApi } from "./courseMapApi.ts";
import type {
    Activity,
    Availability,
    Bubble,
    BubbleCreate,
    BubbleUpdate,
    CourseMapCreate,
    CourseMapListParams,
    CourseMapListResult,
    CourseMapPatch,
    CourseMapRead,
    CourseMapSummary,
    MoodleStatus,
    ResolvedBubble,
    ResolvedCourseMap,
} from "./types.ts";

// In-memory stand-in for the backend, enabled with VITE_USE_MOCK_API=true so
// demos run without a server. Mirrors the backend's rules: multiple maps, one
// per Moodle course, list/search/paginate, and a /resolved endpoint whose
// Moodle-connectivity outcome can be forced with ?mockMoodle=down|hidden|missing|cached
// for demoing every availability state without a real Moodle instance.

const DEFAULT_IMAGE_URL = "/fondo.webp";
const MOCK_MODULE_URL = "https://moodle.example.com/mod/";
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

const newId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `mock-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const now = () => new Date().toISOString();

const mockMoodleOverride = (): "down" | "hidden" | "missing" | "cached" | null => {
    if (typeof window === "undefined") return null;
    const value = new URLSearchParams(window.location.search).get("mockMoodle");
    return value === "down" || value === "hidden" || value === "missing" || value === "cached" ? value : null;
};

interface MockActivity {
    activityId: number;
    name: string;
    modname: string;
    sectionName: string;
    sectionNumber: number;
    hidden: boolean;
}

const mockModules: MockActivity[] = [
    { activityId: 101, name: "Quiz de introducción", modname: "quiz", sectionName: "Semana 1", sectionNumber: 1, hidden: false },
    { activityId: 102, name: "Video de bienvenida", modname: "url", sectionName: "Semana 1", sectionNumber: 1, hidden: false },
    { activityId: 103, name: "Taller 1: configuración del entorno", modname: "assign", sectionName: "Semana 2", sectionNumber: 2, hidden: false },
    { activityId: 104, name: "Guía del curso", modname: "resource", sectionName: "Semana 2", sectionNumber: 2, hidden: false },
    { activityId: 105, name: "Quiz de mitad de curso", modname: "quiz", sectionName: "Semana 3", sectionNumber: 3, hidden: false },
    { activityId: 106, name: "Grabación: Semana 3", modname: "url", sectionName: "Semana 3", sectionNumber: 3, hidden: false },
    { activityId: 107, name: "Entrega de proyecto final", modname: "assign", sectionName: "Semana 4", sectionNumber: 4, hidden: true },
    { activityId: 108, name: "Certificado del curso", modname: "customcert", sectionName: "Semana 4", sectionNumber: 4, hidden: false },
    { activityId: 109, name: "Contenido SCORM: fundamentos", modname: "scorm", sectionName: "Semana 2", sectionNumber: 2, hidden: false },
];

interface MockMap {
    id: string;
    title: string;
    moodleCourseId: number;
    imageUrl: string;
    bubbles: Bubble[];
    createdAt: string;
    updatedAt: string;
}

const seedMap = (title: string, moodleCourseId: number, bubbleSpecs: ReadonlyArray<{ activityId: number; x: number; y: number; status: Bubble["status"] }>, imageUrl = DEFAULT_IMAGE_URL): MockMap => {
    const timestamp = now();
    const id = newId();
    return {
        id,
        title,
        moodleCourseId,
        imageUrl,
        createdAt: timestamp,
        updatedAt: timestamp,
        bubbles: bubbleSpecs.map((spec) => ({
            id: newId(),
            courseMapId: id,
            activityId: spec.activityId,
            x: spec.x,
            y: spec.y,
            icon: null,
            status: spec.status,
            createdAt: timestamp,
            updatedAt: timestamp,
        })),
    };
};

const createInitialMaps = (): MockMap[] => [
    seedMap("Fundamentos de programación", 1, [
        { activityId: 101, x: 0.18, y: 0.72, status: "complete" },
        { activityId: 102, x: 0.36, y: 0.45, status: "complete" },
        { activityId: 103, x: 0.52, y: 0.68, status: "in_progress" },
        { activityId: 105, x: 0.68, y: 0.38, status: "no_complete" },
        { activityId: 107, x: 0.84, y: 0.6, status: "locked" },
    ]),
    seedMap("Matemáticas para datos", 2, [
        { activityId: 101, x: 0.22, y: 0.4, status: "complete" },
        { activityId: 104, x: 0.5, y: 0.55, status: "no_complete" },
    ]),
    seedMap("Historia regional", 3, [
        { activityId: 102, x: 0.3, y: 0.5, status: "in_progress" },
        { activityId: 106, x: 0.55, y: 0.3, status: "locked" },
        { activityId: 108, x: 0.75, y: 0.65, status: "locked" },
    ]),
    seedMap("Ciudadanía digital", 4, [
        { activityId: 109, x: 0.4, y: 0.5, status: "no_complete" },
    ]),
];

let maps: MockMap[] = createInitialMaps();

const notFound = (detail: string) => new ApiError(404, { detail });

const requireMap = (courseMapId: string) => {
    const map = maps.find((item) => item.id === courseMapId);
    if (!map) throw notFound("Course map not found");
    return map;
};

const requireBubble = (map: MockMap, bubbleId: string) => {
    const bubble = map.bubbles.find((item) => item.id === bubbleId);
    if (!bubble) throw notFound("Bubble not found");
    return bubble;
};

const toSummary = (map: MockMap): CourseMapSummary => ({
    id: map.id,
    title: map.title,
    moodleCourseId: map.moodleCourseId,
    imageUrl: map.imageUrl,
    bubbleCount: map.bubbles.length,
    createdAt: map.createdAt,
    updatedAt: map.updatedAt,
});

const toRead = (map: MockMap): CourseMapRead => ({
    id: map.id,
    title: map.title,
    moodleCourseId: map.moodleCourseId,
    imageUrl: map.imageUrl,
    bubbles: map.bubbles,
    createdAt: map.createdAt,
    updatedAt: map.updatedAt,
});

const activityFor = (activityId: number): Activity | null => {
    const module = mockModules.find((item) => item.activityId === activityId);
    if (!module) return null;
    return {
        activityId: module.activityId,
        name: module.name,
        modname: module.modname,
        url: `${MOCK_MODULE_URL}${module.modname}/view.php?id=${module.activityId}`,
        sectionName: module.sectionName,
        sectionNumber: module.sectionNumber,
        hidden: module.hidden,
        placed: true,
        bubbleId: null,
    };
};

export const mockCourseMapApi: CourseMapApi = {
    async listCourseMaps(params: CourseMapListParams): Promise<CourseMapListResult> {
        const limit = Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
        const offset = params.offset ?? 0;
        const q = params.q?.trim().toLowerCase();
        const filtered = maps
            .filter((map) => params.moodleCourseId === undefined || map.moodleCourseId === params.moodleCourseId)
            .filter((map) => !q || map.title.toLowerCase().includes(q))
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        return {
            items: filtered.slice(offset, offset + limit).map(toSummary),
            total: filtered.length,
            limit,
            offset,
        };
    },

    async createCourseMap(input: CourseMapCreate): Promise<CourseMapSummary> {
        if (maps.some((map) => map.moodleCourseId === input.moodleCourseId)) {
            throw new ApiError(409, { code: "map_already_exists_for_course", message: "Ya existe un mapa para este curso" });
        }
        const title = input.title.trim().slice(0, 120);
        const map = seedMap(title, input.moodleCourseId, [], input.imageUrl);
        maps = [...maps, map];
        return toSummary(map);
    },

    async getCourseMap(courseMapId: string): Promise<CourseMapRead> {
        return toRead(requireMap(courseMapId));
    },

    async patchCourseMap(courseMapId: string, input: CourseMapPatch): Promise<CourseMapRead> {
        const map = requireMap(courseMapId);
        const updated: MockMap = {
            ...map,
            title: input.title !== undefined ? input.title.trim().slice(0, 120) : map.title,
            imageUrl: input.imageUrl ?? map.imageUrl,
            updatedAt: now(),
        };
        maps = maps.map((item) => (item.id === courseMapId ? updated : item));
        return toRead(updated);
    },

    async deleteCourseMap(courseMapId: string): Promise<void> {
        requireMap(courseMapId);
        maps = maps.filter((item) => item.id !== courseMapId);
    },

    async getResolvedCourseMap(courseMapId: string, includeHidden: boolean): Promise<ResolvedCourseMap> {
        const map = requireMap(courseMapId);
        const override = mockMoodleOverride();

        if (override === "down") {
            return {
                moodleStatus: "unavailable",
                bubbles: map.bubbles.map((bubble) => ({ bubbleId: bubble.id, availability: "unknown", activity: null })),
            };
        }

        const moodleStatus: MoodleStatus = override === "cached" ? "cached" : "live";

        const bubbles: ResolvedBubble[] = map.bubbles.map((bubble) => {
            const module = mockModules.find((item) => item.activityId === bubble.activityId);

            let availability: Availability;
            if (override === "hidden") availability = "hidden";
            else if (override === "missing") availability = "missing";
            else if (!module) availability = "missing";
            else if (module.hidden) availability = "hidden";
            else availability = "available";

            const showActivity = availability === "available" || (includeHidden && availability === "hidden");
            const activity = showActivity ? activityFor(bubble.activityId) : null;
            if (activity) activity.bubbleId = bubble.id;

            return { bubbleId: bubble.id, availability, activity };
        });

        return { moodleStatus, bubbles };
    },

    async getActivities(courseMapId: string, includeHidden: boolean): Promise<Activity[]> {
        const map = requireMap(courseMapId);
        const placedBy = new Map(map.bubbles.map((bubble) => [bubble.activityId, bubble.id]));
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
        if (map.bubbles.some((bubble) => bubble.activityId === input.activityId)) {
            throw new ApiError(409, { code: "activity_already_placed", message: "Esta actividad ya está en el mapa" });
        }
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
        maps = maps.map((item) => (item.id === map.id ? { ...item, bubbles: [...item.bubbles, bubble], updatedAt: timestamp } : item));
        return bubble;
    },

    async updateBubble(courseMapId: string, bubbleId: string, input: BubbleUpdate): Promise<Bubble> {
        const map = requireMap(courseMapId);
        const current = requireBubble(map, bubbleId);
        const updated: Bubble = { ...current, ...input, updatedAt: now() };
        maps = maps.map((item) =>
            item.id === map.id
                ? { ...item, bubbles: item.bubbles.map((bubble) => (bubble.id === bubbleId ? updated : bubble)), updatedAt: updated.updatedAt }
                : item
        );
        return updated;
    },

    async deleteBubble(courseMapId: string, bubbleId: string): Promise<void> {
        const map = requireMap(courseMapId);
        requireBubble(map, bubbleId);
        maps = maps.map((item) =>
            item.id === map.id ? { ...item, bubbles: item.bubbles.filter((bubble) => bubble.id !== bubbleId), updatedAt: now() } : item
        );
    },
};
