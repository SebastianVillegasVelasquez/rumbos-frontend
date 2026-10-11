import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { Button } from "../../../../components/ui/Button.tsx";
import { es } from "../../../../i18n/es.ts";
import {
    ASSET_LIMITS,
    ALLOWED_IMAGE_MIME,
    CREDIT_MAX_LENGTH,
    TITLE_MAX_LENGTH,
    checkDimensions,
    checkFileBasics,
    type UploadCheckError,
} from "../../data/assetLimits.ts";
import { useCreateAsset } from "../../data/queries.ts";
import type { AssetCreateResult, AssetKind } from "../../data/types.ts";
import { uploadErrorMessage } from "./assetMessages.ts";

interface AssetUploaderProps {
    kind: AssetKind;
    onUploaded: (result: AssetCreateResult) => void;
}

const checkErrorMessage = (error: UploadCheckError, kind: AssetKind) => {
    const messages = es.background.upload.errors;
    const limits = ASSET_LIMITS[kind];
    if (error === "tooLarge") return messages.tooLarge(Math.round(limits.maxBytes / (1024 * 1024)));
    if (error === "tooBig") return messages.tooBig(limits.maxSide);
    return messages.notImage;
};

const readDimensions = async (file: File): Promise<{ width: number; height: number } | null> => {
    try {
        const bitmap = await createImageBitmap(file);
        const size = { width: bitmap.width, height: bitmap.height };
        bitmap.close?.();
        return size;
    } catch {
        return null;
    }
};

const filenameTitle = (name: string) => name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim().slice(0, TITLE_MAX_LENGTH);

export const AssetUploader = ({ kind, onUploaded }: AssetUploaderProps) => {
    const createAsset = useCreateAsset();
    const inputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [title, setTitle] = useState("");
    const [credit, setCredit] = useState("");
    const [fileError, setFileError] = useState<string | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const [progress, setProgress] = useState<number | null>(null);

    const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
    useEffect(
        () => () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        },
        [previewUrl]
    );

    const limits = ASSET_LIMITS[kind];

    const acceptFile = async (candidate: File | undefined) => {
        if (!candidate) return;
        setFileError(null);
        createAsset.reset();
        const basics = checkFileBasics(candidate, kind);
        if (basics) {
            setFileError(checkErrorMessage(basics, kind));
            return;
        }
        const size = await readDimensions(candidate);
        if (!size) {
            setFileError(es.background.upload.errors.unreadable);
            return;
        }
        const dimensions = checkDimensions(size.width, size.height, kind);
        if (dimensions) {
            setFileError(checkErrorMessage(dimensions, kind));
            return;
        }
        setFile(candidate);
        setTitle((current) => current || filenameTitle(candidate.name));
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragActive(false);
        void acceptFile(e.dataTransfer.files[0]);
    };

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!file || !title.trim()) return;
        setProgress(0);
        createAsset.mutate(
            {
                file,
                kind,
                title: title.trim(),
                credit: credit.trim() || undefined,
                onProgress: setProgress,
            },
            {
                onSuccess: (result) => {
                    setProgress(null);
                    onUploaded(result);
                },
                onError: () => setProgress(null),
            }
        );
    };

    const uploading = createAsset.isPending;
    const percent = progress === null ? 0 : Math.round(progress * 100);
    const errorMessage = fileError ?? (createAsset.isError ? uploadErrorMessage(createAsset.error) : null);

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                className={`flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
                    dragActive ? "border-teal-dark bg-teal-tint" : "border-ink/15 bg-surface-muted"
                }`}
            >
                {previewUrl && file ? (
                    <>
                        <img src={previewUrl} alt="" className="max-h-40 max-w-full rounded-md object-contain" />
                        <p className="max-w-full truncate text-xs text-ink-soft">{file.name}</p>
                        <Button type="button" size="sm" variant="secondary" onClick={() => inputRef.current?.click()} disabled={uploading}>
                            {es.background.upload.replaceFile}
                        </Button>
                    </>
                ) : (
                    <>
                        <ImagePlus size={28} aria-hidden className="text-ink-soft" />
                        <p className="text-sm text-ink-soft" aria-live="polite">
                            {dragActive ? es.background.upload.dropActive : es.background.upload.drop}{" "}
                            {!dragActive && (
                                <button
                                    type="button"
                                    onClick={() => inputRef.current?.click()}
                                    className="font-semibold text-teal-dark underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-dark"
                                >
                                    {es.background.upload.browse}
                                </button>
                            )}
                        </p>
                        <p className="text-xs text-ink-soft">
                            {es.background.upload.hint(Math.round(limits.maxBytes / (1024 * 1024)), limits.maxSide)}
                        </p>
                    </>
                )}
                <input
                    ref={inputRef}
                    type="file"
                    accept={ALLOWED_IMAGE_MIME.join(",")}
                    className="sr-only"
                    tabIndex={-1}
                    aria-label={es.background.upload.browse}
                    onChange={(e) => {
                        void acceptFile(e.target.files?.[0]);
                        e.target.value = "";
                    }}
                />
            </div>

            <label className="block space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{es.background.upload.titleLabel}</span>
                <input
                    type="text"
                    required
                    maxLength={TITLE_MAX_LENGTH}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={es.background.upload.titlePlaceholder}
                    className="w-full rounded-md border border-ink/10 px-3 py-2 text-sm focus:border-teal-dark focus:outline-none"
                />
            </label>
            <label className="block space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{es.background.upload.creditLabel}</span>
                <input
                    type="text"
                    maxLength={CREDIT_MAX_LENGTH}
                    value={credit}
                    onChange={(e) => setCredit(e.target.value)}
                    placeholder={es.background.upload.creditPlaceholder}
                    aria-describedby="asset-credit-hint"
                    className="w-full rounded-md border border-ink/10 px-3 py-2 text-sm focus:border-teal-dark focus:outline-none"
                />
                <span id="asset-credit-hint" className="block text-xs text-sun-dark">
                    {es.background.upload.creditHint}
                </span>
            </label>

            {errorMessage && (
                <p role="alert" className="text-sm text-coral-dark">
                    {errorMessage}
                </p>
            )}

            {uploading && (
                <div className="space-y-1" role="status">
                    <progress value={percent} max={100} aria-label={es.background.upload.progress(percent)} className="h-2 w-full" />
                    <p className="text-xs text-ink-soft">{es.background.upload.progress(percent)}</p>
                </div>
            )}

            <div className="flex justify-end">
                <Button type="submit" disabled={!file || !title.trim() || uploading}>
                    {uploading ? (
                        <>
                            <Loader2 size={15} className="animate-spin" />
                            {es.background.upload.uploading}
                        </>
                    ) : (
                        es.background.upload.submit
                    )}
                </Button>
            </div>
        </form>
    );
};
