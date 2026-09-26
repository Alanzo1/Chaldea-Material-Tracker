import { readFile } from "node:fs/promises"
import { join } from "node:path"
import type { FreeQuestIndexEntry, FreeQuestPhase } from "./atlas-types"
import { isBrowsableFreeQuest } from "./free-quests"
import index from "@/public/data/quests-index.json"

export function getFreeQuests(): FreeQuestIndexEntry[] {
  return (index as FreeQuestIndexEntry[]).filter(isBrowsableFreeQuest)
}

export async function getFreeQuest(id: number): Promise<FreeQuestPhase | null> {
  const quest = getFreeQuests().find((entry) => entry.questId === id)
  if (!quest) return null
  return JSON.parse(await readFile(join(process.cwd(), "public", "data", "quests", String(id), `${quest.phase}.json`), "utf8"))
}
