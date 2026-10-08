import { useEffect, useRef, useState } from "react";

// Dev-only overlay enabled with ?debug=fps. Samples real frame time via its
// own rAF (deliberately not the shared ticker - it needs to measure even
// when nothing else is animating) and reports a rolling average.
export const FpsMeter = () => {
    const [fps, setFps] = useState<number | null>(null);
    const samplesRef = useRef<number[]>([]);
    const lastRef = useRef<number | null>(null);

    useEffect(() => {
        let raf: number;
        const tick = (time: number) => {
            if (lastRef.current !== null) {
                const dt = time - lastRef.current;
                const samples = samplesRef.current;
                samples.push(dt);
                if (samples.length > 60) samples.shift();
                const avgMs = samples.reduce((sum, v) => sum + v, 0) / samples.length;
                setFps(Math.round(1000 / avgMs));
            }
            lastRef.current = time;
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, []);

    if (fps === null) return null;

    return (
        <div className="pointer-events-none fixed left-2 top-2 z-50 rounded-md bg-black/80 px-2 py-1 font-mono text-xs text-white">
            {fps} fps
        </div>
    );
};
