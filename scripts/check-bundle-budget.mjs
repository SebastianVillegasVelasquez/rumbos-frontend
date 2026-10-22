// Fails when the JavaScript an embedded student downloads before the map is
// interactive grows past the budget. Reads the production build in dist/ with
// Node built-ins only.
//
// "Initial" means: the entry chunk, everything index.html preloads, and the
// lazy chunks the embed student route always needs (the embed shell, the app
// shell and the 2D map), each with its static imports. Chunks reached only
// through a lazy boundary the student may never cross (the 3D world, the
// appearance studio, audio) are not counted.
import { readFileSync, readdirSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

const BUDGET_KB = Number(process.env.EMBED_BUDGET_KB ?? 350)
const DIST = join(process.cwd(), 'dist')
const ASSETS = join(DIST, 'assets')
const ALWAYS_NEEDED = ['EmbedRoot', 'App', 'MapCanvas']

const files = readdirSync(ASSETS).filter((name) => name.endsWith('.js'))
const html = readFileSync(join(DIST, 'index.html'), 'utf8')

const fromHtml = [...html.matchAll(/(?:src|href)="\/assets\/([^"]+\.js)"/g)].map((m) => m[1])
const lazyRoots = files.filter((name) =>
  ALWAYS_NEEDED.some((prefix) => name.startsWith(`${prefix}-`))
)

const staticImports = (name) => {
  const code = readFileSync(join(ASSETS, name), 'utf8')
  return [...code.matchAll(/(?:from|import)\s*"\.\/([^"]+\.js)"/g)].map((m) => m[1])
}

const seen = new Set()
const visit = (name) => {
  if (seen.has(name) || !files.includes(name)) return
  seen.add(name)
  staticImports(name).forEach(visit)
}
;[...fromHtml, ...lazyRoots].forEach(visit)

const rows = [...seen]
  .map((name) => ({ name, gz: gzipSync(readFileSync(join(ASSETS, name)), { level: 9 }).length }))
  .sort((a, b) => b.gz - a.gz)
const total = rows.reduce((sum, row) => sum + row.gz, 0)
const kb = (bytes) => (bytes / 1024).toFixed(1)

if (process.argv.includes('--verbose'))
  rows.forEach((r) => console.log(`${kb(r.gz).padStart(7)} KB  ${r.name}`))
console.log(
  `Embed student initial JS: ${kb(total)} KB gzipped (budget ${BUDGET_KB} KB, ${rows.length} chunks)`
)

if (total > BUDGET_KB * 1024) {
  console.error(`Over budget by ${kb(total - BUDGET_KB * 1024)} KB.`)
  process.exit(1)
}
