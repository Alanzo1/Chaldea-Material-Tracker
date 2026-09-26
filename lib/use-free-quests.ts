"use client"

import { useMemo } from "react"

import type { FreeQuestIndexEntry } from "@/lib/atlas-types"
import { useDataRegion } from "@/lib/data-region"
import { isBrowsableFreeQuest } from "@/lib/free-quests"
import { useStaticJson } from "@/lib/use-static-json"

const NO_QUESTS: FreeQuestIndexEntry[] = []

// Free-quest list for the browser, loaded once instead of embedded in all ~300 quest pages.
export function useFreeQuests() {
  const { base } = useDataRegion()
  const { data, status } = useStaticJson(`${base}/quests-index.json`, NO_QUESTS)
  const quests = useMemo(() => data.filter(isBrowsableFreeQuest), [data])
  return { quests, status }
}
