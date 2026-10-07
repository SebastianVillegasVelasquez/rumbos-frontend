import { useEffect, useMemo, useState, type FormEvent } from "react";
import { MoreVertical, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button, IconButton } from "../../../components/ui/Button.tsx";
import { Card } from "../../../components/ui/Card.tsx";
import { Dialog } from "../../../components/ui/Dialog.tsx";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog.tsx";
import { DropdownMenu } from "../../../components/ui/DropdownMenu.tsx";
import { Skeleton, EmptyState } from "../../../components/ui/Skeleton.tsx";
import { useToast } from "../../../components/ui/toastContext.ts";
import { backgroundOptions, DEFAULT_BACKGROUND_URL } from "../../../assets/backgrounds/index.ts";
import { es } from "../../../i18n/es.ts";
import { ApiError, isUnreachable } from "../data/client.ts";
import { resolveThumbUrl } from "../data/assets.ts";
import { courseMapApi } from "../data/index.ts";
import {
    useCourseMaps,
    useCreateCourseMap,
    useDeleteCourseMap,
    useUpdateCourseMap,
} from "../data/queries.ts";
import { getRecentCourseMaps, type RecentCourseMap } from "../data/recentMaps.ts";
import type { CourseMapSummary } from "../data/types.ts";

interface MapsHomeProps {
    onOpen: (courseMapId: string) => void;
    initialCreateCourseId?: number;
}

const relativeTime = new Intl.RelativeTimeFormat("es-CO", { numeric: "auto" });

const formatRelative = (iso: string) => {
    const diffMs = new Date(iso).getTime() - Date.now();
    const diffMinutes = Math.round(diffMs / 60_000);
    if (Math.abs(diffMinutes) < 60) return relativeTime.format(diffMinutes, "minute");
    const diffHours = Math.round(diffMinutes / 60);
    if (Math.abs(diffHours) < 24) return relativeTime.format(diffHours, "hour");
    const diffDays = Math.round(diffHours / 24);
    return relativeTime.format(diffDays, "day");
};

const useDebouncedValue = (value: string, delayMs: number) => {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(timer);
    }, [value, delayMs]);
    return debounced;
};

const MapCard = ({
    map,
    onOpen,
    onRename,
    onDelete,
}: {
    map: CourseMapSummary;
    onOpen: (id: string) => void;
    onRename: (map: CourseMapSummary) => void;
    onDelete: (map: CourseMapSummary) => void;
}) => (
    <Card className="group relative overflow-hidden transition-shadow hover:shadow-[0_8px_24px_-8px_rgba(30,42,74,0.25)]">
        <button type="button" onClick={() => onOpen(map.id)} className="block w-full text-left">
            <div className="relative h-32 w-full overflow-hidden bg-surface-muted">
                <img
                    src={resolveThumbUrl(map.imageUrl)}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-ink/0 to-transparent" />
                <p className="absolute bottom-2 left-3 right-3 truncate font-heading text-base font-semibold text-white">
                    {map.title}
                </p>
            </div>
            <div className="space-y-1 p-3">
                <p className="text-xs font-medium text-ink-soft">{es.home.card.course(map.moodleCourseId)}</p>
                <div className="flex items-center justify-between text-xs text-slate-dark">
                    <span>{es.home.card.activities(map.bubbleCount)}</span>
                    <span>{formatRelative(map.updatedAt)}</span>
                </div>
            </div>
        </button>
        <div className="absolute right-2 top-2">
            <DropdownMenu
                trigger={
                    <IconButton aria-label={map.title} variant="secondary" className="h-9 w-9 min-h-0 min-w-0 bg-surface/90">
                        <MoreVertical size={16} />
                    </IconButton>
                }
                items={[
                    { label: es.home.card.open, onSelect: () => onOpen(map.id) },
                    { label: es.home.card.rename, icon: <Pencil size={14} />, onSelect: () => onRename(map) },
                    { label: es.home.card.delete, icon: <Trash2 size={14} />, onSelect: () => onDelete(map), destructive: true },
                ]}
            />
        </div>
    </Card>
);

export const MapsHome = ({ onOpen, initialCreateCourseId }: MapsHomeProps) => {
    const toast = useToast();
    const [searchInput, setSearchInput] = useState("");
    const q = useDebouncedValue(searchInput, 300);
    const [recent] = useState<RecentCourseMap | null>(() => getRecentCourseMaps()[0] ?? null);
    const [createOpen, setCreateOpen] = useState(initialCreateCourseId !== undefined);
    const [renameTarget, setRenameTarget] = useState<CourseMapSummary | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<CourseMapSummary | null>(null);

    const mapsQuery = useCourseMaps({ q });
    const items = useMemo(() => (mapsQuery.data?.pages ?? []).flatMap((page) => page.items), [mapsQuery.data]);
    const pages = mapsQuery.data?.pages ?? [];
    const total = pages[0]?.total ?? 0;

    return (
        <div className="flex h-full flex-col overflow-y-auto p-6">
            <div className="mx-auto w-full max-w-5xl space-y-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="font-heading text-2xl font-semibold text-ink">{es.home.title}</h1>
                        <p className="mt-1 text-sm text-ink-soft">{es.home.subtitle}</p>
                    </div>
                    <Button onClick={() => setCreateOpen(true)}>
                        <Plus size={16} />
                        {es.home.createMap}
                    </Button>
                </div>

                {recent && (
                    <Card className="flex items-center gap-4 overflow-hidden p-4">
                        <img src={resolveThumbUrl(recent.imageUrl)} alt="" className="h-14 w-14 rounded-md object-cover" />
                        <div className="flex-1">
                            <p className="text-xs font-semibold uppercase tracking-wide text-teal-dark">
                                {es.home.continueWhereLeft}
                            </p>
                            <p className="font-heading text-base font-semibold text-ink">{recent.title}</p>
                        </div>
                        <Button variant="secondary" onClick={() => onOpen(recent.id)}>
                            {es.home.card.open}
                        </Button>
                    </Card>
                )}

                <div className="relative max-w-sm">
                    <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-dark" />
                    <input
                        type="search"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder={es.home.searchPlaceholder}
                        className="h-11 w-full rounded-md border border-ink/10 bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-slate-dark focus:border-teal-dark focus:outline-none"
                    />
                </div>

                {mapsQuery.isPending && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <Skeleton key={i} className="h-44" />
                        ))}
                    </div>
                )}

                {mapsQuery.isError && (
                    <EmptyState
                        title={es.home.error.title}
                        description={es.home.error.description}
                        action={
                            <Button variant="secondary" onClick={() => void mapsQuery.refetch()}>
                                {es.app.retry}
                            </Button>
                        }
                    />
                )}

                {mapsQuery.isSuccess && items.length === 0 && (
                    <EmptyState
                        title={q ? es.home.searchEmpty.title : es.home.empty.title}
                        description={q ? es.home.searchEmpty.description : es.home.empty.description}
                        action={
                            !q && (
                                <Button onClick={() => setCreateOpen(true)}>
                                    <Plus size={16} />
                                    {es.home.createMap}
                                </Button>
                            )
                        }
                    />
                )}

                {items.length > 0 && (
                    <>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {items.map((map) => (
                                <MapCard
                                    key={map.id}
                                    map={map}
                                    onOpen={onOpen}
                                    onRename={setRenameTarget}
                                    onDelete={setDeleteTarget}
                                />
                            ))}
                        </div>
                        {items.length < total && (
                            <div className="flex justify-center pt-2">
                                <Button
                                    variant="secondary"
                                    disabled={mapsQuery.isFetchingNextPage}
                                    onClick={() => void mapsQuery.fetchNextPage()}
                                >
                                    {es.home.loadMore}
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>

            <CreateMapDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                onCreated={onOpen}
                initialCourseId={initialCreateCourseId}
            />
            <RenameMapDialog key={renameTarget?.id ?? "none"} map={renameTarget} onOpenChange={() => setRenameTarget(null)} />
            <DeleteMapDialog map={deleteTarget} onOpenChange={() => setDeleteTarget(null)} onDeleted={() => toast.show(es.home.card.delete + " ✓", "success")} />
        </div>
    );
};

const describeCreateError = (error: unknown): "conflict" | "unreachable" | "generic" => {
    if (isUnreachable(error)) return "unreachable";
    if (error instanceof ApiError && error.status === 409) return "conflict";
    return "generic";
};

const CreateMapDialog = ({
    open,
    onOpenChange,
    onCreated,
    initialCourseId,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated: (id: string) => void;
    initialCourseId?: number;
}) => {
    const [title, setTitle] = useState("");
    const [courseId, setCourseId] = useState(initialCourseId !== undefined ? String(initialCourseId) : "");
    const [backgroundUrl, setBackgroundUrl] = useState(DEFAULT_BACKGROUND_URL);
    const [conflictMapId, setConflictMapId] = useState<string | null>(null);
    const createMap = useCreateCourseMap();

    const handleOpenChange = (next: boolean) => {
        if (!next) {
            setTitle("");
            setCourseId(initialCourseId !== undefined ? String(initialCourseId) : "");
            setBackgroundUrl(DEFAULT_BACKGROUND_URL);
            setConflictMapId(null);
            createMap.reset();
        }
        onOpenChange(next);
    };

    const errorKind = createMap.isError ? describeCreateError(createMap.error) : null;

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const trimmedTitle = title.trim();
        const moodleCourseId = Number(courseId);
        if (!trimmedTitle || !Number.isInteger(moodleCourseId) || moodleCourseId <= 0) return;

        setConflictMapId(null);
        createMap.mutate(
            { title: trimmedTitle, moodleCourseId, imageUrl: backgroundUrl },
            {
                onSuccess: (map) => onCreated(map.id),
                onError: async (error) => {
                    if (describeCreateError(error) === "conflict") {
                        const result = await courseMapApi.listCourseMaps({ moodleCourseId, limit: 1 });
                        setConflictMapId(result.items[0]?.id ?? null);
                    }
                },
            }
        );
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange} title={es.home.create.title}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                        {es.home.create.titleLabel}
                    </span>
                    <input
                        type="text"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={es.home.create.titlePlaceholder}
                        maxLength={120}
                        className="w-full rounded-md border border-ink/10 px-3 py-2 text-sm focus:border-teal-dark focus:outline-none"
                    />
                </label>
                <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                        {es.home.create.courseIdLabel}
                    </span>
                    <input
                        type="number"
                        min={1}
                        step={1}
                        required
                        value={courseId}
                        onChange={(e) => setCourseId(e.target.value)}
                        className="w-full rounded-md border border-ink/10 px-3 py-2 text-sm focus:border-teal-dark focus:outline-none"
                    />
                </label>
                <div className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                        {es.home.create.backgroundLabel}
                    </span>
                    <div className="flex gap-2">
                        {backgroundOptions.map((option) => (
                            <button
                                key={option.id}
                                type="button"
                                onClick={() => setBackgroundUrl(option.url)}
                                aria-label={option.label}
                                aria-pressed={backgroundUrl === option.url}
                                className={`h-14 w-20 overflow-hidden rounded-md border-2 ${
                                    backgroundUrl === option.url ? "border-teal-dark" : "border-transparent"
                                }`}
                            >
                                <img src={option.url} alt="" className="h-full w-full object-cover" />
                            </button>
                        ))}
                    </div>
                </div>

                {errorKind === "conflict" && (
                    <div className="space-y-2 rounded-md border border-sun/40 bg-sun-tint p-3 text-sm text-sun-dark">
                        <p>{es.home.create.conflict}</p>
                        {conflictMapId && (
                            <Button type="button" size="sm" variant="secondary" onClick={() => onCreated(conflictMapId)}>
                                {es.home.create.openExisting}
                            </Button>
                        )}
                    </div>
                )}
                {errorKind === "unreachable" && <p className="text-sm text-coral-dark">{es.home.create.unreachable}</p>}
                {errorKind === "generic" && <p className="text-sm text-coral-dark">{es.home.create.genericError}</p>}

                <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)}>
                        {es.home.create.cancel}
                    </Button>
                    <Button type="submit" disabled={createMap.isPending}>
                        {createMap.isPending ? es.home.create.submitting : es.home.create.submit}
                    </Button>
                </div>
            </form>
        </Dialog>
    );
};

const RenameMapDialog = ({
    map,
    onOpenChange,
}: {
    map: CourseMapSummary | null;
    onOpenChange: () => void;
}) => {
    const [title, setTitle] = useState(map?.title ?? "");
    const updateMap = useUpdateCourseMap();

    if (!map) return null;

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const trimmed = title.trim();
        if (!trimmed) return;
        updateMap.mutate({ courseMapId: map.id, input: { title: trimmed } }, { onSuccess: onOpenChange });
    };

    return (
        <Dialog open onOpenChange={onOpenChange} title={es.home.rename.title}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                        {es.home.rename.label}
                    </span>
                    <input
                        type="text"
                        required
                        autoFocus
                        maxLength={120}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full rounded-md border border-ink/10 px-3 py-2 text-sm focus:border-teal-dark focus:outline-none"
                    />
                </label>
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="secondary" onClick={onOpenChange}>
                        {es.home.rename.cancel}
                    </Button>
                    <Button type="submit" disabled={updateMap.isPending}>
                        {es.home.rename.submit}
                    </Button>
                </div>
            </form>
        </Dialog>
    );
};

const DeleteMapDialog = ({
    map,
    onOpenChange,
    onDeleted,
}: {
    map: CourseMapSummary | null;
    onOpenChange: () => void;
    onDeleted: () => void;
}) => {
    const deleteMap = useDeleteCourseMap();
    if (!map) return null;

    return (
        <ConfirmDialog
            open
            onOpenChange={onOpenChange}
            title={es.home.deleteConfirm.title}
            description={es.home.deleteConfirm.description(map.bubbleCount)}
            confirmLabel={es.home.deleteConfirm.confirm}
            cancelLabel={es.home.deleteConfirm.cancel}
            onConfirm={() => deleteMap.mutate(map.id, { onSuccess: onDeleted })}
        />
    );
};
