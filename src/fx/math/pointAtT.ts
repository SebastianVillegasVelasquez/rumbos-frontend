export interface Vec2 {
    x: number;
    y: number;
}

// Samples a point at parameter t (0..1) along a polyline given as a flat
// [x0,y0,x1,y1,...] array, by arc length (not by segment index), so a
// traveling dot moves at constant visual speed even when segments differ in
// length.
export function pointAtT(points: readonly number[], t: number): Vec2 | null {
    const segments: { a: Vec2; b: Vec2; length: number }[] = [];
    let total = 0;
    for (let i = 0; i + 3 < points.length; i += 2) {
        const a = { x: points[i], y: points[i + 1] };
        const b = { x: points[i + 2], y: points[i + 3] };
        const length = Math.hypot(b.x - a.x, b.y - a.y);
        segments.push({ a, b, length });
        total += length;
    }
    if (segments.length === 0 || total === 0) return points.length >= 2 ? { x: points[0], y: points[1] } : null;

    const target = Math.min(Math.max(t, 0), 1) * total;
    let covered = 0;
    for (const segment of segments) {
        if (target <= covered + segment.length || segment === segments[segments.length - 1]) {
            const segT = segment.length === 0 ? 0 : (target - covered) / segment.length;
            return {
                x: segment.a.x + (segment.b.x - segment.a.x) * segT,
                y: segment.a.y + (segment.b.y - segment.a.y) * segT,
            };
        }
        covered += segment.length;
    }
    return { x: points[points.length - 2], y: points[points.length - 1] };
}
