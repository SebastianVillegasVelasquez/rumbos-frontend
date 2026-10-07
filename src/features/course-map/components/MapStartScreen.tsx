import { useMemo, useState, type FormEvent } from "react";
import { ApiError, isUnreachable } from "../data/client.ts";
import { useCreateCourseMap } from "../data/queries.ts";
import { forgetCourseMap, getRecentCourseMaps, type RecentCourseMap } from "../data/recentMaps.ts";

export const DEFAULT_MAP_IMAGE_URL = "/fondo.webp";

interface MapStartScreenProps {
    onOpen: (courseMapId: string) => void;
}

type Tab = "recent" | "create" | "open";

const describeCreateError = (error: unknown) => {
    if (isUnreachable(error)) return "No se pudo contactar al servidor. Verifica que el backend esté activo.";
    if (error instanceof ApiError && error.status === 409) return "conflict" as const;
    return "No se pudo crear el mapa. Intenta de nuevo.";
};

// Accepts a bare UUID or a full "...?map=<uuid>" link pasted by the user.
const extractMapId = (value: string) => {
    try {
        const url = new URL(value);
        return url.searchParams.get("map") ?? value;
    } catch {
        return value;
    }
};

const dateFormatter = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" });

const formatOpenedAt = (iso: string) => {
    try {
        return dateFormatter.format(new Date(iso));
    } catch {
        return iso;
    }
};

const TabButton = ({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) => (
    <button
        type="button"
        onClick={onClick}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            active ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        }`}
    >
        {children}
    </button>
);

const RecentMapCard = ({
    map,
    onOpen,
    onForget,
}: {
    map: RecentCourseMap;
    onOpen: (id: string) => void;
    onForget: (id: string) => void;
}) => (
    <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
        <button type="button" onClick={() => onOpen(map.id)} className="block w-full text-left">
            <div
                className="h-20 w-full bg-gray-100 bg-cover bg-center"
                style={{ backgroundImage: `url(${map.imageUrl})` }}
            />
            <div className="space-y-0.5 p-3">
                <p className="text-sm font-semibold text-gray-800">Curso #{map.moodleCourseId}</p>
                <p className="text-xs text-gray-400">Abierto {formatOpenedAt(map.openedAt)}</p>
            </div>
        </button>
        <button
            type="button"
            onClick={() => onForget(map.id)}
            aria-label="Quitar de recientes"
            className="absolute right-2 top-2 hidden h-6 w-6 items-center justify-center rounded-full bg-white/90 text-gray-400 shadow hover:bg-red-50 hover:text-red-500 group-hover:flex"
        >
            &#10005;
        </button>
    </div>
);

export const MapStartScreen = ({ onOpen }: MapStartScreenProps) => {
    const [recentMaps, setRecentMaps] = useState(getRecentCourseMaps);
    const [tab, setTab] = useState<Tab>(recentMaps.length > 0 ? "recent" : "create");
    const [courseId, setCourseId] = useState("");
    const [mapIdInput, setMapIdInput] = useState("");
    const createMap = useCreateCourseMap();

    const createErrorKind = useMemo(
        () => (createMap.isError ? describeCreateError(createMap.error) : null),
        [createMap.isError, createMap.error]
    );

    const handleCreateSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const moodleCourseId = Number(courseId);
        if (!Number.isInteger(moodleCourseId) || moodleCourseId <= 0) return;
        createMap.mutate(
            { title: `Curso ${moodleCourseId}`, moodleCourseId, imageUrl: DEFAULT_MAP_IMAGE_URL },
            { onSuccess: (map) => onOpen(map.id) }
        );
    };

    const handleOpenSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const trimmed = mapIdInput.trim();
        if (!trimmed) return;
        onOpen(extractMapId(trimmed));
    };

    const handleForget = (id: string) => {
        forgetCourseMap(id);
        setRecentMaps(getRecentCourseMaps());
    };

    return (
        <div className="flex h-full items-center justify-center">
            <div className="w-full max-w-md space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div>
                    <h2 className="font-semibold text-gray-800">Mapas del curso</h2>
                    <p className="mt-1 text-xs text-gray-400">Abre un mapa reciente, créalo o pega su enlace.</p>
                </div>

                <div className="flex gap-1 rounded-lg bg-gray-50 p-1">
                    <TabButton active={tab === "recent"} onClick={() => setTab("recent")}>
                        Recientes{recentMaps.length > 0 ? ` (${recentMaps.length})` : ""}
                    </TabButton>
                    <TabButton active={tab === "create"} onClick={() => setTab("create")}>
                        Crear nuevo
                    </TabButton>
                    <TabButton active={tab === "open"} onClick={() => setTab("open")}>
                        Abrir por ID
                    </TabButton>
                </div>

                {tab === "recent" &&
                    (recentMaps.length > 0 ? (
                        <div className="grid max-h-80 grid-cols-2 gap-3 overflow-y-auto">
                            {recentMaps.map((map) => (
                                <RecentMapCard key={map.id} map={map} onOpen={onOpen} onForget={handleForget} />
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-2 rounded-lg border border-dashed border-gray-200 p-6 text-center">
                            <p className="text-sm text-gray-500">Aún no has abierto ningún mapa en este navegador.</p>
                            <button
                                type="button"
                                onClick={() => setTab("create")}
                                className="text-sm font-medium text-blue-600 hover:underline"
                            >
                                Crear el primero
                            </button>
                        </div>
                    ))}

                {tab === "create" && (
                    <form onSubmit={handleCreateSubmit} className="space-y-3">
                        <label className="block space-y-1">
                            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                                ID de curso en Moodle
                            </span>
                            <input
                                type="number"
                                min={1}
                                step={1}
                                required
                                value={courseId}
                                onChange={(e) => setCourseId(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                            />
                        </label>
                        <p className="text-xs text-gray-400">Usa la imagen de fondo predeterminada.</p>

                        {createErrorKind === "conflict" ? (
                            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                                <p>Ya existe un mapa para este curso.</p>
                                <p className="text-xs text-amber-700">
                                    Si lo abriste antes en este navegador, búscalo en{" "}
                                    <button
                                        type="button"
                                        onClick={() => setTab("recent")}
                                        className="font-medium underline"
                                    >
                                        Recientes
                                    </button>
                                    , o pega su enlace en{" "}
                                    <button type="button" onClick={() => setTab("open")} className="font-medium underline">
                                        Abrir por ID
                                    </button>
                                    .
                                </p>
                            </div>
                        ) : (
                            createMap.isError && (
                                <p className="text-sm text-red-600">{describeCreateError(createMap.error)}</p>
                            )
                        )}

                        <button
                            type="submit"
                            disabled={createMap.isPending}
                            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                        >
                            {createMap.isPending ? "Creando..." : "Crear mapa"}
                        </button>
                    </form>
                )}

                {tab === "open" && (
                    <form onSubmit={handleOpenSubmit} className="space-y-3">
                        <label className="block space-y-1">
                            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                                ID o enlace del mapa
                            </span>
                            <input
                                type="text"
                                required
                                placeholder="p. ej. 3fa85f64-5717-4562-b3fc-2c963f66afa6"
                                value={mapIdInput}
                                onChange={(e) => setMapIdInput(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                            />
                        </label>
                        <p className="text-xs text-gray-400">
                            Pega el UUID del mapa o la URL completa que alguien te compartió.
                        </p>
                        <button
                            type="submit"
                            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                        >
                            Abrir mapa
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};
