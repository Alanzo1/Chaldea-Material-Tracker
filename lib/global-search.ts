// Navbar search across servants, materials and free quests. Results are grouped in priority
// order servant → material → free quest. No `@/` imports: loaded directly by `node --test`.

export interface SearchLimits {
  servants: number
  materials: number
  quests: number
}

export const DEFAULT_SEARCH_LIMITS: SearchLimits = { servants: 6, materials: 4, quests: 4 }

interface Searchable<T> {
  item: T
  /** Name fields in priority order (e.g. location name before quest name). */
  names: string[]
  /** Weaker text matched only as a last resort (class, category, chapter). */
  secondary: string
}

const lower = (value: unknown) => String(value ?? "").toLowerCase()

// 0 = name starts with query, 1 = a word starts with it, 2 = contains it, -1 = no name match.
function nameRank(name: string, query: string) {
  const text = lower(name)
  if (text.startsWith(query)) return 0
  if (text.split(/[^a-z0-9]+/).some((word) => word.startsWith(query))) return 1
  if (text.includes(query)) return 2
  return -1
}

function rankEntries<T>(entries: Searchable<T>[], query: string, limit: number): T[] {
  const SECONDARY = 3
  return entries
    .map((entry, index) => {
      let best = { rank: -1, field: 0 }
      entry.names.forEach((name, field) => {
        const rank = nameRank(name, query)
        if (rank !== -1 && (best.rank === -1 || rank < best.rank)) best = { rank, field }
      })
      if (best.rank === -1 && lower(entry.secondary).includes(query)) best = { rank: SECONDARY, field: entry.names.length }
      return { item: entry.item, index, ...best }
    })
    .filter((entry) => entry.rank !== -1)
    // Ties keep the source order (servant id / story order), which reads naturally.
    .sort((a, b) => a.rank - b.rank || a.field - b.field || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.item)
}

export interface SearchData<S, M, Q> {
  servants: S[]
  materials: M[]
  quests: Q[]
}

export function searchAll<
  S extends { name: string; className: string },
  M extends { name: string; category?: string },
  Q extends { name: string; spotName: string; warName: string },
>(data: SearchData<S, M, Q>, rawQuery: string, limits: SearchLimits = DEFAULT_SEARCH_LIMITS): SearchData<S, M, Q> {
  const query = rawQuery.trim().toLowerCase()
  if (!query) return { servants: [], materials: [], quests: [] }

  return {
    servants: rankEntries(
      data.servants.map((item) => ({ item, names: [item.name], secondary: item.className })),
      query,
      limits.servants
    ),
    materials: rankEntries(
      data.materials.map((item) => ({ item, names: [item.name], secondary: item.category ?? "" })),
      query,
      limits.materials
    ),
    quests: rankEntries(
      data.quests.map((item) => ({ item, names: [item.spotName, item.name], secondary: item.warName })),
      query,
      limits.quests
    ),
  }
}

export type FlatSearchResult<S, M, Q> =
  | { kind: "servant"; key: number; item: S }
  | { kind: "material"; key: number; item: M }
  | { kind: "quest"; key: number; item: Q }

/** One list in display order, for keyboard navigation across the groups. */
export function flattenSearchResults<
  S extends { id: number },
  M extends { id: number },
  Q extends { questId: number },
>(results: SearchData<S, M, Q>): FlatSearchResult<S, M, Q>[] {
  return [
    ...results.servants.map((item) => ({ kind: "servant" as const, key: item.id, item })),
    ...results.materials.map((item) => ({ kind: "material" as const, key: item.id, item })),
    ...results.quests.map((item) => ({ kind: "quest" as const, key: item.questId, item })),
  ]
}
