import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Pencil, Search, Trash2 } from "lucide-react";
import { Badge } from "../../../../components/ui/Card.tsx";
import { Button } from "../../../../components/ui/Button.tsx";
import { ConfirmDialog } from "../../../../components/ui/ConfirmDialog.tsx";
import { useToast } from "../../../../components/ui/toastContext.ts";
import { es } from "../../../../i18n/es.ts";
import { resolveImageUrl } from "../../data/assets.ts";
import { CREDIT_MAX_LENGTH, TITLE_MAX_LENGTH, isAssetInUse } from "../../data/assetLimits.ts";
import { useAssets, useDeleteAsset, usePatchAsset } from "../../data/queries.ts";
import type { AssetKind, AssetListItem, AssetUsage } from "../../data/types.ts";
import { inUseMessage, usageFromConflict } from "./assetMessages.ts";

const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 300;

interface AssetLibraryProps {
    kind: AssetKind;
    // Library images that are already in use at the call site get a badge.
    currentUrl?: string | null;
    onSelect: (asset: AssetListItem) => void;
    selectLabel?: string;
}

const thumbOf = (asset: AssetListItem) => resolveImageUrl(asset.thumbUrl ?? asset.url);

export const AssetLibrary = ({ kind, currentUrl, onSelect, selectLabel }: AssetLibraryProps) => {
    const [search, setSearch] = useState("");
    const [debounced, setDebounced] = useState("");
    const [offset, setOffset] = useState(0);
    const [managing, setManaging] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebounced(search.trim());
            setOffset(0);
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [search]);

    const query = useAssets({ kind, q: debounced || undefined, limit: PAGE_SIZE, offset });
    const items = query.data?.items ?? [];
    const total = query.data?.total ?? 0;
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.floor(offset / PAGE_SIZE) + 1;

    // Deleting the only item of the last page would leave it empty: step back.
    const handleDeleted = () => {
        if (items.length === 1 && offset > 0) setOffset(Math.max(0, offset - PAGE_SIZE));
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <label className="relative min-w-0 flex-1">
                    <span className="sr-only">{es.background.library.searchLabel}</span>
                    <Search size={14} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={es.background.library.searchPlaceholder}
                        className="w-full rounded-md border border-ink/10 py-2 pl-8 pr-3 text-sm focus:border-teal-dark focus:outline-none"
                    />
                </label>
                <Button type="button" size="sm" variant={managing ? "primary" : "secondary"} aria-pressed={managing} onClick={() => setManaging((v) => !v)}>
                    {managing ? es.background.library.doneManaging : es.background.library.manage}
                </Button>
            </div>

            {query.isPending && (
                <p className="flex items-center gap-2 text-sm text-ink-soft" role="status">
                    <Loader2 size={14} className="animate-spin" />
                    {es.background.library.loading}
                </p>
            )}

            {query.isError && (
                <div className="space-y-2" role="alert">
                    <p className="text-sm text-coral-dark">{es.background.library.loadError}</p>
                    <Button size="sm" variant="secondary" onClick={() => void query.refetch()}>
                        {es.background.library.retry}
                    </Button>
                </div>
            )}

            {query.data && items.length === 0 && (
                <p className="rounded-md border border-dashed border-ink/15 p-6 text-center text-sm text-ink-soft">
                    {debounced ? es.background.library.emptySearch : es.background.library.empty}
                </p>
            )}

            {items.length > 0 && (
                <ul
                    aria-label={es.background.library.gridLabel}
                    className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3"
                >
                    {items.map((asset) => (
                        <AssetCard
                            key={asset.id}
                            asset={asset}
                            managing={managing}
                            isCurrent={currentUrl === asset.url}
                            selectLabel={selectLabel ?? es.background.preview.useThis}
                            onSelect={() => onSelect(asset)}
                            onDeleted={handleDeleted}
                        />
                    ))}
                </ul>
            )}

            {total > PAGE_SIZE && (
                <nav className="flex items-center justify-between gap-2" aria-label={es.background.library.gridLabel}>
                    <Button size="sm" variant="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
                        {es.background.library.previous}
                    </Button>
                    <span className="text-xs text-ink-soft" aria-live="polite">
                        {es.background.library.page(page, pageCount)}
                    </span>
                    <Button size="sm" variant="secondary" disabled={page >= pageCount} onClick={() => setOffset(offset + PAGE_SIZE)}>
                        {es.background.library.next}
                    </Button>
                </nav>
            )}
        </div>
    );
};

const usageBadges = (usage: AssetUsage) => {
    const badges: string[] = [];
    if (usage.maps > 0) badges.push(es.background.library.usedInMaps(usage.maps));
    if (usage.skins > 0) badges.push(es.background.library.usedInSkins(usage.skins));
    if (usage.publications > 0) badges.push(es.background.library.usedInPublications(usage.publications));
    return badges;
};

const AssetCard = ({
    asset,
    managing,
    isCurrent,
    selectLabel,
    onSelect,
    onDeleted,
}: {
    asset: AssetListItem;
    managing: boolean;
    isCurrent: boolean;
    selectLabel: string;
    onSelect: () => void;
    onDeleted: () => void;
}) => {
    const toast = useToast();
    const patchAsset = usePatchAsset();
    const deleteAsset = useDeleteAsset();
    const [editing, setEditing] = useState(false);
    const [title, setTitle] = useState(asset.title);
    const [credit, setCredit] = useState(asset.credit ?? "");
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleteBlocked, setDeleteBlocked] = useState<AssetUsage | null>(null);

    const inUse = isAssetInUse(asset.usage);
    const badges = usageBadges(asset.usage);

    const startEditing = () => {
        setTitle(asset.title);
        setCredit(asset.credit ?? "");
        patchAsset.reset();
        setEditing(true);
    };

    const handleSave = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const trimmedTitle = title.trim();
        if (!trimmedTitle) return;
        patchAsset.mutate(
            { assetId: asset.id, input: { title: trimmedTitle, credit: credit.trim() || null } },
            {
                onSuccess: () => {
                    setEditing(false);
                    toast.show(es.background.manage.saved, "success");
                },
            }
        );
    };

    const handleDelete = () => {
        deleteAsset.mutate(asset.id, {
            onSuccess: () => {
                toast.show(es.background.manage.deleted, "success");
                onDeleted();
            },
            onError: (error) => {
                // The library said "unused" but it became used meanwhile: show where.
                const usage = usageFromConflict(error);
                if (usage) setDeleteBlocked(usage);
                else toast.show(es.background.manage.deleteError, "error");
            },
        });
    };

    return (
        <li className="flex flex-col overflow-hidden rounded-lg border border-ink/10 bg-surface">
            <button
                type="button"
                onClick={onSelect}
                aria-label={`${selectLabel}: ${asset.title}`}
                className="group block text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-dark"
            >
                <div className="relative aspect-video w-full overflow-hidden bg-surface-muted">
                    <img src={thumbOf(asset)} alt="" loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                    {isCurrent && (
                        <Badge tone="teal" className="absolute left-2 top-2">
                            {es.background.library.inUse}
                        </Badge>
                    )}
                </div>
            </button>
            <div className="flex flex-1 flex-col gap-1.5 p-3">
                {editing ? (
                    <form onSubmit={handleSave} className="space-y-2">
                        <label className="block space-y-0.5">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{es.background.manage.titleLabel}</span>
                            <input
                                type="text"
                                required
                                autoFocus
                                maxLength={TITLE_MAX_LENGTH}
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full rounded-md border border-ink/10 px-2 py-1.5 text-sm focus:border-teal-dark focus:outline-none"
                            />
                        </label>
                        <label className="block space-y-0.5">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{es.background.manage.creditLabel}</span>
                            <input
                                type="text"
                                maxLength={CREDIT_MAX_LENGTH}
                                value={credit}
                                onChange={(e) => setCredit(e.target.value)}
                                className="w-full rounded-md border border-ink/10 px-2 py-1.5 text-sm focus:border-teal-dark focus:outline-none"
                            />
                        </label>
                        {patchAsset.isError && (
                            <p role="alert" className="text-xs text-coral-dark">
                                {es.background.manage.saveError}
                            </p>
                        )}
                        <div className="flex justify-end gap-2">
                            <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(false)}>
                                {es.background.manage.cancel}
                            </Button>
                            <Button type="submit" size="sm" disabled={patchAsset.isPending}>
                                {patchAsset.isPending ? es.background.manage.saving : es.background.manage.save}
                            </Button>
                        </div>
                    </form>
                ) : (
                    <>
                        <p className="truncate text-sm font-semibold text-ink" title={asset.title}>
                            {asset.title}
                        </p>
                        <p className={`line-clamp-2 text-xs ${asset.credit ? "text-ink-soft" : "italic text-sun-dark"}`}>
                            {asset.credit ?? es.background.library.noCredit}
                        </p>
                        <p className="text-[11px] text-ink-soft">{es.background.library.dimensions(asset.width, asset.height)}</p>
                        <div className="mt-auto flex flex-wrap gap-1 pt-1">
                            {badges.length === 0 ? (
                                <Badge tone="slate">{es.background.library.unused}</Badge>
                            ) : (
                                badges.map((label) => (
                                    <Badge key={label} tone="teal">
                                        {label}
                                    </Badge>
                                ))
                            )}
                        </div>
                    </>
                )}

                {managing && !editing && (
                    <div className="space-y-2 border-t border-ink/10 pt-2">
                        <div className="flex gap-2">
                            <Button type="button" size="sm" variant="secondary" onClick={startEditing}>
                                <Pencil size={13} />
                                {es.background.manage.edit}
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={inUse || deleteAsset.isPending}
                                onClick={() => setConfirmDelete(true)}
                                aria-label={`${es.background.manage.delete}: ${asset.title}`}
                            >
                                <Trash2 size={13} />
                                {es.background.manage.delete}
                            </Button>
                        </div>
                        {(inUse || deleteBlocked) && (
                            <p role={deleteBlocked ? "alert" : undefined} className="text-xs text-sun-dark">
                                {inUseMessage(deleteBlocked ?? asset.usage)}
                            </p>
                        )}
                    </div>
                )}
            </div>

            <ConfirmDialog
                open={confirmDelete}
                onOpenChange={setConfirmDelete}
                title={es.background.manage.deleteConfirm.title}
                description={es.background.manage.deleteConfirm.description(asset.title)}
                confirmLabel={es.background.manage.deleteConfirm.confirm}
                cancelLabel={es.background.manage.deleteConfirm.cancel}
                onConfirm={handleDelete}
            />
        </li>
    );
};
