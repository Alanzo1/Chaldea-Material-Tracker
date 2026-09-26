// Types only. Client components import from here, never from lib/atlas-data.ts (node:fs).
export interface ServantIndexEntry {
  id: number
  name: string
  /** JP data only: the Japanese name (names are English). */
  originalName?: string
  className: string
  attribute: string
  rarity: number
  portrait: string
  buffs: string[]
  debuffs: string[]
  traits: string[]
  alignments: string[]
  stars: string
}

export interface MaterialIndexEntry {
  id: number
  name: string
  /** JP data only: the Japanese name. */
  originalName?: string
  icon: string
  /** From the quoted first line of the Atlas detail, e.g. "Skill Up & Ascension Material". */
  category: string
  /** Description without the category line. */
  detail: string
  /** Atlas item type: "skillLvUp" | "tdLvUp" | "eventItem" | … */
  type: string
  /** Rarity frame: "bronze" | "silver" | "gold" | … */
  background: string
}

export interface FarmingNode {
  id: number
  questName: string
  apCost: number
  dropRate: number
  apPerDrop: number
  warName?: string
  locationName?: string
  questTitle?: string
}

export interface ItemUsageEntry {
  servantId: number
  ascension: number
  skill: number
  append: number
  costume: number
  total: number
}

/** public/data/items/{id}.json */
export interface ItemFile {
  nodes: FarmingNode[]
  usage: ItemUsageEntry[]
}

/** One entry per free quest phase in public/data/quests-index.json. */
export interface FreeQuestIndexEntry {
  entryItems: { id: number; name: string; amount: number }[]
  repeatable: boolean
  banner: string | null
  questId: number
  phase: number
  name: string
  /** JP data only: Japanese quest and location names. */
  originalName?: string
  warId: number
  warName: string
  spotId: number
  spotName: string
  spotOriginalName?: string
  /** Location's quest-map icon; null for region-wide spots (e.g. Ordeal Call areas). */
  spotImage: string | null
  apCost: number | null
  status: "available" | "unavailable"
  enemyDataAvailable: boolean
  /** Filter summary across all waves (see summarizeQuestPhase in scripts/atlas/quests.mjs). */
  enemyClasses: string[]
  enemyAttributes: string[]
  /** Trait names, excluding the classXxx and attributeXxx traits. */
  enemyTraits: string[]
  drops: { id: number; name: string; icon: string | null }[]
}

/** public/data/quests/{questId}/{phase}.json; null stats mean unknown. */
export interface FreeQuestPhase extends FreeQuestIndexEntry {
  drops: {
    id: number
    type: string
    name: string
    icon: string | null
    runs: number
    perRun: number | null
    apPerItem: number | null
  }[]
  recommendedLevel: string | null
  bond: number | null
  experience: number | null
  qp: number | null
  enemyHash: string | null
  stages: {
    wave: number
    enemies: {
      id: number | null
      name: string
      className: string | null
      attribute: string | null
      icon: string | null
      level: number | null
      hp: number | null
      attack: number | null
      deck: string | null
      deckId: number | null
      traits: { id: number; name?: string }[]
    }[]
  }[]
}
