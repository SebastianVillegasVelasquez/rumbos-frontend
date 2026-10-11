import { useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { ChevronUp, ChevronDown, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { Card, Badge } from "../../../components/ui/Card.tsx";
import { ProgressBar } from "../../../components/ui/Skeleton.tsx";
import { Button, IconButton } from "../../../components/ui/Button.tsx";
import { DropdownMenu } from "../../../components/ui/DropdownMenu.tsx";
import { resolveThumbUrl } from "../data/assets.ts";
import { es } from "../../../i18n/es.ts";
import type { PublicationBadge } from "../data/types.ts";
import { PublicationChip } from "./publication/PublicationChip.tsx";

// What a level card needs. Draft summaries and published summaries both fit,
// so the carousel renders either without caring where it came from.
export interface LevelItem {
    id: string;
    title: string;
    imageUrl: string;
    bubbleCount: number;
    completeCount: number;
    publication?: PublicationBadge;
}

type BadgeTone = "slate" | "sun" | "teal" | "leaf";

const badgeFor = (map: LevelItem): { label: string; tone: BadgeTone } => {
    if (map.bubbleCount === 0) return { label: es.levels.badge.empty, tone: "slate" };
    if (map.completeCount === 0) return { label: es.levels.badge.new, tone: "sun" };
    if (map.completeCount >= map.bubbleCount) return { label: es.levels.badge.completed, tone: "leaf" };
    return { label: es.levels.badge.inProgress, tone: "teal" };
};

const prefersReducedMotion = () =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface LevelCarouselProps {
    levels: LevelItem[];
    editable: boolean;
    onOpen: (courseMapId: string) => void;
    onCreateLevel?: () => void;
    onRenameLevel?: (map: LevelItem) => void;
    onDeleteLevel?: (map: LevelItem) => void;
    onReorder?: (mapIds: string[]) => void;
}

export const LevelCarousel = ({
    levels,
    editable,
    onOpen,
    onCreateLevel,
    onRenameLevel,
    onDeleteLevel,
    onReorder,
}: LevelCarouselProps) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const dragIdRef = useRef<string | null>(null);
    const cover = levels[0] ? resolveThumbUrl(levels[0].imageUrl) : undefined;

    const moveBy = (map: LevelItem, delta: number) => {
        const index = levels.findIndex((level) => level.id === map.id);
        const targetIndex = index + delta;
        if (targetIndex < 0 || targetIndex >= levels.length) return;
        const next = levels.map((level) => level.id);
        [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
        onReorder?.(next);
    };

    const handleDrop = (targetMap: LevelItem) => {
        const draggedId = dragIdRef.current;
        dragIdRef.current = null;
        if (!draggedId || draggedId === targetMap.id) return;
        const ids = levels.map((level) => level.id);
        const from = ids.indexOf(draggedId);
        const to = ids.indexOf(targetMap.id);
        if (from === -1 || to === -1) return;
        ids.splice(to, 0, ids.splice(from, 1)[0]);
        onReorder?.(ids);
    };

    const focusCardAt = (index: number) => {
        const track = trackRef.current;
        if (!track) return;
        const card = track.children[index] as HTMLElement | undefined;
        card?.querySelector<HTMLElement>("[data-level-open]")?.focus();
        card?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", inline: "center", block: "nearest" });
    };

    const handleTrackKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        const track = trackRef.current;
        if (!track) return;
        const cards = Array.from(track.querySelectorAll<HTMLElement>("[data-level-open]"));
        const current = cards.indexOf(document.activeElement as HTMLElement);
        if (current === -1) return;
        e.preventDefault();
        const next = e.key === "ArrowLeft" ? Math.max(0, current - 1) : Math.min(cards.length - 1, current + 1);
        focusCardAt(next);
    };

    return (
        <div className="relative flex-1 overflow-hidden">
            {cover && (
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 scale-110 bg-cover bg-center opacity-40 blur-2xl"
                    style={{ backgroundImage: `url(${cover})` }}
                />
            )}
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-surface/10 via-surface/70 to-surface" />
            <div className="relative flex h-full flex-col justify-center gap-6 px-4 py-10 sm:px-10">
                <div
                    ref={trackRef}
                    role="list"
                    aria-label={es.levels.backToLevels}
                    onKeyDown={handleTrackKeyDown}
                    className="flex snap-x snap-mandatory gap-5 overflow-x-auto px-[10vw] pb-4 pt-2 sm:px-[15vw]"
                >
                    {levels.map((map, index) => (
                        <LevelCard
                            key={map.id}
                            map={map}
                            levelNumber={index + 1}
                            editable={editable}
                            canMoveUp={index > 0}
                            canMoveDown={index < levels.length - 1}
                            onOpen={() => onOpen(map.id)}
                            onRename={onRenameLevel ? () => onRenameLevel(map) : undefined}
                            onDelete={onDeleteLevel ? () => onDeleteLevel(map) : undefined}
                            onMoveUp={() => moveBy(map, -1)}
                            onMoveDown={() => moveBy(map, 1)}
                            onDragStart={() => (dragIdRef.current = map.id)}
                            onDropOn={() => handleDrop(map)}
                        />
                    ))}
                    {editable && onCreateLevel && (
                        <button
                            type="button"
                            onClick={onCreateLevel}
                            className="flex w-[min(80vw,19rem)] shrink-0 snap-center flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-ink/15 bg-surface/70 text-ink-soft transition-colors hover:border-teal-dark hover:text-teal-dark"
                        >
                            <Plus size={28} />
                            <span className="text-sm font-semibold">{es.levels.createLevel}</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const LevelCard = ({
    map,
    levelNumber,
    editable,
    canMoveUp,
    canMoveDown,
    onOpen,
    onRename,
    onDelete,
    onMoveUp,
    onMoveDown,
    onDragStart,
    onDropOn,
}: {
    map: LevelItem;
    levelNumber: number;
    editable: boolean;
    canMoveUp: boolean;
    canMoveDown: boolean;
    onOpen: () => void;
    onRename?: () => void;
    onDelete?: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onDragStart: () => void;
    onDropOn: () => void;
}) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [tilt, setTilt] = useState<{ x: number; y: number } | null>(null);
    const badge = badgeFor(map);

    const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
        if (prefersReducedMotion()) return;
        const rect = cardRef.current?.getBoundingClientRect();
        if (!rect) return;
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        setTilt({ x: px, y: py });
    };

    return (
        <div
            ref={cardRef}
            role="listitem"
            draggable={editable}
            onDragStart={onDragStart}
            onDragOver={(e) => editable && e.preventDefault()}
            onDrop={(e) => {
                e.preventDefault();
                onDropOn();
            }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setTilt(null)}
            style={{
                transform: tilt
                    ? `perspective(800px) rotateX(${-tilt.y * 8}deg) rotateY(${tilt.x * 8}deg) scale(1.02)`
                    : undefined,
                transition: "transform 150ms ease-out",
            }}
            className="group relative w-[min(80vw,19rem)] shrink-0 snap-center"
        >
            <Card className="overflow-hidden">
                <button
                    type="button"
                    data-level-open
                    onClick={onOpen}
                    className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-dark"
                >
                    <div className="relative h-40 w-full overflow-hidden bg-surface-muted">
                        <img src={resolveThumbUrl(map.imageUrl)} alt="" className="h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
                        <span className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-pill bg-surface/90 text-xs font-bold text-ink">
                            {levelNumber}
                        </span>
                        <Badge tone={badge.tone} className="absolute right-3 top-3">
                            {badge.label}
                        </Badge>
                        <p className="absolute bottom-3 left-3 right-3 truncate font-heading text-lg font-semibold text-white">
                            {map.title}
                        </p>
                    </div>
                </button>
                <div className="space-y-2 p-3.5">
                    <div className="flex items-center justify-between text-xs text-slate-dark">
                        <span>{es.home.card.activities(map.bubbleCount)}</span>
                        <span>{es.levels.progress(map.completeCount, map.bubbleCount)}</span>
                    </div>
                    <ProgressBar value={map.completeCount} max={Math.max(map.bubbleCount, 1)} />
                    {editable && map.publication && (
                        <PublicationChip status={map.publication.status} number={map.publication.number} />
                    )}
                </div>
            </Card>
            {editable && (
                <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <IconButton
                        aria-label={es.levels.manage.moveUp}
                        variant="secondary"
                        disabled={!canMoveUp}
                        onClick={onMoveUp}
                        className="h-8 w-8 min-h-0 min-w-0 bg-surface/90"
                    >
                        <ChevronUp size={15} />
                    </IconButton>
                    <IconButton
                        aria-label={es.levels.manage.moveDown}
                        variant="secondary"
                        disabled={!canMoveDown}
                        onClick={onMoveDown}
                        className="h-8 w-8 min-h-0 min-w-0 bg-surface/90"
                    >
                        <ChevronDown size={15} />
                    </IconButton>
                    <DropdownMenu
                        trigger={
                            <IconButton aria-label={map.title} variant="secondary" className="h-8 w-8 min-h-0 min-w-0 bg-surface/90">
                                <MoreVertical size={15} />
                            </IconButton>
                        }
                        items={[
                            ...(onRename ? [{ label: es.levels.manage.rename, icon: <Pencil size={14} />, onSelect: onRename }] : []),
                            ...(onDelete
                                ? [{ label: es.levels.manage.delete, icon: <Trash2 size={14} />, onSelect: onDelete, destructive: true }]
                                : []),
                        ]}
                    />
                </div>
            )}
        </div>
    );
};

export const LevelCarouselEmpty = ({ editable, onCreateLevel }: { editable: boolean; onCreateLevel?: () => void }) => (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center">
        <p className="font-heading text-xl font-semibold text-ink">
            {editable ? es.levels.empty.editorTitle : es.levels.empty.studentTitle}
        </p>
        <p className="max-w-sm text-sm text-ink-soft">
            {editable ? es.levels.empty.editorDescription : es.levels.empty.studentDescription}
        </p>
        {editable && onCreateLevel && (
            <Button onClick={onCreateLevel}>
                <Plus size={16} />
                {es.levels.createLevel}
            </Button>
        )}
    </div>
);
