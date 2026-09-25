// Types only. Client components import from here, never from lib/atlas-data.ts (node:fs).
export interface ServantIndexEntry {
  id: number
  name: string
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
