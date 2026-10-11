import { es } from "../../i18n/es.ts";
import type { PublicationChanges } from "./data/types.ts";

// The `changes` diff as plain Spanish sentences, in a stable order, skipping
// whatever did not change ("Fondo cambiado", "3 burbujas movidas", ...).
export const describeChanges = (changes: PublicationChanges): string[] => {
    const text = es.publication.changes;
    return [
        changes.backgroundChanged ? text.background : null,
        changes.titleChanged ? text.title : null,
        changes.settingsChanged ? text.settings : null,
        changes.skinsChanged ? text.skins : null,
        changes.bubblesAdded > 0 ? text.added(changes.bubblesAdded) : null,
        changes.bubblesRemoved > 0 ? text.removed(changes.bubblesRemoved) : null,
        changes.bubblesMoved > 0 ? text.moved(changes.bubblesMoved) : null,
        changes.bubblesRestyled > 0 ? text.restyled(changes.bubblesRestyled) : null,
    ].filter((sentence): sentence is string => sentence !== null);
};
