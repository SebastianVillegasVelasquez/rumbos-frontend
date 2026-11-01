// Generated cover art for the mock API: a square SVG data URI, so the mock ships
// no binaries and every seed gets its own colors.

const hash = (seed: string) => {
  let value = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    value = Math.imul(value ^ seed.charCodeAt(index), 16777619)
  }
  return value >>> 0
}

export const mockCoverDataUri = (seed: string): string => {
  const hue = hash(seed) % 360
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">` +
    `<rect width="512" height="512" fill="hsl(${hue} 70% 45%)"/>` +
    `<circle cx="256" cy="256" r="180" fill="hsl(${(hue + 40) % 360} 75% 62%)"/>` +
    `<circle cx="256" cy="256" r="90" fill="hsl(${(hue + 200) % 360} 60% 30%)"/>` +
    `</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
