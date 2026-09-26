// Pure filter/sort logic for the home page servant browser.
// No imports so `node --test` can load this file directly (Node type stripping).

export interface FilterableServant {
  id: number
  name: string
  className: string
  attribute?: string
  rarity: number
  buffs?: string[]
  debuffs?: string[]
  traits?: string[]
  alignments?: string[]
}

export type CollectionFilter = "tracked"
export type ServantSort = "default" | "name" | "rarity" | "class"

export interface ServantFilters {
  collection: CollectionFilter[]
  /** Lowercase class names. */
  classes: string[]
  rarities: number[]
  attributes: string[]
  alignments: string[]
  buffs: string[]
  debuffs: string[]
  traits: string[]
}

export const EMPTY_FILTERS: ServantFilters = {
  collection: [],
  classes: [],
  rarities: [],
  attributes: [],
  alignments: [],
  buffs: [],
  debuffs: [],
  traits: [],
}

export interface FilterContext {
  query: string
  trackedIds: number[]
}

// In-game class order; classes not listed sort after these, alphabetically.
export const CLASS_ORDER = [
  "saber",
  "archer",
  "lancer",
  "rider",
  "caster",
  "assassin",
  "berserker",
  "shielder",
  "ruler",
  "alterego",
  "avenger",
  "mooncancer",
  "foreigner",
  "pretender",
  "beast",
]

function lower(value: unknown) {
  return String(value ?? "").toLowerCase()
}

function matchesAny(values: string[] = [], selected: string[]) {
  if (!selected.length) return true
  const normalized = new Set(values.map(lower))
  return selected.some((value) => normalized.has(lower(value)))
}

export function filterServants<T extends FilterableServant>(
  servants: T[],
  filters: ServantFilters,
  { query, trackedIds }: FilterContext
): T[] {
  const search = query.trim().toLowerCase()
  const tracked = new Set(trackedIds)

  return servants.filter((servant) => {
    if (search && !lower(servant.name).includes(search) && !lower(servant.className).includes(search)) {
      return false
    }

    if (
      filters.collection.length &&
      !tracked.has(servant.id)
    ) {
      return false
    }

    if (filters.classes.length && !filters.classes.includes(lower(servant.className))) return false
    if (filters.rarities.length && !filters.rarities.includes(Number(servant.rarity))) return false

    return (
      matchesAny(servant.attribute ? [servant.attribute] : [], filters.attributes) &&
      matchesAny(servant.alignments, filters.alignments) &&
      matchesAny(servant.buffs, filters.buffs) &&
      matchesAny(servant.debuffs, filters.debuffs) &&
      matchesAny(servant.traits, filters.traits)
    )
  })
}

function classRank(className: string) {
  const index = CLASS_ORDER.indexOf(lower(className))
  return index === -1 ? CLASS_ORDER.length : index
}

export function sortServants<T extends FilterableServant>(servants: T[], sort: ServantSort): T[] {
  const byId = (a: T, b: T) => a.id - b.id
  const compare: Record<ServantSort, (a: T, b: T) => number> = {
    default: byId,
    name: (a, b) => a.name.localeCompare(b.name) || byId(a, b),
    rarity: (a, b) => b.rarity - a.rarity || byId(a, b),
    class: (a, b) =>
      classRank(a.className) - classRank(b.className) ||
      a.className.localeCompare(b.className) ||
      byId(a, b),
  }

  return [...servants].sort(compare[sort])
}

export function countActiveFilters(filters: ServantFilters) {
  return Object.values(filters).reduce((total, values) => total + values.length, 0)
}
