import type {
    CourseMapRead,
    MapSettings,
    PublishedMapRead,
    RenderableBubble,
    Skin,
    SkinRule,
} from "./data/types.ts";

// One normalized shape for everything that draws a map (canvas, FX engine,
// skin resolution), regardless of where it came from. Editors render the draft
// and students render a published snapshot; both are adapted into this so the
// renderer never has to know the difference.
export interface RenderableMap {
    id: string;
    title: string;
    moodleCourseId: number;
    moodleSectionId: number | null;
    imageUrl: string;
    settings: MapSettings;
    defaultSkinId: string | null;
    skinRules: SkinRule[];
    // Skins to resolve against: the live /skins list for a draft, the frozen
    // copies stored in the snapshot for a publication.
    skins: Skin[];
    bubbles: RenderableBubble[];
    source: "draft" | "published";
    publicationNumber: number | null;
}

export const draftToRenderable = (map: CourseMapRead, skins: Skin[]): RenderableMap => ({
    id: map.id,
    title: map.title,
    moodleCourseId: map.moodleCourseId,
    moodleSectionId: map.moodleSectionId,
    imageUrl: map.imageUrl,
    settings: map.settings,
    defaultSkinId: map.defaultSkinId,
    skinRules: map.skinRules,
    skins,
    bubbles: map.bubbles,
    source: "draft",
    publicationNumber: null,
});

export const publishedToRenderable = (map: PublishedMapRead): RenderableMap => ({
    id: map.id,
    title: map.title,
    moodleCourseId: map.moodleCourseId,
    moodleSectionId: map.moodleSectionId,
    imageUrl: map.imageUrl,
    settings: map.settings,
    defaultSkinId: map.defaultSkinId,
    skinRules: map.skinRules,
    skins: Object.entries(map.skins).map(([id, skin]) => ({
        id,
        name: skin.name,
        builtin: false,
        isDefault: skin.isDefault,
        config: skin.config,
        createdAt: map.publishedAt,
        updatedAt: map.publishedAt,
    })),
    bubbles: map.bubbles,
    source: "published",
    publicationNumber: map.publicationNumber,
});
