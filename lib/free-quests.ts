// Shared by the server (static params, quest detail) and the browser (quest list), so both
// agree on which free quests the browser shows. No `@/` imports: loaded by `node --test`.
import type { FreeQuestIndexEntry } from "./atlas-types"

// Imperial Capital belongs to the GUDAGUDA event, not the main free-quest browser.
const EXCLUDED_WAR_IDS = new Set([9033])

export function isBrowsableFreeQuest(quest: Pick<FreeQuestIndexEntry, "repeatable" | "warId">): boolean {
  return quest.repeatable && !EXCLUDED_WAR_IDS.has(quest.warId)
}
