import { Button } from "../../../../components/ui/Button.tsx";
import { Dialog } from "../../../../components/ui/Dialog.tsx";
import { es } from "../../../../i18n/es.ts";
import type { Warning } from "../../data/types.ts";

interface WarningsDialogProps {
    warnings: Warning[];
    onClose: () => void;
}

// What the server had to adjust while loading a version into the draft (for
// example a skin that no longer exists was reset).
export const WarningsDialog = ({ warnings, onClose }: WarningsDialogProps) => (
    <Dialog open={warnings.length > 0} onOpenChange={(open) => !open && onClose()} title={es.publication.warningsTitle}>
        <ul className="list-inside list-disc space-y-1.5 text-sm text-ink">
            {warnings.map((warning) => (
                <li key={warning.code + warning.message}>{warning.message}</li>
            ))}
        </ul>
        <div className="mt-5 flex justify-end">
            <Button type="button" onClick={onClose}>
                {es.publication.warningsClose}
            </Button>
        </div>
    </Dialog>
);
