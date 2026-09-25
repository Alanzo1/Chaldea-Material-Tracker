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
