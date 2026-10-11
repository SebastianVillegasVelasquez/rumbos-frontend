import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { aspectRatiosDiffer, checkDimensions, checkFileBasics, isAssetInUse } from "./assetLimits.ts";

describe("asset limits", () => {
    it("rejects non-image types and oversize files per kind", () => {
        assert.equal(checkFileBasics({ type: "application/pdf", size: 10 }, "background"), "notImage");
        assert.equal(checkFileBasics({ type: "image/png", size: 9 * 1024 * 1024 }, "background"), "tooLarge");
        assert.equal(checkFileBasics({ type: "image/png", size: 3 * 1024 * 1024 }, "bubble"), "tooLarge");
        assert.equal(checkFileBasics({ type: "image/webp", size: 1024 }, "bubble"), null);
    });

    it("rejects dimensions beyond the per-kind maximum", () => {
        assert.equal(checkDimensions(8192, 4000, "background"), null);
        assert.equal(checkDimensions(8193, 100, "background"), "tooBig");
        assert.equal(checkDimensions(1025, 100, "bubble"), "tooBig");
    });

    it("warns about aspect ratios only past a 5% relative difference", () => {
        assert.equal(aspectRatiosDiffer(16 / 9, 16 / 9), false);
        assert.equal(aspectRatiosDiffer(1.78, 1.8), false);
        assert.equal(aspectRatiosDiffer(16 / 9, 3), true);
        assert.equal(aspectRatiosDiffer(16 / 9, 3 / 4), true);
        assert.equal(aspectRatiosDiffer(0, 1), false);
    });

    it("treats any usage as in use", () => {
        assert.equal(isAssetInUse({ maps: 0, skins: 0, publications: 0 }), false);
        assert.equal(isAssetInUse({ maps: 0, skins: 0, publications: 1 }), true);
    });
});
