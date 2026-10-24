import { useEffect, useRef } from 'react'
import { AMBIENT } from '../../fx/constants.ts'
import { createPool, particleOpacity, stepPool } from '../../fx/math/particlePool.ts'
import { createRng, rngRange } from '../../fx/math/rng.ts'
import { useAnimationQuality } from '../../fx/quality.ts'

// Soft golden motes drifting upward behind the curtain, from the same particle
// pool and quality gate as the map's ambient layer. Nothing is drawn (and no
// frame is scheduled) when the quality tier is low or off, which is what the
// data saver and prefers-reduced-motion resolve to.
export const WelcomeSparkles = () => {
  const { tier } = useAnimationQuality()
  const ref = useRef<HTMLCanvasElement>(null)
  const capacity = Math.min(AMBIENT.baseCountByKind.sparkles, AMBIENT.capByTier[tier])

  useEffect(() => {
    const canvas = ref.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context || capacity === 0) return
    const rng = createRng(7)
    const pool = createPool(capacity)
    let width = 0
    let height = 0
    const resize = () => {
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = width
      canvas.height = height
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(now - last, 48)
      last = now
      stepPool(pool, dt, capacity, () => ({
        x: rngRange(rng, 0, width),
        y: rngRange(rng, height * 0.5, height),
        vx: rngRange(rng, -5, 5),
        vy: rngRange(rng, -22, -8),
        lifeMs: rngRange(rng, 3500, 7000),
        size: rngRange(rng, 1.5, 3.5),
        seed: rng(),
      }))
      context.clearRect(0, 0, width, height)
      context.fillStyle = '#ffd866'
      for (const particle of pool) {
        if (!particle.active) continue
        context.globalAlpha = particleOpacity(particle) * 0.8
        context.beginPath()
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        context.fill()
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [capacity])

  if (capacity === 0) return null
  return (
    <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
  )
}
