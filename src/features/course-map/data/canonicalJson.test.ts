import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canonicalJson, sha256Hex } from "./canonicalJson.ts";

describe("canonicalJson", () => {
    it("ignores object key order at every depth", () => {
        const a = { b: 1, a: { d: [1, { y: 1, x: 2 }], c: null } };
        const b = { a: { c: null, d: [1, { x: 2, y: 1 }] }, b: 1 };
        assert.equal(canonicalJson(a), canonicalJson(b));
    });

    it("keeps array order significant", () => {
        assert.notEqual(canonicalJson([1, 2]), canonicalJson([2, 1]));
    });

    it("drops undefined object fields like JSON.stringify", () => {
        assert.equal(canonicalJson({ a: 1, b: undefined }), '{"a":1}');
    });

    it("hashes equal content equally and different content differently", async () => {
        const first = await sha256Hex(canonicalJson({ x: 0.5, y: 0.25 }));
        assert.equal(first, await sha256Hex(canonicalJson({ y: 0.25, x: 0.5 })));
        assert.notEqual(first, await sha256Hex(canonicalJson({ x: 0.5, y: 0.26 })));
        assert.match(first, /^[0-9a-f]{64}$/);
    });
});
