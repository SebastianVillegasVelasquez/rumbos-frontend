import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";
import { es } from "../../../../i18n/es.ts";
import { resolveImageUrl } from "../../data/assets.ts";
import { aspectRatiosDiffer } from "../../data/assetLimits.ts";
import type { Bubble } from "../../data/types.ts";
import type { RenderableMap } from "../../renderable.ts";
import { useImageSize } from "./useImageSize.ts";

// Same lazy boundary App uses: Konva stays out of any bundle that never shows a map.
const MapCanvas = lazy(() => import("../MapCanvas.tsx").then((m) => ({ default: m.MapCanvas })));

const NO_AMBIENT = { kind: "none", intensity: 0 } as const;

const formatRatio = (ratio: number) => `${ratio.toLocaleString("es", { maximumFractionDigits: 2 })} : 1`;

interface BackgroundPreviewProps {
    map: RenderableMap;
    currentImageUrl: string;
    nextImageUrl: string;
    getModnameForBubble?: (bubble: Pick<Bubble, "activityId">) => string | undefined;
    notice?: string | null;
}

// The chosen image under the map's own bubbles, drawn by the real renderer so
// what people see here is what the map will look like once applied.
export const BackgroundPreview = ({ map, currentImageUrl, nextImageUrl, getModnameForBubble, notice }: BackgroundPreviewProps) => {
    const currentSize = useImageSize(resolveImageUrl(currentImageUrl));
    const nextSize = useImageSize(resolveImageUrl(nextImageUrl));
    const currentRatio = currentSize ? currentSize.width / currentSize.height : null;
    const nextRatio = nextSize ? nextSize.width / nextSize.height : null;
    const differs = currentRatio !== null && nextRatio !== null && aspectRatiosDiffer(currentRatio, nextRatio);
    const hasBubbles = map.bubbles.length > 0;

    return (
        <div className="space-y-3">
            <p className="text-sm text-ink-soft">{hasBubbles ? es.background.preview.intro : es.background.preview.introNoBubbles}</p>

            {notice && (
                <p role="status" className="rounded-md border border-teal-dark/20 bg-teal-tint px-3 py-2 text-sm text-teal-dark">
                    {notice}
                </p>
            )}

            <div className="h-[min(52vh,26rem)] w-full">
                <Suspense
                    fallback={
                        <p className="flex items-center gap-2 text-sm text-ink-soft">
                            <Loader2 size={16} className="animate-spin" />
                            {es.background.preview.loading}
                        </p>
                    }
                >
                    <MapCanvas
                        backgroundUrl={resolveImageUrl(nextImageUrl)}
                        ariaLabel={es.background.preview.stageLabel}
                        bubbles={map.bubbles}
                        editable={false}
                        // The whole image, so every bubble is visible whatever the new aspect ratio.
                        fit="contain"
                        mapMode={map.settings.mode}
                        initialView={null}
                        intro="none"
                        pathSettings={map.settings.path}
                        ambient={NO_AMBIENT}
                        skins={map.skins}
                        defaultSkinId={map.defaultSkinId}
                        skinRules={map.skinRules}
                        getModnameForBubble={getModnameForBubble}
                    />
                </Suspense>
            </div>

            <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-soft">
                <div className="flex gap-1.5">
                    <dt className="font-semibold">{es.background.preview.current}:</dt>
                    <dd>{currentRatio !== null ? es.background.preview.ratio(formatRatio(currentRatio)) : "…"}</dd>
                </div>
                <div className="flex gap-1.5">
                    <dt className="font-semibold">{es.background.preview.next}:</dt>
                    <dd>{nextRatio !== null ? es.background.preview.ratio(formatRatio(nextRatio)) : "…"}</dd>
                </div>
            </dl>

            {hasBubbles && currentRatio !== null && nextRatio !== null && (
                <p
                    role={differs ? "alert" : "status"}
                    className={`rounded-md px-3 py-2 text-sm ${differs ? "border border-sun/40 bg-sun-tint text-sun-dark" : "bg-surface-muted text-ink-soft"}`}
                >
                    {differs ? es.background.preview.ratioDifferent : es.background.preview.ratioSame}
                </p>
            )}
        </div>
    );
};
