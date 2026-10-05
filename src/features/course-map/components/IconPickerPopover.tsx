import { useEffect, useRef, useState } from "react";
import { ICON_DATA_URIS, ICON_KEYS, ICON_LABELS, type IconKey } from "../icons.ts";
import type { BubbleStatus } from "../data/types.ts";

interface IconPickerPopoverProps {
    x: number; // content-space pixels (design-space * current scale)
    y: number; // content-space pixels (design-space * current scale)
    currentIcon?: IconKey;
    currentStatus: BubbleStatus;
    onSelect: (icon: IconKey) => void;
    onStatusSelect: (status: BubbleStatus) => void;
    onDelete: () => void;
    onClose: () => void;
}

const STATUS_OPTIONS: { value: BubbleStatus; label: string }[] = [
    { value: "locked", label: "Locked" },
    { value: "no_complete", label: "Not started" },
    { value: "in_progress", label: "In progress" },
    { value: "complete", label: "Complete" },
];

// Positioned as a sibling of the Stage inside the same scrollable container,
// using content-space coordinates - it scrolls/stays anchored to the bubble
// automatically as the user pans, with no scroll-tracking code needed.
export const IconPickerPopover = ({
    x,
    y,
    currentIcon,
    currentStatus,
    onSelect,
    onStatusSelect,
    onDelete,
    onClose,
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
            aria-label="Bubble options"
            className="absolute z-20 w-52 -translate-x-1/2 -translate-y-[calc(100%+16px)] space-y-3 rounded-lg border border-gray-200 bg-white p-2 shadow-xl"
            style={{ left: x, top: y }}
        >
            <div className="grid grid-cols-4 gap-1">
                {ICON_KEYS.map((key) => (
                    <button
                        key={key}
                        type="button"
                        role="menuitemradio"
                        aria-checked={currentIcon ? currentIcon === key : key === "question"}
                        title={ICON_LABELS[key]}
                        onClick={() => onSelect(key)}
                        className={`flex h-9 w-9 items-center justify-center rounded-md border text-sm hover:bg-blue-50 ${
                            (currentIcon ?? "question") === key ? "border-blue-500 bg-blue-50" : "border-gray-200"
                        }`}
                    >
                        {ICON_DATA_URIS[key] ? (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-500">
                                <img src={ICON_DATA_URIS[key]} alt="" className="h-4 w-4" />
                            </span>
                        ) : (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-500 text-xs font-bold text-white">
                                ?
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Demo only: real status will come from Moodle completion in a later phase. */}
            <label className="block space-y-1">
                <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                    Demo status
                </span>
                <select
                    value={currentStatus}
                    onChange={(e) => onStatusSelect(e.target.value as BubbleStatus)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                >
                    {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </label>

            <button
                type="button"
                onClick={() => (isConfirmingDelete ? onDelete() : setIsConfirmingDelete(true))}
                className="w-full rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
            >
                {isConfirmingDelete ? "Confirm delete" : "Delete bubble"}
            </button>
        </div>
    );
};
