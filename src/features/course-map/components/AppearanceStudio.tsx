import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { ChevronUp, ChevronDown, Play, RotateCcw, Zap } from "lucide-react";
import { Button, IconButton } from "../../../components/ui/Button.tsx";
import { SegmentedControl } from "../../../components/ui/SegmentedControl.tsx";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog.tsx";
import { SkinStudio } from "./SkinStudio.tsx";
import { useAnimationQuality, type QualitySetting } from "../../../fx/quality.ts";
import { useReorderBubbles } from "../data/queries.ts";
import { useUpdateAppearance, useUpdateBubble } from "../data/draftMutations.ts";
import { resolveThumbUrl } from "../data/assets.ts";
import { es } from "../../../i18n/es.ts";
import type {
    AmbientKind,
    Bubble,
    CourseMapRead,
    MapFit,
    MapInitialView,
    MapIntro,
    MapMode,
    MapSettings,
    PathStyle,
    Skin,
    SkinRule,
} from "../data/types.ts";

type Tab = "bubbles" | "map" | "ambient" | "sequence" | "animation";

interface AppearanceStudioProps {
    courseMap: CourseMapRead;
    skins: Skin[];
    getCurrentView: () => MapInitialView | null;
    onClose: () => void;
    onChangeBackground: () => void;
}

const settingsEqual = (a: MapSettings, b: MapSettings) => JSON.stringify(a) === JSON.stringify(b);
const rulesEqual = (a: SkinRule[], b: SkinRule[]) => JSON.stringify(a) === JSON.stringify(b);

export const AppearanceStudio = ({ courseMap, skins, getCurrentView, onClose, onChangeBackground }: AppearanceStudioProps) => {
    const [tab, setTab] = useState<Tab>("bubbles");
    const [settings, setSettings] = useState<MapSettings>(courseMap.settings);
    const [defaultSkinId, setDefaultSkinId] = useState(courseMap.defaultSkinId);
    const [skinRules, setSkinRules] = useState<SkinRule[]>(courseMap.skinRules);
    const [confirmDiscard, setConfirmDiscard] = useState(false);
    const updateAppearance = useUpdateAppearance(courseMap.id);

    // Re-sync the draft whenever a fresh save lands (new updatedAt), but
    // never while the panel is mid-edit otherwise - it would stomp on
    // whatever the user is typing.
    const syncedAtRef = useRef(courseMap.updatedAt);
    useEffect(() => {
        if (courseMap.updatedAt === syncedAtRef.current) return;
        syncedAtRef.current = courseMap.updatedAt;
        setSettings(courseMap.settings);
        setDefaultSkinId(courseMap.defaultSkinId);
        setSkinRules(courseMap.skinRules);
    }, [courseMap]);

    const isDirty =
        !settingsEqual(settings, courseMap.settings) ||
        defaultSkinId !== courseMap.defaultSkinId ||
        !rulesEqual(skinRules, courseMap.skinRules);

    const handleSave = () => {
        updateAppearance.mutate(
            { settings, defaultSkinId, skinRules },
            { onSuccess: (map) => (syncedAtRef.current = map.updatedAt) }
        );
    };

    const handleClose = () => {
        if (isDirty) setConfirmDiscard(true);
        else onClose();
    };

    const setTypeRule = (modname: string, skinId: string | null) => {
        setSkinRules((current) => {
            const withoutModname = current.filter((rule) => rule.modname !== modname);
            return skinId ? [...withoutModname, { modname, skinId }] : withoutModname;
        });
    };

    return (
        <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col border-l border-ink/10 bg-surface shadow-soft">
            <div className="flex items-center justify-between border-b border-ink/10 px-4 py-3">
                <h2 className="font-heading text-base font-semibold text-ink">{es.studio.title}</h2>
                <div className="flex items-center gap-2">
                    {isDirty && <span className="text-xs font-medium text-sun-dark">{es.studio.unsavedChanges}</span>}
                    <IconButton aria-label={es.app.close} variant="ghost" onClick={handleClose} className="h-8 w-8 min-h-0 min-w-0">
                        <X size={16} />
                    </IconButton>
                </div>
            </div>

            <div className="border-b border-ink/10 px-4 py-2">
                <div className="flex flex-wrap gap-1">
                    {(["bubbles", "map", "ambient", "sequence", "animation"] as Tab[]).map((t) => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => setTab(t)}
                            className={`rounded-pill px-3 py-1.5 text-xs font-semibold transition-colors ${
                                tab === t ? "bg-teal-dark text-white" : "text-ink-soft hover:bg-surface-muted"
                            }`}
                        >
                            {es.studio.tabs[t]}
                        </button>
                    ))}
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {tab === "bubbles" && (
                    <SkinStudio
                        skins={skins}
                        defaultSkinId={defaultSkinId}
                        skinRules={skinRules}
                        onSetDefaultSkin={setDefaultSkinId}
                        onSetTypeRule={setTypeRule}
                    />
                )}
                {tab === "map" && (
                    <MapTab settings={settings} onChange={setSettings} getCurrentView={getCurrentView} onChangeBackground={onChangeBackground} currentImageUrl={courseMap.imageUrl} />
                )}
                {tab === "ambient" && <AmbientTab settings={settings} onChange={setSettings} />}
                {tab === "sequence" && <SequenceTab courseMapId={courseMap.id} bubbles={courseMap.bubbles} mode={settings.mode} />}
                {tab === "animation" && <AnimationTab />}
            </div>

            {isDirty && (
                <div className="flex justify-end gap-2 border-t border-ink/10 px-4 py-3">
                    <Button size="sm" variant="secondary" onClick={() => setConfirmDiscard(true)}>
                        {es.app.dismiss}
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={updateAppearance.isPending}>
                        {updateAppearance.isPending ? es.studio.saving : es.studio.save}
                    </Button>
                </div>
            )}
            {updateAppearance.isError && <p className="px-4 pb-3 text-xs text-coral-dark">{es.studio.saveError}</p>}

            {tab === "bubbles" && <ProgressSimulator courseMapId={courseMap.id} bubbles={courseMap.bubbles} mode={settings.mode} />}

            <ConfirmDialog
                open={confirmDiscard}
                onOpenChange={setConfirmDiscard}
                title={es.studio.discardConfirm.title}
                description={es.studio.discardConfirm.description}
                confirmLabel={es.studio.discardConfirm.confirm}
                cancelLabel={es.studio.discardConfirm.cancel}
                destructive
                onConfirm={() => {
                    setSettings(courseMap.settings);
                    setDefaultSkinId(courseMap.defaultSkinId);
                    setSkinRules(courseMap.skinRules);
                    setConfirmDiscard(false);
                    onClose();
                }}
            />
        </div>
    );
};

const MapTab = ({
    settings,
    onChange,
    getCurrentView,
    onChangeBackground,
    currentImageUrl,
}: {
    settings: MapSettings;
    onChange: (s: MapSettings) => void;
    getCurrentView: () => MapInitialView | null;
    onChangeBackground: () => void;
    currentImageUrl: string;
}) => {
    const [viewCaptured, setViewCaptured] = useState(false);

    const handleCaptureView = () => {
        const view = getCurrentView();
        if (!view) return;
        onChange({ ...settings, initialView: view });
        setViewCaptured(true);
        setTimeout(() => setViewCaptured(false), 2000);
    };

    return (
        <div className="space-y-5">
            <fieldset className="space-y-1.5">
                <legend className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{es.studio.map.mode}</legend>
                <SegmentedControl
                    aria-label={es.studio.map.mode}
                    value={settings.mode}
                    onChange={(mode) => onChange({ ...settings, mode: mode as MapMode })}
                    options={[
                        { value: "explorative", label: es.studio.map.modeExplorative },
                        { value: "guided", label: es.studio.map.modeGuided },
                    ]}
                />
                <p className="text-xs text-ink-soft">{settings.mode === "guided" ? es.studio.map.modeGuidedHint : es.studio.map.modeExplorativeHint}</p>
            </fieldset>

            <label className="block space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{es.studio.map.fit}</span>
                <select
                    value={settings.fit}
                    onChange={(e) => onChange({ ...settings, fit: e.target.value as MapFit })}
                    className="w-full rounded-md border border-ink/10 px-2 py-1.5 text-sm"
                >
                    {(Object.keys(es.studio.map.fitOptions) as MapFit[]).map((fit) => (
                        <option key={fit} value={fit}>
                            {es.studio.map.fitOptions[fit]}
                        </option>
                    ))}
                </select>
            </label>

            <Button size="sm" variant="secondary" onClick={handleCaptureView}>
                {es.studio.map.useCurrentView}
            </Button>
            {viewCaptured && <p className="text-xs text-leaf-dark">{es.studio.map.viewCaptured}</p>}

            <label className="block space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{es.studio.map.intro}</span>
                <select
                    value={settings.intro}
                    onChange={(e) => onChange({ ...settings, intro: e.target.value as MapIntro })}
                    className="w-full rounded-md border border-ink/10 px-2 py-1.5 text-sm"
                >
                    <option value="none">{es.studio.map.introOptions.none}</option>
                    <option value="flyin">{es.studio.map.introOptions.flyin}</option>
                </select>
            </label>

            <div className="space-y-2 rounded-md border border-ink/10 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{es.studio.map.path}</p>
                <label className="flex items-center gap-1.5 text-sm text-ink">
                    <input type="checkbox" checked={settings.path.visible} onChange={(e) => onChange({ ...settings, path: { ...settings.path, visible: e.target.checked } })} />
                    {es.studio.map.pathVisible}
                </label>
                <label className="flex items-center gap-1.5 text-sm text-ink">
                    <input type="checkbox" checked={settings.path.animated} onChange={(e) => onChange({ ...settings, path: { ...settings.path, animated: e.target.checked } })} />
                    {es.studio.map.pathAnimated}
                </label>
                <label className="block space-y-1">
                    <span className="text-xs text-ink-soft">{es.studio.map.pathStyle}</span>
                    <select
                        value={settings.path.style}
                        onChange={(e) => onChange({ ...settings, path: { ...settings.path, style: e.target.value as PathStyle } })}
                        className="w-full rounded-md border border-ink/10 px-2 py-1.5 text-sm"
                    >
                        <option value="dashed">{es.studio.map.pathStyles.dashed}</option>
                        <option value="dotted">{es.studio.map.pathStyles.dotted}</option>
                        <option value="solid">{es.studio.map.pathStyles.solid}</option>
                    </select>
                </label>
                <label className="flex items-center gap-2 text-xs text-ink-soft">
                    {es.studio.map.pathColor}
                    <input
                        type="checkbox"
                        checked={settings.path.color === null}
                        onChange={(e) => onChange({ ...settings, path: { ...settings.path, color: e.target.checked ? null : "#0e9aa7" } })}
                    />
                    {es.studio.map.pathColorAuto}
                    {settings.path.color !== null && (
                        <input
                            type="color"
                            value={settings.path.color}
                            onChange={(e) => onChange({ ...settings, path: { ...settings.path, color: e.target.value } })}
                            className="h-7 w-7 cursor-pointer rounded border border-ink/10"
                        />
                    )}
                </label>
            </div>

            <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{es.studio.map.background}</span>
                <div className="flex items-center gap-3">
                    <img src={resolveThumbUrl(currentImageUrl)} alt={es.background.currentBackground} className="h-14 w-20 rounded-md border border-ink/10 object-cover" />
                    <Button size="sm" variant="secondary" onClick={onChangeBackground}>
                        {es.studio.map.changeBackground}
                    </Button>
                </div>
            </div>
        </div>
    );
};

const AMBIENT_KINDS: AmbientKind[] = ["none", "fireflies", "snow", "leaves", "clouds", "sparkles"];

const AmbientTab = ({ settings, onChange }: { settings: MapSettings; onChange: (s: MapSettings) => void }) => (
    <div className="space-y-4">
        <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{es.studio.ambient.kind}</span>
            <select
                value={settings.ambient.kind}
                onChange={(e) => onChange({ ...settings, ambient: { ...settings.ambient, kind: e.target.value as AmbientKind } })}
                className="w-full rounded-md border border-ink/10 px-2 py-1.5 text-sm"
            >
                {AMBIENT_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                        {es.studio.ambient.kinds[kind]}
                    </option>
                ))}
            </select>
        </label>
        {settings.ambient.kind !== "none" && (
            <label className="block space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                    {es.studio.ambient.intensity} ({Math.round(settings.ambient.intensity * 100)}%)
                </span>
                <input
                    type="range"
                    min={0}
                    max={100}
                    value={settings.ambient.intensity * 100}
                    onChange={(e) => onChange({ ...settings, ambient: { ...settings.ambient, intensity: Number(e.target.value) / 100 } })}
                    className="w-full"
                />
            </label>
        )}
    </div>
);

const SequenceTab = ({ courseMapId, bubbles, mode }: { courseMapId: string; bubbles: Bubble[]; mode: MapMode }) => {
    const reorderBubbles = useReorderBubbles(courseMapId);
    const sorted = [...bubbles].sort((a, b) => a.sequence - b.sequence);

    if (mode !== "guided") return <p className="text-sm text-ink-soft">{es.studio.sequence.onlyGuided}</p>;
    if (sorted.length === 0) return <p className="text-sm text-ink-soft">{es.studio.sequence.empty}</p>;

    const moveBy = (bubbleId: string, delta: number) => {
        const index = sorted.findIndex((b) => b.id === bubbleId);
        const target = index + delta;
        if (target < 0 || target >= sorted.length) return;
        const ids = sorted.map((b) => b.id);
        [ids[index], ids[target]] = [ids[target], ids[index]];
        reorderBubbles.mutate(ids);
    };

    return (
        <div className="space-y-2">
            <p className="text-xs text-ink-soft">{es.studio.sequence.hint}</p>
            <ol className="space-y-1.5">
                {sorted.map((bubble, index) => (
                    <li key={bubble.id} className="flex items-center gap-2 rounded-md border border-ink/10 px-2.5 py-1.5 text-sm">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-pill bg-surface-muted text-xs font-bold text-ink-soft">
                            {index + 1}
                        </span>
                        <span className="flex-1 truncate text-ink">{bubble.activityId}</span>
                        <IconButton aria-label={es.studio.sequence.moveUp} variant="ghost" disabled={index === 0} onClick={() => moveBy(bubble.id, -1)} className="h-7 w-7 min-h-0 min-w-0">
                            <ChevronUp size={14} />
                        </IconButton>
                        <IconButton
                            aria-label={es.studio.sequence.moveDown}
                            variant="ghost"
                            disabled={index === sorted.length - 1}
                            onClick={() => moveBy(bubble.id, 1)}
                            className="h-7 w-7 min-h-0 min-w-0"
                        >
                            <ChevronDown size={14} />
                        </IconButton>
                    </li>
                ))}
            </ol>
        </div>
    );
};

const AnimationTab = () => {
    const { setting, setSetting } = useAnimationQuality();
    return (
        <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{es.animationQuality.label}</span>
            <select
                value={setting}
                onChange={(e) => setSetting(e.target.value as QualitySetting)}
                className="w-full rounded-md border border-ink/10 px-2 py-1.5 text-sm"
            >
                {(["auto", "high", "medium", "low", "off"] as const).map((option) => (
                    <option key={option} value={option}>
                        {es.animationQuality.options[option]}
                    </option>
                ))}
            </select>
        </label>
    );
};

// Sequential PATCHes with a small concurrency cap - a demo convenience for
// the editor to see the whole experience without real student progress.
const withConcurrency = async <T,>(items: T[], limit: number, worker: (item: T) => Promise<unknown>) => {
    let index = 0;
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (index < items.length) {
            const item = items[index++];
            await worker(item);
        }
    });
    await Promise.all(runners);
};

const ProgressSimulator = ({ courseMapId, bubbles, mode }: { courseMapId: string; bubbles: Bubble[]; mode: MapMode }) => {
    const updateBubble = useUpdateBubble(courseMapId);
    const [isRunning, setIsRunning] = useState(false);
    const sorted = [...bubbles].sort((a, b) => a.sequence - b.sequence);

    const completeNext = () => {
        const next = sorted.find((b) => b.status !== "complete");
        if (next) updateBubble.mutate({ bubbleId: next.id, input: { status: "complete" } });
    };

    const completeAll = async () => {
        setIsRunning(true);
        await withConcurrency(
            sorted.filter((b) => b.status !== "complete"),
            3,
            (bubble) => updateBubble.mutateAsync({ bubbleId: bubble.id, input: { status: "complete" } })
        );
        setIsRunning(false);
    };

    const reset = async () => {
        setIsRunning(true);
        const minSequence = Math.min(...sorted.map((b) => b.sequence));
        await withConcurrency(sorted, 3, (bubble) =>
            updateBubble.mutateAsync({
                bubbleId: bubble.id,
                input: { status: mode === "guided" && bubble.sequence > minSequence ? "locked" : "no_complete" },
            })
        );
        setIsRunning(false);
    };

    return (
        <div className="flex items-center gap-1.5 border-t border-ink/10 px-4 py-2.5">
            <span className="mr-auto text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{es.studio.simulator.title}</span>
            <IconButton aria-label={es.studio.simulator.completeNext} variant="ghost" onClick={completeNext} disabled={isRunning} className="h-7 w-7 min-h-0 min-w-0">
                <Play size={13} />
            </IconButton>
            <IconButton aria-label={es.studio.simulator.completeAll} variant="ghost" onClick={() => void completeAll()} disabled={isRunning} className="h-7 w-7 min-h-0 min-w-0">
                <Zap size={13} />
            </IconButton>
            <IconButton aria-label={es.studio.simulator.reset} variant="ghost" onClick={() => void reset()} disabled={isRunning} className="h-7 w-7 min-h-0 min-w-0">
                <RotateCcw size={13} />
            </IconButton>
        </div>
    );
};
