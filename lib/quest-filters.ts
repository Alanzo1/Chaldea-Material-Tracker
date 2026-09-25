// Pure filter/sort logic for the free-quest browser. No `@/` imports: loaded by `node --test`.
import type { FreeQuestIndexEntry } from "./atlas-types"

export type QuestSort = "default" | "ap" | "name"

export interface QuestFilters {
  chapters: number[]
  apBuckets: string[]
  enemyClasses: string[]
  enemyAttributes: string[]
  enemyTraits: string[]
  /** Drop item ids. */
  drops: number[]
}

export const EMPTY_QUEST_FILTERS: QuestFilters = {
  chapters: [],
  apBuckets: [],
  enemyClasses: [],
  enemyAttributes: [],
  enemyTraits: [],
  drops: [],
}

export const AP_BUCKETS = ["≤10", "11–20", "21–30", "31–40", "41+"] as const

export function apBucket(apCost: number | null): string {
  if (apCost === null || !Number.isFinite(apCost)) return "Other"
  if (apCost <= 10) return "≤10"
  if (apCost <= 20) return "11–20"
  if (apCost <= 30) return "21–30"
  if (apCost <= 40) return "31–40"
  return "41+"
}

type FilterableQuest = Pick<
  FreeQuestIndexEntry,
  "questId" | "name" | "spotName" | "warId" | "warName" | "apCost" | "enemyClasses" | "enemyAttributes" | "enemyTraits" | "drops"
>

const matchesAny = <T>(values: T[], selected: T[]) => !selected.length || selected.some((value) => values.includes(value))

export function filterQuests<T extends FilterableQuest>(quests: T[], filters: QuestFilters, query: string): T[] {
  const search = query.trim().toLowerCase()
  return quests.filter(
    (quest) =>
      (!search || `${quest.name} ${quest.spotName} ${quest.warName}`.toLowerCase().includes(search)) &&
      matchesAny([quest.warId], filters.chapters) &&
      matchesAny([apBucket(quest.apCost)], filters.apBuckets) &&
      matchesAny(quest.enemyClasses ?? [], filters.enemyClasses) &&
      matchesAny(quest.enemyAttributes ?? [], filters.enemyAttributes) &&
      matchesAny(quest.enemyTraits ?? [], filters.enemyTraits) &&
      matchesAny((quest.drops ?? []).map((drop) => drop.id), filters.drops)
  )
}

export function sortQuests<T extends FilterableQuest>(quests: T[], sort: QuestSort): T[] {
  if (sort === "ap") {
    return [...quests].sort((a, b) => (a.apCost ?? Infinity) - (b.apCost ?? Infinity) || a.questId - b.questId)
  }
  if (sort === "name") {
    return [...quests].sort((a, b) => a.spotName.localeCompare(b.spotName) || a.questId - b.questId)
  }
  return [...quests]
}

export function countQuestFilters(filters: QuestFilters) {
  return Object.values(filters).reduce((total, values) => total + values.length, 0)
}
