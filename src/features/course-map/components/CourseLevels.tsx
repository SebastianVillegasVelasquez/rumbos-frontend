import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { LevelCarousel, LevelCarouselEmpty, type LevelItem } from "./LevelCarousel.tsx";
import { Button } from "../../../components/ui/Button.tsx";
import { Dialog } from "../../../components/ui/Dialog.tsx";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog.tsx";
import { BackgroundField, type BackgroundChoice } from "./background/BackgroundField.tsx";
import { DEFAULT_BACKGROUND_CHOICE } from "./background/defaultBackground.ts";
import { es } from "../../../i18n/es.ts";
import { ApiError, isUnreachable } from "../data/client.ts";
import {
    useActivities,
    useCreateCourseMap,
    useDeleteCourseMap,
    useCourseMapsByCourse,
    usePublishedMapsByCourse,
    useReorderCourseMaps,
} from "../data/queries.ts";
import { useUpdateCourseMap } from "../data/draftMutations.ts";
import type { CourseMapSummary } from "../data/types.ts";

interface CourseLevelsProps {
    moodleCourseId: number;
    // Edición and Vista previa list the draft levels; Publicado lists only what
    // students can see.
    viewMode: "edit" | "preview" | "published";
    onOpenLevel: (courseMapId: string) => void;
}

export const CourseLevels = ({ moodleCourseId, viewMode, onOpenLevel }: CourseLevelsProps) => {
    const editable = viewMode === "edit";
    const showPublished = viewMode === "published";
    const draftQuery = useCourseMapsByCourse(showPublished ? null : moodleCourseId);
    const publishedQuery = usePublishedMapsByCourse(showPublished ? moodleCourseId : null);
    const levelsQuery = showPublished ? publishedQuery : draftQuery;
    const draftLevels = useMemo(() => draftQuery.data ?? [], [draftQuery.data]);
    const levels: LevelItem[] = useMemo(
        () => (showPublished ? publishedQuery.data ?? [] : draftLevels),
        [showPublished, publishedQuery.data, draftLevels]
    );
    const [createOpen, setCreateOpen] = useState(false);
    const [renameTarget, setRenameTarget] = useState<CourseMapSummary | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<CourseMapSummary | null>(null);
    const reorderLevels = useReorderCourseMaps();

    // Exactly one level opens it directly (the carousel would be pointless);
    // several (or none yet) show the carousel/empty state.
    useEffect(() => {
        if (levels.length === 1) onOpenLevel(levels[0].id);
    }, [levels, onOpenLevel]);

    if (levelsQuery.isPending) {
        return (
            <div className="flex flex-1 items-center justify-center">
                <Loader2 size={20} className="animate-spin text-ink-soft" />
            </div>
        );
    }

    if (levels.length === 1) return null; // navigating away, see effect above

    return (
        <>
            {levels.length === 0 ? (
                <LevelCarouselEmpty editable={editable} onCreateLevel={() => setCreateOpen(true)} />
            ) : (
                <LevelCarousel
                    levels={levels}
                    editable={editable}
                    onOpen={onOpenLevel}
                    onCreateLevel={() => setCreateOpen(true)}
                    onRenameLevel={(level) => setRenameTarget(draftLevels.find((item) => item.id === level.id) ?? null)}
                    onDeleteLevel={(level) => setDeleteTarget(draftLevels.find((item) => item.id === level.id) ?? null)}
                    onReorder={(mapIds) => reorderLevels.mutate({ moodleCourseId, mapIds })}
                />
            )}
            <CreateLevelDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                moodleCourseId={moodleCourseId}
                existingLevelId={levels[0]?.id ?? null}
                onCreated={onOpenLevel}
            />
            <RenameLevelDialog key={renameTarget?.id ?? "none"} map={renameTarget} onOpenChange={() => setRenameTarget(null)} />
            <DeleteLevelDialog map={deleteTarget} onOpenChange={() => setDeleteTarget(null)} />
        </>
    );
};

const describeCreateError = (error: unknown): "conflict" | "unreachable" | "generic" => {
    if (isUnreachable(error)) return "unreachable";
    if (error instanceof ApiError && error.status === 409) return "conflict";
    return "generic";
};

const CreateLevelDialog = ({
    open,
    onOpenChange,
    moodleCourseId,
    existingLevelId,
    onCreated,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    moodleCourseId: number;
    existingLevelId: string | null;
    onCreated: (id: string) => void;
}) => {
    const [title, setTitle] = useState("");
    const [background, setBackground] = useState<BackgroundChoice | null>(DEFAULT_BACKGROUND_CHOICE);
    const [sectionId, setSectionId] = useState<string>("");
    const createMap = useCreateCourseMap();
    // Sections come from any existing level's activity list (modname/section
    // data is shared across the whole course, not per-level) - unavailable
    // for a brand-new course's first level, where the picker is just hidden.
    const activitiesQuery = useActivities(existingLevelId, true, false);
    const sections = useMemo(() => {
        const seen = new Map<number, string>();
        for (const activity of activitiesQuery.data ?? []) seen.set(activity.sectionId, activity.sectionName);
        return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
    }, [activitiesQuery.data]);

    const handleOpenChange = (next: boolean) => {
        if (!next) {
            setTitle("");
            setBackground(DEFAULT_BACKGROUND_CHOICE);
            setSectionId("");
            createMap.reset();
        }
        onOpenChange(next);
    };

    const errorKind = createMap.isError ? describeCreateError(createMap.error) : null;

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const trimmedTitle = title.trim();
        if (!trimmedTitle || !background) return;
        createMap.mutate(
            {
                title: trimmedTitle,
                moodleCourseId,
                imageUrl: background.imageUrl,
                moodleSectionId: sectionId ? Number(sectionId) : undefined,
            },
            { onSuccess: (map) => onCreated(map.id) }
        );
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange} title={es.levels.create.title}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{es.levels.create.titleLabel}</span>
                    <input
                        type="text"
                        required
                        autoFocus
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={es.levels.create.titlePlaceholder}
                        maxLength={120}
                        className="w-full rounded-md border border-ink/10 px-3 py-2 text-sm focus:border-teal-dark focus:outline-none"
                    />
                </label>
                {sections.length > 0 && (
                    <label className="block space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{es.levels.create.sectionLabel}</span>
                        <select
                            value={sectionId}
                            onChange={(e) => setSectionId(e.target.value)}
                            className="w-full rounded-md border border-ink/10 px-3 py-2 text-sm focus:border-teal-dark focus:outline-none"
                        >
                            <option value="">{es.levels.create.sectionNone}</option>
                            {sections.map((section) => (
                                <option key={section.id} value={section.id}>
                                    {section.name}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
                <div className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{es.levels.create.backgroundLabel}</span>
                    <BackgroundField value={background} onChange={setBackground} />
                </div>

                {errorKind === "conflict" && <p className="text-sm text-coral-dark">{es.levels.create.conflict}</p>}
                {errorKind === "unreachable" && <p className="text-sm text-coral-dark">{es.levels.create.unreachable}</p>}
                {errorKind === "generic" && <p className="text-sm text-coral-dark">{es.levels.create.genericError}</p>}

                <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)}>
                        {es.levels.create.cancel}
                    </Button>
                    <Button type="submit" disabled={createMap.isPending || !background}>
                        {createMap.isPending ? es.levels.create.submitting : es.levels.create.submit}
                    </Button>
                </div>
            </form>
        </Dialog>
    );
};

const RenameLevelDialog = ({ map, onOpenChange }: { map: CourseMapSummary | null; onOpenChange: () => void }) => {
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
        <Dialog open onOpenChange={onOpenChange} title={es.levels.manage.rename}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input
                    type="text"
                    required
                    autoFocus
                    maxLength={120}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-md border border-ink/10 px-3 py-2 text-sm focus:border-teal-dark focus:outline-none"
                />
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="secondary" onClick={onOpenChange}>
                        {es.levels.create.cancel}
                    </Button>
                    <Button type="submit" disabled={updateMap.isPending}>
                        {es.levels.manage.rename}
                    </Button>
                </div>
            </form>
        </Dialog>
    );
};

const DeleteLevelDialog = ({ map, onOpenChange }: { map: CourseMapSummary | null; onOpenChange: () => void }) => {
    const deleteMap = useDeleteCourseMap();
    if (!map) return null;

    return (
        <ConfirmDialog
            open
            onOpenChange={onOpenChange}
            title={es.levels.deleteConfirm.title}
            description={es.levels.deleteConfirm.description(map.bubbleCount)}
            confirmLabel={es.levels.deleteConfirm.confirm}
            cancelLabel={es.levels.deleteConfirm.cancel}
            onConfirm={() => deleteMap.mutate(map.id, { onSuccess: onOpenChange })}
        />
    );
};
