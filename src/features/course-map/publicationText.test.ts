import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeChanges } from "./publicationText.ts";

const none = {
    backgroundChanged: false,
    titleChanged: false,
    settingsChanged: false,
    skinsChanged: false,
    bubblesAdded: 0,
    bubblesRemoved: 0,
    bubblesMoved: 0,
    bubblesRestyled: 0,
};

describe("describeChanges", () => {
    it("is empty when nothing changed", () => {
        assert.deepEqual(describeChanges(none), []);
    });

    it("lists only what changed, in a stable order", () => {
        assert.deepEqual(describeChanges({ ...none, backgroundChanged: true, bubblesMoved: 3, bubblesAdded: 1 }), [
            "Fondo cambiado",
            "1 burbuja añadida",
            "3 burbujas movidas",
        ]);
    });

    it("uses the singular for a single bubble", () => {
        assert.deepEqual(describeChanges({ ...none, bubblesRemoved: 1, bubblesRestyled: 1 }), [
            "1 burbuja eliminada",
            "1 burbuja con otro estilo",
        ]);
    });
});
