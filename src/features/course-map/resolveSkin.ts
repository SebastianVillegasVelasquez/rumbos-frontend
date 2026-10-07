import type { ProceduralSkin, Skin, SkinConfig, SkinRule } from "./data/types.ts";

// Hard-coded last resort when nothing resolves (missing skin id, empty skin
// list before it loads, etc) - degrades gracefully instead of crashing the
// canvas. Mirrors the "Orbe" built-in's look.
export const FALLBACK_SKIN: ProceduralSkin = {
    schemaVersion: 1,
    kind: "procedural",
    shape: "circle",
    size: 64,
    palette: {
        locked: { fill: "#5b6478", accent: "#3f4654", glow: "#8a94a6" },
        available: { fill: "#ffb703", accent: "#e08e00", glow: "#ffd866" },
        inProgress: { fill: "#0b7a85", accent: "#086570", glow: "#0e9aa7" },
        complete: { fill: "#178049", accent: "#115f37", glow: "#2fbf71" },
    },
    icon: { mode: "auto", preset: null, color: "auto" },
    label: { mode: "hover" },
    effects: { idle: "breathe", ring: true, glow: true, completion: "ripple" },
};

export interface ResolveSkinInput {
    bubbleSkinId: string | null;
    modname: string | undefined;
    skinRules: SkinRule[];
    defaultSkinId: string | null;
    skins: Skin[];
}

// bubble.skinId -> skinRules[modname] -> map.defaultSkinId -> the skin with
// isDefault -> FALLBACK_SKIN. Every step degrades to the next on a miss
// (deleted skin, unset rule, etc), so this never throws.
export function resolveSkin({ bubbleSkinId, modname, skinRules, defaultSkinId, skins }: ResolveSkinInput): SkinConfig {
    const configFor = (id: string | null) => (id ? skins.find((skin) => skin.id === id)?.config : undefined);

    const ruleSkinId = modname ? skinRules.find((rule) => rule.modname === modname)?.skinId ?? null : null;

    return (
        configFor(bubbleSkinId) ??
        configFor(ruleSkinId) ??
        configFor(defaultSkinId) ??
        skins.find((skin) => skin.isDefault)?.config ??
        FALLBACK_SKIN
    );
}
