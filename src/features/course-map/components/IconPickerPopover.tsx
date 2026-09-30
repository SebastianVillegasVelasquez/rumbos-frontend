import { useEffect, useRef } from "react";
import { ICON_DATA_URIS, ICON_KEYS, ICON_LABELS, type IconKey } from "../icons.ts";

interface IconPickerPopoverProps {
    x: number; // content-space pixels (design-space * current scale)
    y: number; // content-space pixels (design-space * current scale)
    currentIcon?: IconKey;
    onSelect: (icon: IconKey) => void;
    onClose: () => void;
}

// Positioned as a sibling of the Stage inside the same scrollable container,
// using content-space coordinates - it scrolls/stays anchored to the bubble
// automatically as the user pans, with no scroll-tracking code needed.
export const IconPickerPopover = ({ x, y, currentIcon, onSelect, onClose }: IconPickerPopoverProps) => {
    const popoverRef = useRef<HTMLDivElement>(null);

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
            aria-label="Choose bubble icon"
            className="absolute z-20 grid w-44 -translate-x-1/2 -translate-y-[calc(100%+16px)] grid-cols-4 gap-1 rounded-lg border border-gray-200 bg-white p-2 shadow-xl"
            style={{ left: x, top: y }}
        >
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
    );
};
