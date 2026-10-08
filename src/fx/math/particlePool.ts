// A fixed-capacity, pre-allocated particle pool. step() mutates particles in
// place and never allocates, so it's cheap to call every frame from the
// shared ticker even with the ambient layer's full particle count.

export interface Particle {
    active: boolean;
    x: number;
    y: number;
    vx: number;
    vy: number;
    age: number;
    lifeMs: number;
    size: number;
    seed: number;
}

export function createPool(capacity: number): Particle[] {
    return Array.from({ length: capacity }, () => ({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        age: 0,
        lifeMs: 0,
        size: 1,
        seed: 0,
    }));
}

export interface SpawnedParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    lifeMs: number;
    size: number;
    seed: number;
}

// Advances every active particle by dtMs, retiring ones past their life and
// asking `spawn` to fill any pool slot that's free (up to `targetActive`).
export function stepPool(
    pool: Particle[],
    dtMs: number,
    targetActive: number,
    spawn: () => SpawnedParticle
): void {
    let activeCount = 0;
    for (const particle of pool) {
        if (!particle.active) continue;
        particle.age += dtMs;
        if (particle.age >= particle.lifeMs) {
            particle.active = false;
            continue;
        }
        particle.x += (particle.vx * dtMs) / 1000;
        particle.y += (particle.vy * dtMs) / 1000;
        activeCount++;
    }

    if (activeCount >= targetActive) return;
    for (const particle of pool) {
        if (activeCount >= targetActive) break;
        if (particle.active) continue;
        const spawned = spawn();
        particle.active = true;
        particle.age = 0;
        particle.x = spawned.x;
        particle.y = spawned.y;
        particle.vx = spawned.vx;
        particle.vy = spawned.vy;
        particle.lifeMs = spawned.lifeMs;
        particle.size = spawned.size;
        particle.seed = spawned.seed;
        activeCount++;
    }
}

// 0..1 fade: in for the first 15% of life, out for the last 25%.
export function particleOpacity(particle: Particle): number {
    const t = particle.lifeMs > 0 ? particle.age / particle.lifeMs : 1;
    if (t < 0.15) return t / 0.15;
    if (t > 0.75) return Math.max(0, (1 - t) / 0.25);
    return 1;
}
