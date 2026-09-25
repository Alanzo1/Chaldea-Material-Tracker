import { readFile } from "node:fs/promises"
import { join } from "node:path"
import type { FreeQuestIndexEntry, FreeQuestPhase } from "./atlas-types"
import index from "@/public/data/quests-index.json"

export function getFreeQuests(): FreeQuestIndexEntry[] {
  // Imperial Capital belongs to the GUDAGUDA event, not the main free-quest browser.
  return (index as FreeQuestIndexEntry[]).filter((quest) => quest.repeatable && quest.warId !== 9033)
}

export async function getFreeQuest(id: number): Promise<FreeQuestPhase | null> {
  const quest = getFreeQuests().find((entry) => entry.questId === id)
  if (!quest) return null
  return JSON.parse(await readFile(join(process.cwd(), "public", "data", "quests", String(id), `${quest.phase}.json`), "utf8"))
}
