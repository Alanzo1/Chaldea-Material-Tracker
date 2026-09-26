"use client"

import { JpDataState } from "@/components/jp/JpDataState"
import { QuestBrowser } from "@/components/quests/QuestBrowser"
import type { FreeQuestPhase } from "@/lib/atlas-types"
import { useFreeQuests } from "@/lib/use-free-quests"
import { useJpFile } from "@/lib/use-jp-file"

export function JpQuestPage({ questId }: { questId: string }) {
  const { quests, status } = useFreeQuests()
  const quest = quests.find((entry) => String(entry.questId) === questId)
  const file = useJpFile<FreeQuestPhase>(quest ? `quests/${quest.questId}/${quest.phase}.json` : null)
  if (status === "loading") return <JpDataState status="loading" what="quest" />
  if (status === "error") return <JpDataState status="error" what="quest" />
  if (!quest) return <JpDataState status="missing" what="quest" />
  if (file.status !== "ready") return <JpDataState status={file.status} what="quest" />
  return <QuestBrowser selected={file.data} />
}
