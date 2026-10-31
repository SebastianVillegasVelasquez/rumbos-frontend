// Matches the activities an imported archive refers to with the activities of
// the course it is imported into. Pure: no network, no React, no clock.
//
// Tiers, strongest first:
//   1. same modname and same normalized name
//   2. the same bracketed code, such as [M1E1S1]
//   3. same modname, section number and position in the section
//   4. same modname and a bigram similarity of at least FUZZY_THRESHOLD
// Assignments are one-to-one and greedy by score.

export interface Descriptor {
  key: string
  mapRef: string
  bubbleRef: string
  modname: string
  name: string
  sectionNumber: number
  sectionName: string
  positionInSection: number
}

export interface Target {
  cmid: number
  name: string
  modname: string
  sectionNumber: number
  sectionName: string
  positionInSection: number
}

// "exact" is what the editor can accept in bulk; "similar" asks for a look.
export type Confidence = 'exact' | 'similar' | 'none'

export type Tier = 1 | 2 | 3 | 4

export interface Match {
  key: string
  cmid: number | null
  confidence: Confidence
  tier: Tier | null
}

export const FUZZY_THRESHOLD = 0.85

const COMBINING_MARKS = /[̀-ͯ]/g
const BRACKETED = /\[([^\]]{1,40})\]/g

// Case, accents, punctuation and repeated spaces do not make two names differ.
export const normalizeName = (name: string): string =>
  name
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

// "Quiz [M1E1S1]" -> ["m1e1s1"]
export const extractCodes = (name: string): string[] => {
  const codes: string[] = []
  for (const match of name.matchAll(BRACKETED)) {
    const code = normalizeName(match[1]).replace(/ /g, '')
    if (code) codes.push(code)
  }
  return codes
}

const withoutCodes = (name: string): string => normalizeName(name.replace(BRACKETED, ' '))

const bigrams = (text: string): Map<string, number> => {
  const counts = new Map<string, number>()
  for (let i = 0; i < text.length - 1; i++) {
    const pair = text.slice(i, i + 2)
    counts.set(pair, (counts.get(pair) ?? 0) + 1)
  }
  return counts
}

// Dice coefficient over character bigrams, 0 to 1.
export const bigramSimilarity = (a: string, b: string): number => {
  if (a === b) return a === '' ? 0 : 1
  if (a.length < 2 || b.length < 2) return 0
  const left = bigrams(a)
  const right = bigrams(b)
  let shared = 0
  for (const [pair, count] of left) shared += Math.min(count, right.get(pair) ?? 0)
  return (2 * shared) / (a.length - 1 + (b.length - 1))
}

const sameType = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

interface Prepared {
  full: string
  base: string
  codes: string[]
}

const prepare = (name: string): Prepared => ({
  full: normalizeName(name),
  base: withoutCodes(name),
  codes: extractCodes(name),
})

interface Scored {
  tier: Tier
  // Higher is better. Tiers are 10 apart; the bonuses inside a tier stay below that.
  score: number
}

const nameSimilarity = (a: Prepared, b: Prepared) =>
  Math.max(bigramSimilarity(a.full, b.full), bigramSimilarity(a.base, b.base))

const score = (descriptor: Descriptor, target: Target, d: Prepared, t: Prepared): Scored | null => {
  const type = sameType(descriptor.modname, target.modname)
  const section = descriptor.sectionNumber === target.sectionNumber
  const position = section && descriptor.positionInSection === target.positionInSection
  // Where an otherwise equal pair sits breaks ties between duplicate names.
  const bonus = (section ? 2 : 0) + (position ? 1 : 0)

  if (type && d.full !== '' && d.full === t.full) return { tier: 1, score: 100 + bonus }
  if (d.codes.some((code) => t.codes.includes(code)))
    return { tier: 2, score: (type ? 90 : 80) + bonus }
  if (type && position) return { tier: 3, score: 70 + Math.round(nameSimilarity(d, t) * 5) }
  if (type) {
    const similarity = nameSimilarity(d, t)
    if (similarity >= FUZZY_THRESHOLD)
      return { tier: 4, score: 50 + Math.round(similarity * 9) + bonus }
  }
  return null
}

// "Coincide" needs the strongest evidence: the name, or the code on the same
// kind of activity. Everything else is a guess the editor should look at.
const confidenceOf = (descriptor: Descriptor, target: Target, tier: Tier): Confidence =>
  tier === 1 || (tier === 2 && sameType(descriptor.modname, target.modname)) ? 'exact' : 'similar'

export interface MatchInput {
  descriptors: Descriptor[]
  targets: Target[]
  // Activities that already sit on a level: they cannot be placed again.
  placedCmids?: ReadonlySet<number>
}

export const availableTargets = (targets: Target[], placed?: ReadonlySet<number>) =>
  placed ? targets.filter((target) => !placed.has(target.cmid)) : targets

export const matchDescriptors = ({ descriptors, targets, placedCmids }: MatchInput): Match[] => {
  const pool = availableTargets(targets, placedCmids)
  const preparedTargets = pool.map((target) => prepare(target.name))
  const pairs: { d: number; t: number; scored: Scored }[] = []
  descriptors.forEach((descriptor, d) => {
    const prepared = prepare(descriptor.name)
    pool.forEach((target, t) => {
      const scored = score(descriptor, target, prepared, preparedTargets[t])
      if (scored) pairs.push({ d, t, scored })
    })
  })
  // Best first; ties go to the earlier descriptor, then the earlier target.
  pairs.sort((a, b) => b.scored.score - a.scored.score || a.d - b.d || a.t - b.t)

  const taken = new Set<number>()
  const chosen = new Map<number, { t: number; tier: Tier }>()
  for (const { d, t, scored } of pairs) {
    if (chosen.has(d) || taken.has(t)) continue
    chosen.set(d, { t, tier: scored.tier })
    taken.add(t)
  }
  return descriptors.map((descriptor, d): Match => {
    const hit = chosen.get(d)
    if (!hit) return { key: descriptor.key, cmid: null, confidence: 'none', tier: null }
    return {
      key: descriptor.key,
      cmid: pool[hit.t].cmid,
      confidence: confidenceOf(descriptor, pool[hit.t], hit.tier),
      tier: hit.tier,
    }
  })
}

// The dropdown's list for one row: every free target, the likeliest first,
// then the rest in course order.
export const rankCandidates = (
  descriptor: Descriptor,
  targets: Target[],
  placed?: ReadonlySet<number>
): Target[] => {
  const prepared = prepare(descriptor.name)
  const ranked = availableTargets(targets, placed).map((target, index) => ({
    target,
    index,
    value: score(descriptor, target, prepared, prepare(target.name))?.score ?? 0,
  }))
  ranked.sort((a, b) => b.value - a.value || a.index - b.index)
  return ranked.map((entry) => entry.target)
}

// ---- The review screen's bookkeeping ------------------------------------------------

// descriptor key -> chosen cmid, or null for "Omitir"
export type Mapping = Record<string, number | null>

export const toMapping = (matches: Match[]): Mapping =>
  Object.fromEntries(matches.map((match) => [match.key, match.cmid]))

// Targets chosen by more than one row: apply must stay disabled while any exist.
export const duplicatedTargets = (mapping: Mapping): Set<number> => {
  const seen = new Set<number>()
  const duplicated = new Set<number>()
  for (const cmid of Object.values(mapping)) {
    if (cmid === null) continue
    if (seen.has(cmid)) duplicated.add(cmid)
    seen.add(cmid)
  }
  return duplicated
}

const isUntouchedExact = (match: Match | undefined, cmid: number) =>
  match?.confidence === 'exact' && match.cmid === cmid

export interface Tally {
  matched: number
  doubtful: number
  omitted: number
}

// A row the editor changed or accepted by hand counts as matched: they looked at it.
export const tally = (
  mapping: Mapping,
  matches: Match[],
  reviewed: ReadonlySet<string> = new Set()
): Tally => {
  const original = new Map(matches.map((match) => [match.key, match]))
  const result: Tally = { matched: 0, doubtful: 0, omitted: 0 }
  for (const [key, cmid] of Object.entries(mapping)) {
    if (cmid === null) result.omitted++
    else if (reviewed.has(key) || isUntouchedExact(original.get(key), cmid)) result.matched++
    else result.doubtful++
  }
  return result
}
