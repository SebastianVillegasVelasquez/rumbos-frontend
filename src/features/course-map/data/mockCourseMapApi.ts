import { ApiError } from "./client.ts";
import type { CourseMapApi } from "./courseMapApi.ts";
import type {
    Activity,
    AppearanceUpdate,
    Asset,
    AssetKind,
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
    MapSettings,
    MoodleStatus,
    ReorderBubblesInput,
    ReorderBubblesResult,
    ReorderCourseMapsInput,
    ReorderCourseMapsResult,
    ResolvedBubble,
    ResolvedCourseMap,
    Skin,
    SkinConfig,
    SkinCreate,
    SkinListResult,
    SkinPatch,
} from "./types.ts";

// In-memory stand-in for the backend, enabled with VITE_USE_MOCK_API=true so
// demos run without a server. Mirrors contract v2's rules: several maps
// ("levels") per Moodle course, unique per Moodle section, ordering,
// settings/appearance, skins and assets. The Moodle-connectivity outcome of
// /resolved can be forced with ?mockMoodle=down|hidden|missing|cached, and
// asset-upload failure modes with ?mockAssets=quota|down, for demoing every
// state without a real backend.

const DEFAULT_IMAGE_URL = "/fondo.webp";
const MOCK_MODULE_URL = "https://moodle.example.com/mod/";
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;
const ASSET_QUOTA = 50;

const BACKGROUND_MAX_BYTES = 8 * 1024 * 1024;
const BACKGROUND_MAX_SIDE = 8192;
const BUBBLE_MAX_BYTES = 2 * 1024 * 1024;
const BUBBLE_MAX_SIDE = 1024;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

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

const mockAssetsOverride = (): "quota" | "down" | null => {
    if (typeof window === "undefined") return null;
    const value = new URLSearchParams(window.location.search).get("mockAssets");
    return value === "quota" || value === "down" ? value : null;
};

interface MockActivity {
    activityId: number;
    name: string;
    modname: string;
    sectionId: number;
    sectionName: string;
    sectionNumber: number;
    hidden: boolean;
}

const mockModules: MockActivity[] = [
    { activityId: 101, name: "Quiz de introducción", modname: "quiz", sectionId: 1, sectionName: "Semana 1", sectionNumber: 1, hidden: false },
    { activityId: 102, name: "Video de bienvenida", modname: "url", sectionId: 1, sectionName: "Semana 1", sectionNumber: 1, hidden: false },
    { activityId: 103, name: "Taller 1: configuración del entorno", modname: "assign", sectionId: 2, sectionName: "Semana 2", sectionNumber: 2, hidden: false },
    { activityId: 104, name: "Guía del curso", modname: "resource", sectionId: 2, sectionName: "Semana 2", sectionNumber: 2, hidden: false },
    { activityId: 105, name: "Quiz de mitad de curso", modname: "quiz", sectionId: 3, sectionName: "Semana 3", sectionNumber: 3, hidden: false },
    { activityId: 106, name: "Grabación: Semana 3", modname: "url", sectionId: 3, sectionName: "Semana 3", sectionNumber: 3, hidden: false },
    { activityId: 107, name: "Entrega de proyecto final", modname: "assign", sectionId: 4, sectionName: "Semana 4", sectionNumber: 4, hidden: true },
    { activityId: 108, name: "Certificado del curso", modname: "customcert", sectionId: 4, sectionName: "Semana 4", sectionNumber: 4, hidden: false },
    { activityId: 109, name: "Contenido SCORM: fundamentos", modname: "scorm", sectionId: 2, sectionName: "Semana 2", sectionNumber: 2, hidden: false },
];

// ---- Built-in skins ---------------------------------------------------------

const palette = (fill: string, accent: string, glow: string) => ({ fill, accent, glow });

const builtinPalette = {
    locked: palette("#8A94A6", "#5B6577", "#B4BCCB"),
    available: palette("#FFB703", "#E08E00", "#FFD866"),
    inProgress: palette("#0E9AA7", "#087680", "#5ED3DD"),
    complete: palette("#2FBF71", "#1E8E52", "#7DE3A8"),
};

const skinTimestamp = now();

const builtinSkinSeed: ReadonlyArray<{ id: string; name: string; isDefault: boolean; config: SkinConfig }> = [
    {
        id: "skin-orbe",
        name: "Orbe",
        isDefault: true,
        config: {
            schemaVersion: 1,
            kind: "procedural",
            shape: "circle",
            size: 64,
            palette: builtinPalette,
            icon: { mode: "auto", preset: null, color: "auto" },
            label: { mode: "hover" },
            effects: { idle: "breathe", ring: true, glow: true, completion: "ripple" },
        },
    },
    {
        id: "skin-insignia",
        name: "Insignia",
        isDefault: false,
        config: {
            schemaVersion: 1,
            kind: "procedural",
            shape: "badge",
            size: 72,
            palette: builtinPalette,
            icon: { mode: "auto", preset: null, color: "auto" },
            label: { mode: "hover" },
            effects: { idle: "pulse", ring: true, glow: true, completion: "burst" },
        },
    },
    {
        id: "skin-pin",
        name: "Pin",
        isDefault: false,
        config: {
            schemaVersion: 1,
            kind: "procedural",
            shape: "pin",
            size: 60,
            palette: builtinPalette,
            icon: { mode: "auto", preset: null, color: "auto" },
            label: { mode: "hover" },
            effects: { idle: "float", ring: false, glow: true, completion: "ripple" },
        },
    },
    {
        id: "skin-hexagono",
        name: "Hexágono",
        isDefault: false,
        config: {
            schemaVersion: 1,
            kind: "procedural",
            shape: "hexagon",
            size: 68,
            palette: builtinPalette,
            icon: { mode: "auto", preset: null, color: "auto" },
            label: { mode: "hover" },
            effects: { idle: "breathe", ring: true, glow: false, completion: "burst" },
        },
    },
];

let skins: Skin[] = builtinSkinSeed.map((seed) => ({
    id: seed.id,
    name: seed.name,
    builtin: true,
    isDefault: seed.isDefault,
    config: seed.config,
    createdAt: skinTimestamp,
    updatedAt: skinTimestamp,
}));

const defaultSkinId = () => skins.find((skin) => skin.isDefault)?.id ?? skins[0].id;

const defaultSettings = (mode: MapSettings["mode"]): MapSettings => ({
    schemaVersion: 1,
    mode,
    fit: "fit-width",
    initialView: null,
    path: { visible: true, style: "dashed", color: null, animated: mode === "guided" },
    ambient: { kind: "none", intensity: 0 },
    intro: "none",
});

// ---- Maps -------------------------------------------------------------------

interface MockMap {
    id: string;
    title: string;
    moodleCourseId: number;
    moodleSectionId: number | null;
    position: number;
    imageUrl: string;
    settings: MapSettings;
    defaultSkinId: string | null;
    skinRules: { modname: string; skinId: string }[];
    bubbles: Bubble[];
    createdAt: string;
    updatedAt: string;
}

const seedBubble = (
    courseMapId: string,
    timestamp: string,
    sequence: number,
    spec: { activityId: number; x: number; y: number; status: Bubble["status"] }
): Bubble => ({
    id: newId(),
    courseMapId,
    activityId: spec.activityId,
    x: spec.x,
    y: spec.y,
    icon: null,
    status: spec.status,
    skinId: null,
    sequence,
    createdAt: timestamp,
    updatedAt: timestamp,
});

const seedMap = (
    title: string,
    moodleCourseId: number,
    bubbleSpecs: ReadonlyArray<{ activityId: number; x: number; y: number; status: Bubble["status"] }>,
    options: { imageUrl?: string; moodleSectionId?: number | null; position?: number; mode?: MapSettings["mode"] } = {}
): MockMap => {
    const timestamp = now();
    const id = newId();
    return {
        id,
        title,
        moodleCourseId,
        moodleSectionId: options.moodleSectionId ?? null,
        position: options.position ?? 0,
        imageUrl: options.imageUrl ?? DEFAULT_IMAGE_URL,
        settings: defaultSettings(options.mode ?? "explorative"),
        defaultSkinId: defaultSkinId(),
        skinRules: [],
        createdAt: timestamp,
        updatedAt: timestamp,
        bubbles: bubbleSpecs.map((spec, index) => seedBubble(id, timestamp, index, spec)),
    };
};

const createInitialMaps = (): MockMap[] => [
    // One course with three levels, different bubble counts/modes/statuses,
    // to demo the carousel and guided-vs-explorative sequencing.
    seedMap(
        "Fundamentos de programación — Nivel 1",
        1,
        [
            { activityId: 101, x: 0.18, y: 0.72, status: "complete" },
            { activityId: 102, x: 0.5, y: 0.45, status: "complete" },
            { activityId: 103, x: 0.82, y: 0.6, status: "in_progress" },
        ],
        { moodleSectionId: 1, position: 0, mode: "explorative" }
    ),
    seedMap(
        "Fundamentos de programación — Nivel 2",
        1,
        [
            { activityId: 104, x: 0.15, y: 0.5, status: "no_complete" },
            { activityId: 109, x: 0.38, y: 0.3, status: "locked" },
            { activityId: 105, x: 0.62, y: 0.55, status: "locked" },
            { activityId: 106, x: 0.85, y: 0.35, status: "locked" },
        ],
        { moodleSectionId: 2, position: 1, mode: "guided" }
    ),
    seedMap(
        "Fundamentos de programación — Nivel 3",
        1,
        [
            { activityId: 107, x: 0.3, y: 0.5, status: "locked" },
            { activityId: 108, x: 0.7, y: 0.5, status: "locked" },
        ],
        { position: 2, mode: "guided" }
    ),
    seedMap("Matemáticas para datos", 2, [
        { activityId: 101, x: 0.22, y: 0.4, status: "complete" },
        { activityId: 104, x: 0.5, y: 0.55, status: "no_complete" },
    ]),
    seedMap("Historia regional", 3, [
        { activityId: 102, x: 0.3, y: 0.5, status: "in_progress" },
        { activityId: 106, x: 0.55, y: 0.3, status: "locked" },
        { activityId: 108, x: 0.75, y: 0.65, status: "locked" },
    ]),
    seedMap("Ciudadanía digital", 4, [{ activityId: 109, x: 0.4, y: 0.5, status: "no_complete" }]),
];

let maps: MockMap[] = createInitialMaps();

// ---- Assets -----------------------------------------------------------------

let assets: Asset[] = [];
const assetObjectUrls = new Map<string, string>();

// ---- Errors -----------------------------------------------------------------

const notFound = (code: string, message: string) => new ApiError(404, { code, message });
const businessError = (status: number, code: string, message: string, extras: Record<string, unknown> = {}) =>
    new ApiError(status, { code, message, ...extras });

const requireMap = (courseMapId: string) => {
    const map = maps.find((item) => item.id === courseMapId);
    if (!map) throw notFound("course_map_not_found", "Mapa no encontrado");
    return map;
};

const requireBubble = (map: MockMap, bubbleId: string) => {
    const bubble = map.bubbles.find((item) => item.id === bubbleId);
    if (!bubble) throw notFound("bubble_not_found", "Burbuja no encontrada");
    return bubble;
};

const requireSkin = (skinId: string) => {
    const skin = skins.find((item) => item.id === skinId);
    if (!skin) throw businessError(422, "skin_not_found", "El skin seleccionado no existe");
    return skin;
};

// ---- Mapping helpers ---------------------------------------------------------

const toSummary = (map: MockMap): CourseMapSummary => ({
    id: map.id,
    title: map.title,
    moodleCourseId: map.moodleCourseId,
    moodleSectionId: map.moodleSectionId,
    position: map.position,
    imageUrl: map.imageUrl,
    bubbleCount: map.bubbles.length,
    completeCount: map.bubbles.filter((bubble) => bubble.status === "complete").length,
    createdAt: map.createdAt,
    updatedAt: map.updatedAt,
});

const toRead = (map: MockMap): CourseMapRead => ({
    id: map.id,
    title: map.title,
    moodleCourseId: map.moodleCourseId,
    moodleSectionId: map.moodleSectionId,
    position: map.position,
    imageUrl: map.imageUrl,
    settings: map.settings,
    defaultSkinId: map.defaultSkinId,
    skinRules: map.skinRules,
    bubbles: map.bubbles,
    createdAt: map.createdAt,
    updatedAt: map.updatedAt,
});

const mapsForCourse = (moodleCourseId: number) => maps.filter((map) => map.moodleCourseId === moodleCourseId);

const activityFor = (activityId: number): Activity | null => {
    const module = mockModules.find((item) => item.activityId === activityId);
    if (!module) return null;
    return {
        activityId: module.activityId,
        name: module.name,
        modname: module.modname,
        url: `${MOCK_MODULE_URL}${module.modname}/view.php?id=${module.activityId}`,
        sectionId: module.sectionId,
        sectionName: module.sectionName,
        sectionNumber: module.sectionNumber,
        hidden: module.hidden,
        placed: false,
        bubbleId: null,
        placedInMapId: null,
    };
};

const normalizeBytes = (file: File | Blob) => file.size;

const readImageSize = async (file: Blob): Promise<{ width: number; height: number }> => {
    try {
        const bitmap = await createImageBitmap(file);
        const size = { width: bitmap.width, height: bitmap.height };
        bitmap.close?.();
        return size;
    } catch {
        throw businessError(422, "asset_invalid_image", "El archivo no es una imagen válida");
    }
};

export const mockCourseMapApi: CourseMapApi = {
    async listCourseMaps(params: CourseMapListParams): Promise<CourseMapListResult> {
        const limit = Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
        const offset = params.offset ?? 0;
        const q = params.q?.trim().toLowerCase();
        const filtered = maps
            .filter((map) => params.moodleCourseId === undefined || map.moodleCourseId === params.moodleCourseId)
            .filter((map) => !q || map.title.toLowerCase().includes(q))
            .sort((a, b) =>
                params.moodleCourseId !== undefined
                    ? a.position - b.position || a.createdAt.localeCompare(b.createdAt)
                    : b.updatedAt.localeCompare(a.updatedAt)
            );
        return {
            items: filtered.slice(offset, offset + limit).map(toSummary),
            total: filtered.length,
            limit,
            offset,
        };
    },

    async createCourseMap(input: CourseMapCreate): Promise<CourseMapSummary> {
        const sectionId = input.moodleSectionId ?? null;
        if (sectionId !== null && mapsForCourse(input.moodleCourseId).some((map) => map.moodleSectionId === sectionId)) {
            throw businessError(409, "map_already_exists_for_section", "Ya existe un nivel para esta sección", {
                moodleCourseId: input.moodleCourseId,
                moodleSectionId: sectionId,
            });
        }
        const title = input.title.trim().slice(0, 120);
        const position = mapsForCourse(input.moodleCourseId).reduce((max, map) => Math.max(max, map.position), -1) + 1;
        const map = seedMap(title, input.moodleCourseId, [], { imageUrl: input.imageUrl, moodleSectionId: sectionId, position });
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

    async reorderCourseMaps(input: ReorderCourseMapsInput): Promise<ReorderCourseMapsResult> {
        const current = mapsForCourse(input.moodleCourseId);
        const currentIds = new Set(current.map((map) => map.id));
        const inputIds = new Set(input.mapIds);
        if (currentIds.size !== inputIds.size || current.some((map) => !inputIds.has(map.id))) {
            throw businessError(422, "order_mismatch", "El orden no coincide con los niveles del curso");
        }
        const timestamp = now();
        const positionById = new Map(input.mapIds.map((id, index) => [id, index]));
        maps = maps.map((map) =>
            positionById.has(map.id) ? { ...map, position: positionById.get(map.id)!, updatedAt: timestamp } : map
        );
        return { items: mapsForCourse(input.moodleCourseId).sort((a, b) => a.position - b.position).map(toSummary) };
    },

    async updateAppearance(courseMapId: string, input: AppearanceUpdate): Promise<CourseMapRead> {
        const map = requireMap(courseMapId);
        if (input.defaultSkinId !== null) requireSkin(input.defaultSkinId);
        const seenModnames = new Set<string>();
        for (const rule of input.skinRules) {
            if (seenModnames.has(rule.modname)) {
                throw businessError(422, "duplicate_skin_rule", "Hay una regla duplicada para este tipo de actividad", {
                    modname: rule.modname,
                });
            }
            seenModnames.add(rule.modname);
            requireSkin(rule.skinId);
        }
        const updated: MockMap = {
            ...map,
            settings: input.settings,
            defaultSkinId: input.defaultSkinId,
            skinRules: input.skinRules,
            updatedAt: now(),
        };
        maps = maps.map((item) => (item.id === courseMapId ? updated : item));
        return toRead(updated);
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
            if (activity) {
                activity.bubbleId = bubble.id;
                activity.placed = true;
                activity.placedInMapId = map.id;
            }

            return { bubbleId: bubble.id, availability, activity };
        });

        return { moodleStatus, bubbles };
    },

    async getActivities(courseMapId: string, includeHidden: boolean, onlySection: boolean): Promise<Activity[]> {
        const map = requireMap(courseMapId);
        const courseMaps = mapsForCourse(map.moodleCourseId);
        const placementByActivity = new Map<number, { bubbleId: string; mapId: string }>();
        for (const courseMap of courseMaps) {
            for (const bubble of courseMap.bubbles) {
                placementByActivity.set(bubble.activityId, { bubbleId: bubble.id, mapId: courseMap.id });
            }
        }
        return mockModules
            .filter((module) => includeHidden || !module.hidden)
            .filter((module) => !onlySection || map.moodleSectionId === null || module.sectionId === map.moodleSectionId)
            .map((module) => {
                const placement = placementByActivity.get(module.activityId);
                const bubbleId = placement && placement.mapId === map.id ? placement.bubbleId : null;
                return {
                    activityId: module.activityId,
                    name: module.name,
                    modname: module.modname,
                    url: `${MOCK_MODULE_URL}${module.modname}/view.php?id=${module.activityId}`,
                    sectionId: module.sectionId,
                    sectionName: module.sectionName,
                    sectionNumber: module.sectionNumber,
                    hidden: module.hidden,
                    placed: placement !== undefined,
                    bubbleId,
                    placedInMapId: placement?.mapId ?? null,
                };
            });
    },

    async createBubble(courseMapId: string, input: BubbleCreate): Promise<Bubble> {
        const map = requireMap(courseMapId);
        for (const courseMap of mapsForCourse(map.moodleCourseId)) {
            if (courseMap.bubbles.some((bubble) => bubble.activityId === input.activityId)) {
                throw businessError(409, "activity_already_placed", "Esta actividad ya está en un nivel de este curso", {
                    courseMapId: courseMap.id,
                    courseMapTitle: courseMap.title,
                });
            }
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
            skinId: null,
            sequence: map.bubbles.length,
            createdAt: timestamp,
            updatedAt: timestamp,
        };
        maps = maps.map((item) => (item.id === map.id ? { ...item, bubbles: [...item.bubbles, bubble], updatedAt: timestamp } : item));
        return bubble;
    },

    async updateBubble(courseMapId: string, bubbleId: string, input: BubbleUpdate): Promise<Bubble> {
        const map = requireMap(courseMapId);
        const current = requireBubble(map, bubbleId);
        if ("skinId" in input && input.skinId !== null) requireSkin(input.skinId);
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

    async reorderBubbles(courseMapId: string, input: ReorderBubblesInput): Promise<ReorderBubblesResult> {
        const map = requireMap(courseMapId);
        const currentIds = new Set(map.bubbles.map((bubble) => bubble.id));
        const inputIds = new Set(input.bubbleIds);
        if (currentIds.size !== inputIds.size || map.bubbles.some((bubble) => !inputIds.has(bubble.id))) {
            throw businessError(422, "order_mismatch", "El orden no coincide con las burbujas del nivel");
        }
        const timestamp = now();
        const sequenceById = new Map(input.bubbleIds.map((id, index) => [id, index]));
        const bubbles = map.bubbles.map((bubble) => ({ ...bubble, sequence: sequenceById.get(bubble.id)!, updatedAt: timestamp }));
        maps = maps.map((item) => (item.id === map.id ? { ...item, bubbles, updatedAt: timestamp } : item));
        return { bubbles: bubbles.slice().sort((a, b) => a.sequence - b.sequence) };
    },

    async listSkins(): Promise<SkinListResult> {
        return { items: skins };
    },

    async createSkin(input: SkinCreate): Promise<Skin> {
        const timestamp = now();
        const skin: Skin = {
            id: newId(),
            name: input.name.trim().slice(0, 60),
            builtin: false,
            isDefault: false,
            config: input.config,
            createdAt: timestamp,
            updatedAt: timestamp,
        };
        skins = [...skins, skin];
        return skin;
    },

    async patchSkin(skinId: string, input: SkinPatch): Promise<Skin> {
        const skin = requireSkin(skinId);
        const updated: Skin = {
            ...skin,
            name: input.name !== undefined ? input.name.trim().slice(0, 60) : skin.name,
            config: input.config ?? skin.config,
            updatedAt: now(),
        };
        skins = skins.map((item) => (item.id === skinId ? updated : item));
        return updated;
    },

    async deleteSkin(skinId: string): Promise<void> {
        const skin = requireSkin(skinId);
        if (skin.builtin) throw businessError(403, "skin_is_builtin", "No se pueden eliminar los skins predefinidos");
        skins = skins.filter((item) => item.id !== skinId);
    },

    async createAsset(file: File, kind: AssetKind): Promise<Asset> {
        const override = mockAssetsOverride();
        if (override === "down") throw businessError(503, "uploads_disabled", "Las subidas están deshabilitadas temporalmente");
        if (override === "quota" || assets.length >= ASSET_QUOTA) {
            throw businessError(507, "asset_quota_exceeded", "Se alcanzó el límite de almacenamiento de imágenes");
        }
        if (!ALLOWED_MIME.has(file.type)) {
            throw businessError(422, "asset_type_not_allowed", "Formato de imagen no permitido (usa PNG, JPEG o WebP)");
        }
        const maxBytes = kind === "background" ? BACKGROUND_MAX_BYTES : BUBBLE_MAX_BYTES;
        if (normalizeBytes(file) > maxBytes) {
            throw businessError(413, "asset_too_large", "El archivo supera el tamaño máximo permitido");
        }
        const { width, height } = await readImageSize(file);
        const maxSide = kind === "background" ? BACKGROUND_MAX_SIDE : BUBBLE_MAX_SIDE;
        if (width > maxSide || height > maxSide) {
            throw businessError(422, "asset_dimensions_too_large", "La imagen supera las dimensiones máximas permitidas");
        }
        const id = newId();
        const url = URL.createObjectURL(file);
        const asset: Asset = {
            id,
            kind,
            mime: file.type,
            width,
            height,
            bytes: file.size,
            url: `/assets/${id}`,
            thumbUrl: kind === "background" ? `/assets/${id}/thumb` : null,
            createdAt: now(),
        };
        assetObjectUrls.set(id, url);
        assets = [...assets, asset];
        return asset;
    },
};

// There's no backend to serve "/assets/{id}" from in mock mode, so
// resolveImageUrl/resolveThumbUrl (data/assets.ts) look the blob URL up here.
export const getMockAssetObjectUrl = (assetId: string): string | null => assetObjectUrls.get(assetId) ?? null;
