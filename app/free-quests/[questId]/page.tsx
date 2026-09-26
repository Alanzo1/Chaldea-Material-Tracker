import { notFound } from "next/navigation"
import { QuestBrowser } from "@/components/quests/QuestBrowser"
import { getFreeQuest, getFreeQuests } from "@/lib/quest-data"

export const dynamicParams = false
export function generateStaticParams() {
  return getFreeQuests().map((quest) => ({ questId: String(quest.questId) }))
}

export default async function FreeQuestPage({ params }: { params: Promise<{ questId: string }> }) {
  const { questId } = await params
  const quest = await getFreeQuest(Number(questId))
  if (!quest) notFound()
  return <QuestBrowser selected={quest} />
}
