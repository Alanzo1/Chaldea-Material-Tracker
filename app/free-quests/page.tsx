import { QuestIndex } from "@/components/quests/QuestIndex"
import { getFreeQuests } from "@/lib/quest-data"

export default function FreeQuestsPage() {
  return <QuestIndex quests={getFreeQuests()} />
}
