import { useEffect, useState } from "react";

export interface ImageSize {
    width: number;
    height: number;
}

// Natural size of an image URL, or null until it has loaded (and if it fails).
export const useImageSize = (url: string | null): ImageSize | null => {
    const [loaded, setLoaded] = useState<{ url: string; size: ImageSize } | null>(null);

    useEffect(() => {
        if (!url) return;
        let cancelled = false;
        const image = new Image();
        image.onload = () => {
            if (!cancelled && image.naturalWidth > 0) {
                setLoaded({ url, size: { width: image.naturalWidth, height: image.naturalHeight } });
            }
        };
        image.src = url;
        return () => {
            cancelled = true;
        };
    }, [url]);

    return loaded && loaded.url === url ? loaded.size : null;
};
