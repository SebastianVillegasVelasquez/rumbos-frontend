import { useRef, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { SkinPreviewRow } from "./SkinPreview.tsx";
import { Button, IconButton } from "../../../components/ui/Button.tsx";
import { Badge } from "../../../components/ui/Card.tsx";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog.tsx";
import { DropdownMenu } from "../../../components/ui/DropdownMenu.tsx";
import { useCreateAsset, useCreateSkin, useDeleteSkin, useUpdateSkin } from "../data/queries.ts";
import { ApiError } from "../data/client.ts";
import { ICON_KEYS, ICON_LABELS, type IconKey } from "../icons.ts";
import { contrastRatio } from "../color.ts";
import { es } from "../../../i18n/es.ts";
import type {
    AssetKind,
    ImageSkin,
    ImageSkinState,
    ProceduralSkin,
    Skin,
    SkinConfig,
    SkinPalette,
    SkinShape,
} from "../data/types.ts";

const MODNAMES = ["quiz", "scorm", "customcert", "assign", "resource", "url"] as const;

const PALETTE_STATES: (keyof SkinPalette)[] = ["locked", "available", "inProgress", "complete"];

const DEFAULT_PALETTE: SkinPalette = {
    locked: { fill: "#5b6478", accent: "#3f4654", glow: "#8a94a6" },
    available: { fill: "#ffb703", accent: "#e08e00", glow: "#ffd866" },
    inProgress: { fill: "#0b7a85", accent: "#086570", glow: "#0e9aa7" },
    complete: { fill: "#178049", accent: "#115f37", glow: "#2fbf71" },
};

const blankProcedural = (): ProceduralSkin => ({
    schemaVersion: 1,
    kind: "procedural",
    shape: "circle",
    size: 64,
    palette: DEFAULT_PALETTE,
    icon: { mode: "auto", preset: null, color: "auto" },
    label: { mode: "hover" },
    effects: { idle: "breathe", ring: true, glow: true, completion: "ripple" },
});

const blankImage = (): ImageSkin => ({
    schemaVersion: 1,
    kind: "image",
    size: 96,
    anchor: "center",
    states: { available: "", locked: null, next: null, inProgress: null, complete: null, hover: null },
    label: { mode: "hover" },
    effects: { idle: "none", completion: "ripple" },
});

interface SkinStudioProps {
    skins: Skin[];
    defaultSkinId: string | null;
    skinRules: { modname: string; skinId: string }[];
    onSetDefaultSkin: (skinId: string) => void;
    onSetTypeRule: (modname: string, skinId: string | null) => void;
}

export const SkinStudio = ({ skins, defaultSkinId, skinRules, onSetDefaultSkin, onSetTypeRule }: SkinStudioProps) => {
    const [editingSkin, setEditingSkin] = useState<Skin | "new-procedural" | "new-image" | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Skin | null>(null);
    const [typeRuleModname, setTypeRuleModname] = useState<string>(MODNAMES[0]);
    const deleteSkin = useDeleteSkin();

    if (editingSkin) {
        const initial =
            editingSkin === "new-procedural"
                ? { name: "", config: blankProcedural() }
                : editingSkin === "new-image"
                  ? { name: "", config: blankImage() }
                  : { name: editingSkin.name, config: editingSkin.config, skinId: editingSkin.id };
        return (
            <SkinEditor
                initialName={initial.name}
                initialConfig={initial.config}
                skinId={"skinId" in initial ? initial.skinId : undefined}
                onDone={() => setEditingSkin(null)}
            />
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{es.studio.bubbles.gallery}</h3>
                <div className="flex gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => setEditingSkin("new-procedural")}>
                        <Plus size={14} />
                        {es.studio.bubbles.newProcedural}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setEditingSkin("new-image")}>
                        <Plus size={14} />
                        {es.studio.bubbles.newImage}
                    </Button>
                </div>
            </div>

            <div className="space-y-3">
                {skins.map((skin) => (
                    <div key={skin.id} className="space-y-2 rounded-md border border-ink/10 p-3">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-ink">{skin.name}</span>
                                {skin.builtin && <Badge tone="slate">{es.studio.bubbles.builtin}</Badge>}
                                {defaultSkinId === skin.id && <Badge tone="teal">{es.studio.bubbles.isDefault}</Badge>}
                            </div>
                            <DropdownMenu
                                trigger={
                                    <IconButton aria-label={skin.name} variant="ghost" className="h-7 w-7 min-h-0 min-w-0">
                                        <Pencil size={13} />
                                    </IconButton>
                                }
                                items={[
                                    { label: es.studio.bubbles.rename, icon: <Pencil size={14} />, onSelect: () => setEditingSkin(skin) },
                                    ...(skin.builtin
                                        ? []
                                        : [
                                              {
                                                  label: es.studio.bubbles.delete,
                                                  icon: <Trash2 size={14} />,
                                                  onSelect: () => setDeleteTarget(skin),
                                                  destructive: true,
                                              },
                                          ]),
                                ]}
                            />
                        </div>
                        <div className="overflow-x-auto">
                            <SkinPreviewRow skin={skin.config} />
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            <Button size="sm" variant="secondary" disabled={defaultSkinId === skin.id} onClick={() => onSetDefaultSkin(skin.id)}>
                                {es.studio.bubbles.applyAsDefault}
                            </Button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="space-y-2 rounded-md border border-ink/10 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{es.activityTypes.default}</p>
                <div className="flex flex-wrap items-center gap-2">
                    <select
                        value={typeRuleModname}
                        onChange={(e) => setTypeRuleModname(e.target.value)}
                        className="rounded-md border border-ink/10 px-2 py-1.5 text-xs"
                    >
                        {MODNAMES.map((modname) => (
                            <option key={modname} value={modname}>
                                {es.activityTypes[modname]}
                            </option>
                        ))}
                    </select>
                    <select
                        value={skinRules.find((rule) => rule.modname === typeRuleModname)?.skinId ?? ""}
                        onChange={(e) => onSetTypeRule(typeRuleModname, e.target.value || null)}
                        className="flex-1 rounded-md border border-ink/10 px-2 py-1.5 text-xs"
                    >
                        <option value="">{es.studio.bubbles.clearOverride}</option>
                        {skins.map((skin) => (
                            <option key={skin.id} value={skin.id}>
                                {skin.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {deleteTarget && (
                <ConfirmDialog
                    open
                    onOpenChange={() => setDeleteTarget(null)}
                    title={es.studio.bubbles.deleteConfirm.title}
                    description={es.studio.bubbles.deleteConfirm.description}
                    confirmLabel={es.studio.bubbles.deleteConfirm.confirm}
                    cancelLabel={es.studio.bubbles.deleteConfirm.cancel}
                    onConfirm={() => deleteSkin.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
                />
            )}
        </div>
    );
};

const SkinEditor = ({
    initialName,
    initialConfig,
    skinId,
    onDone,
}: {
    initialName: string;
    initialConfig: SkinConfig;
    skinId?: string;
    onDone: () => void;
}) => {
    const [name, setName] = useState(initialName);
    const [config, setConfig] = useState<SkinConfig>(initialConfig);
    const createSkin = useCreateSkin();
    const updateSkin = useUpdateSkin();
    const isSaving = createSkin.isPending || updateSkin.isPending;

    const handleSave = () => {
        if (!name.trim()) return;
        if (skinId) {
            updateSkin.mutate({ skinId, input: { name: name.trim(), config } }, { onSuccess: onDone });
        } else {
            createSkin.mutate({ name: name.trim(), config }, { onSuccess: onDone });
        }
    };

    return (
        <div className="space-y-4">
            <label className="block space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{es.studio.bubbles.name}</span>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={60}
                    className="w-full rounded-md border border-ink/10 px-3 py-2 text-sm focus:border-teal-dark focus:outline-none"
                />
            </label>

            <div className="rounded-md border border-ink/10 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">{es.studio.bubbles.preview}</p>
                <div className="overflow-x-auto">
                    <SkinPreviewRow skin={config} size={56} />
                </div>
            </div>

            {config.kind === "procedural" ? (
                <ProceduralFields config={config} onChange={setConfig} />
            ) : (
                <ImageFields config={config} onChange={setConfig} />
            )}

            <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="secondary" onClick={onDone}>
                    {es.levels.create.cancel}
                </Button>
                <Button type="button" onClick={handleSave} disabled={isSaving || !name.trim()}>
                    {isSaving ? es.studio.saving : es.studio.save}
                </Button>
            </div>
        </div>
    );
};

const ProceduralFields = ({ config, onChange }: { config: ProceduralSkin; onChange: (c: ProceduralSkin) => void }) => {
    const contrastWarning =
        config.icon.color !== "auto" &&
        PALETTE_STATES.some((state) => contrastRatio(config.palette[state].fill, config.icon.color as string) < 2.5);

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{es.studio.bubbles.shape}</span>
                    <select
                        value={config.shape}
                        onChange={(e) => onChange({ ...config, shape: e.target.value as SkinShape })}
                        className="w-full rounded-md border border-ink/10 px-2 py-1.5 text-sm"
                    >
                        {(Object.keys(es.studio.bubbles.shapes) as SkinShape[]).map((shape) => (
                            <option key={shape} value={shape}>
                                {es.studio.bubbles.shapes[shape]}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                        {es.studio.bubbles.size} ({config.size}px)
                    </span>
                    <input
                        type="range"
                        min={32}
                        max={160}
                        value={config.size}
                        onChange={(e) => onChange({ ...config, size: Number(e.target.value) })}
                        className="w-full"
                    />
                </label>
            </div>

            <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{es.studio.bubbles.palette}</span>
                {PALETTE_STATES.map((state) => (
                    <div key={state} className="flex items-center gap-2 text-xs">
                        <span className="w-20 shrink-0 text-ink-soft">{es.studio.bubbles.paletteStates[state]}</span>
                        {(["fill", "accent", "glow"] as const).map((channel) => (
                            <label key={channel} className="flex items-center gap-1">
                                <input
                                    type="color"
                                    value={config.palette[state][channel]}
                                    onChange={(e) =>
                                        onChange({
                                            ...config,
                                            palette: { ...config.palette, [state]: { ...config.palette[state], [channel]: e.target.value } },
                                        })
                                    }
                                    className="h-7 w-7 cursor-pointer rounded border border-ink/10"
                                    aria-label={`${es.studio.bubbles.paletteStates[state]} ${channel}`}
                                />
                            </label>
                        ))}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{es.studio.bubbles.icon}</span>
                    <select
                        value={config.icon.mode}
                        onChange={(e) => onChange({ ...config, icon: { ...config.icon, mode: e.target.value as ProceduralSkin["icon"]["mode"] } })}
                        className="w-full rounded-md border border-ink/10 px-2 py-1.5 text-sm"
                    >
                        <option value="auto">{es.studio.bubbles.iconModes.auto}</option>
                        <option value="preset">{es.studio.bubbles.iconModes.preset}</option>
                        <option value="none">{es.studio.bubbles.iconModes.none}</option>
                    </select>
                </label>
                {config.icon.mode === "preset" && (
                    <label className="block space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">&nbsp;</span>
                        <select
                            value={config.icon.preset ?? ""}
                            onChange={(e) => onChange({ ...config, icon: { ...config.icon, preset: (e.target.value || null) as IconKey | null } })}
                            className="w-full rounded-md border border-ink/10 px-2 py-1.5 text-sm"
                        >
                            {ICON_KEYS.map((key) => (
                                <option key={key} value={key}>
                                    {ICON_LABELS[key]}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
                <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{es.studio.bubbles.iconColor}</span>
                    <div className="flex items-center gap-2">
                        <select
                            value={config.icon.color === "auto" ? "auto" : "custom"}
                            onChange={(e) =>
                                onChange({ ...config, icon: { ...config.icon, color: e.target.value === "auto" ? "auto" : "#FFFFFF" } })
                            }
                            className="rounded-md border border-ink/10 px-2 py-1.5 text-sm"
                        >
                            <option value="auto">{es.studio.bubbles.iconColorAuto}</option>
                            <option value="custom">{es.studio.bubbles.iconColor}</option>
                        </select>
                        {config.icon.color !== "auto" && (
                            <input
                                type="color"
                                value={config.icon.color}
                                onChange={(e) => onChange({ ...config, icon: { ...config.icon, color: e.target.value } })}
                                className="h-7 w-7 cursor-pointer rounded border border-ink/10"
                            />
                        )}
                    </div>
                </label>
                <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{es.studio.bubbles.label}</span>
                    <select
                        value={config.label.mode}
                        onChange={(e) => onChange({ ...config, label: { mode: e.target.value as ProceduralSkin["label"]["mode"] } })}
                        className="w-full rounded-md border border-ink/10 px-2 py-1.5 text-sm"
                    >
                        <option value="hover">{es.studio.bubbles.labelModes.hover}</option>
                        <option value="always">{es.studio.bubbles.labelModes.always}</option>
                        <option value="never">{es.studio.bubbles.labelModes.never}</option>
                    </select>
                </label>
            </div>
            {contrastWarning && <p className="text-xs text-sun-dark">{es.studio.bubbles.contrastWarning}</p>}

            <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{es.studio.bubbles.idleEffect}</span>
                    <select
                        value={config.effects.idle}
                        onChange={(e) => onChange({ ...config, effects: { ...config.effects, idle: e.target.value as ProceduralSkin["effects"]["idle"] } })}
                        className="w-full rounded-md border border-ink/10 px-2 py-1.5 text-sm"
                    >
                        <option value="none">{es.studio.bubbles.idleEffects.none}</option>
                        <option value="float">{es.studio.bubbles.idleEffects.float}</option>
                        <option value="pulse">{es.studio.bubbles.idleEffects.pulse}</option>
                        <option value="breathe">{es.studio.bubbles.idleEffects.breathe}</option>
                    </select>
                </label>
                <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{es.studio.bubbles.completionEffect}</span>
                    <select
                        value={config.effects.completion}
                        onChange={(e) =>
                            onChange({ ...config, effects: { ...config.effects, completion: e.target.value as ProceduralSkin["effects"]["completion"] } })
                        }
                        className="w-full rounded-md border border-ink/10 px-2 py-1.5 text-sm"
                    >
                        <option value="none">{es.studio.bubbles.completionEffects.none}</option>
                        <option value="ripple">{es.studio.bubbles.completionEffects.ripple}</option>
                        <option value="burst">{es.studio.bubbles.completionEffects.burst}</option>
                    </select>
                </label>
                <label className="flex items-center gap-1.5 text-xs text-ink">
                    <input type="checkbox" checked={config.effects.ring} onChange={(e) => onChange({ ...config, effects: { ...config.effects, ring: e.target.checked } })} />
                    {es.studio.bubbles.ring}
                </label>
                <label className="flex items-center gap-1.5 text-xs text-ink">
                    <input type="checkbox" checked={config.effects.glow} onChange={(e) => onChange({ ...config, effects: { ...config.effects, glow: e.target.checked } })} />
                    {es.studio.bubbles.glowEffect}
                </label>
            </div>
        </div>
    );
};

const IMAGE_STATE_KEYS: ImageSkinState[] = ["available", "locked", "next", "inProgress", "complete", "hover"];

const ImageFields = ({ config, onChange }: { config: ImageSkin; onChange: (c: ImageSkin) => void }) => {
    const createAsset = useCreateAsset();
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [uploadingState, setUploadingState] = useState<ImageSkinState | null>(null);
    const fileInputs = useRef<Partial<Record<ImageSkinState, HTMLInputElement | null>>>({});

    const kind: AssetKind = "bubble";

    const handleFile = (state: ImageSkinState, file: File | undefined) => {
        if (!file) return;
        setUploadError(null);
        setUploadingState(state);
        createAsset.mutate(
            { file, kind },
            {
                onSuccess: ({ asset }) => {
                    setUploadingState(null);
                    onChange({ ...config, states: { ...config.states, [state]: asset.id } });
                },
                onError: (error) => {
                    setUploadingState(null);
                    const code = error instanceof ApiError ? error.detail.code : "unknown_error";
                    setUploadError(es.studio.bubbles.uploadErrors[code as keyof typeof es.studio.bubbles.uploadErrors] ?? es.studio.bubbles.uploadErrors.unknown_error);
                },
            }
        );
    };

    return (
        <div className="space-y-4">
            <p className="text-xs text-ink-soft">{es.studio.bubbles.imageUploadHint}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {IMAGE_STATE_KEYS.map((state) => {
                    const assetId = config.states[state];
                    return (
                        <div key={state} className="space-y-1">
                            <span className="text-[11px] font-medium text-ink-soft">{es.studio.bubbles.imageStates[state]}</span>
                            <button
                                type="button"
                                onClick={() => fileInputs.current[state]?.click()}
                                className="flex h-20 w-full items-center justify-center rounded-md border-2 border-dashed border-ink/15 bg-surface-muted text-xs text-ink-soft hover:border-teal-dark"
                            >
                                {uploadingState === state ? es.studio.bubbles.uploading : assetId ? "✓" : "+"}
                            </button>
                            <input
                                ref={(el) => {
                                    fileInputs.current[state] = el;
                                }}
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                className="hidden"
                                onChange={(e) => handleFile(state, e.target.files?.[0])}
                            />
                        </div>
                    );
                })}
            </div>
            {uploadError && <p className="text-xs text-coral-dark">{uploadError}</p>}
            <p className="text-xs text-ink-soft">{es.studio.bubbles.imageFallbackNote}</p>

            <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{es.studio.bubbles.anchor}</span>
                    <select
                        value={config.anchor}
                        onChange={(e) => onChange({ ...config, anchor: e.target.value as ImageSkin["anchor"] })}
                        className="w-full rounded-md border border-ink/10 px-2 py-1.5 text-sm"
                    >
                        <option value="center">{es.studio.bubbles.anchors.center}</option>
                        <option value="bottom">{es.studio.bubbles.anchors.bottom}</option>
                    </select>
                </label>
                <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                        {es.studio.bubbles.size} ({config.size}px)
                    </span>
                    <input
                        type="range"
                        min={32}
                        max={320}
                        value={config.size}
                        onChange={(e) => onChange({ ...config, size: Number(e.target.value) })}
                        className="w-full"
                    />
                </label>
            </div>
        </div>
    );
};
