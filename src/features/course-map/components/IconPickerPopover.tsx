import { useEffect, useRef, useState } from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import { ICON_DATA_URIS_LIGHT, ICON_KEYS, ICON_LABELS, type IconKey } from "../icons.ts";
import type { Activity, Availability, BubbleStatus, Skin } from "../data/types.ts";
import { isSafeActivityUrl } from "../activityOpener.ts";
import { es } from "../../../i18n/es.ts";
import { Button } from "../../../components/ui/Button.tsx";
import { Badge } from "../../../components/ui/Card.tsx";

interface IconPickerPopoverProps {
    x: number; // content-space pixels (design-space * current scale)
    y: number; // content-space pixels (design-space * current scale)
    currentIcon?: IconKey;
    currentStatus: BubbleStatus;
    availability?: Availability;
    resolvedActivity?: Activity | null;
    onSelect: (icon: IconKey) => void;
    onStatusSelect: (status: BubbleStatus) => void;
    onDelete: () => void;
    onClose: () => void;
    // Per-bubble skin override - "apply to this bubble" / "clear override"
    // from the appearance studio's skin gallery happen here, in context,
    // rather than requiring a separate canvas-selection concept in the
    // studio itself.
    skins?: Skin[];
    currentSkinId?: string | null;
    onSkinSelect?: (skinId: string | null) => void;
}

const STATUS_OPTIONS: { value: BubbleStatus; label: string }[] = [
    { value: "locked", label: es.bubble.statusLabels.locked },
    { value: "no_complete", label: es.bubble.statusLabels.no_complete },
    { value: "in_progress", label: es.bubble.statusLabels.in_progress },
    { value: "complete", label: es.bubble.statusLabels.complete },
];

// Positioned as a sibling of the Stage inside the same scrollable container,
// using content-space coordinates - it scrolls/stays anchored to the bubble
// automatically as the user pans, with no scroll-tracking code needed.
export const IconPickerPopover = ({
    x,
    y,
    currentIcon,
    currentStatus,
    availability,
    resolvedActivity,
    onSelect,
    onStatusSelect,
    onDelete,
    onClose,
    skins,
    currentSkinId,
    onSkinSelect,
}: IconPickerPopoverProps) => {
    const popoverRef = useRef<HTMLDivElement>(null);
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

    useEffect(() => {
        const handlePointerDown = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [onClose]);

    return (
        <div
            ref={popoverRef}
            role="menu"
            aria-label={es.bubble.demoStatusLabel}
            className="absolute z-20 w-56 -translate-x-1/2 -translate-y-[calc(100%+16px)] space-y-3 rounded-lg border border-ink/10 bg-surface p-3 shadow-soft"
            style={{ left: x, top: y }}
        >
            {availability === "hidden" && (
                <div className="space-y-1 rounded-md bg-sun-tint p-2">
                    <Badge tone="sun">{es.sidebar.hiddenBadge}</Badge>
                    <p className="text-[11px] text-sun-dark">{es.bubble.hiddenHintEditor}</p>
                </div>
            )}
            {availability === "missing" && (
                <div className="space-y-1 rounded-md bg-coral-tint p-2">
                    <p className="text-[11px] font-medium text-coral-dark">{es.bubble.missingHintEditor}</p>
                </div>
            )}
            {resolvedActivity && isSafeActivityUrl(resolvedActivity.url) && (
                <a
                    href={resolvedActivity.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs font-medium text-teal-dark hover:underline"
                >
                    <ExternalLink size={12} />
                    {es.bubble.openInMoodle}
                </a>
            )}
            <div className="grid grid-cols-4 gap-1.5">
                {ICON_KEYS.map((key) => (
                    <button
                        key={key}
                        type="button"
                        role="menuitemradio"
                        aria-checked={currentIcon ? currentIcon === key : key === "question"}
                        title={ICON_LABELS[key]}
                        onClick={() => onSelect(key)}
                        className={`flex h-9 w-9 items-center justify-center rounded-md border transition-colors hover:bg-teal-tint ${
                            (currentIcon ?? "question") === key ? "border-teal-dark bg-teal-tint" : "border-ink/10"
                        }`}
                    >
                        {ICON_DATA_URIS_LIGHT[key] ? (
                            <span className="flex h-6 w-6 items-center justify-center rounded-pill bg-slate-dark">
                                <img src={ICON_DATA_URIS_LIGHT[key]} alt="" className="h-4 w-4" />
                            </span>
                        ) : (
                            <span className="flex h-6 w-6 items-center justify-center rounded-pill bg-slate-dark text-xs font-bold text-white">
                                ?
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {skins && skins.length > 0 && onSkinSelect && (
                <label className="block space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                        {es.studio.bubbles.applyToSelected}
                    </span>
                    <select
                        value={currentSkinId ?? ""}
                        onChange={(e) => onSkinSelect(e.target.value || null)}
                        className="w-full rounded-md border border-ink/10 px-2 py-1.5 text-xs"
                    >
                        <option value="">{es.studio.bubbles.clearOverride}</option>
                        {skins.map((skin) => (
                            <option key={skin.id} value={skin.id}>
                                {skin.name}
                            </option>
                        ))}
                    </select>
                </label>
            )}

            {/* Demo only: real status will come from Moodle completion in a later phase. */}
            <label className="block space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                    {es.bubble.demoStatusLabel}
                </span>
                <select
                    value={currentStatus}
                    onChange={(e) => onStatusSelect(e.target.value as BubbleStatus)}
                    className="w-full rounded-md border border-ink/10 px-2 py-1.5 text-xs"
                >
                    {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </label>

            <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => (isConfirmingDelete ? onDelete() : setIsConfirmingDelete(true))}
                className="w-full"
            >
                <Trash2 size={14} />
                {isConfirmingDelete ? es.bubble.confirmDelete : es.bubble.removeFromMap}
            </Button>
        </div>
    );
};
