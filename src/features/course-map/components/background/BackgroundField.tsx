import { useState } from "react";
import { ImageIcon } from "lucide-react";
import { Button } from "../../../../components/ui/Button.tsx";
import { es } from "../../../../i18n/es.ts";
import { resolveThumbUrl } from "../../data/assets.ts";
import { LazyBackgroundPicker } from "./LazyBackgroundPicker.tsx";

export interface BackgroundChoice {
    imageUrl: string;
    label: string;
}

interface BackgroundFieldProps {
    value: BackgroundChoice | null;
    onChange: (choice: BackgroundChoice) => void;
}

// The background control of the create-level dialogs: shows the current choice
// and opens the same picker used to replace a level's background.
export const BackgroundField = ({ value, onChange }: BackgroundFieldProps) => {
    const [open, setOpen] = useState(false);

    return (
        <div className="flex items-center gap-3">
            <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-ink/10 bg-surface-muted">
                {value ? (
                    <img src={resolveThumbUrl(value.imageUrl)} alt="" className="h-full w-full object-cover" />
                ) : (
                    <ImageIcon size={20} aria-hidden className="text-ink-soft" />
                )}
            </div>
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{value?.label ?? es.background.chooseLabel}</p>
                <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)} className="mt-1">
                    {value ? es.background.change : es.background.chooseLabel}
                </Button>
            </div>
            <LazyBackgroundPicker
                open={open}
                onOpenChange={setOpen}
                currentImageUrl={value?.imageUrl ?? null}
                onChoose={onChange}
            />
        </div>
    );
};
