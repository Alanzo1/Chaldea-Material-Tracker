import { QuestFiltersProvider } from "@/components/quests/QuestFilters"

export default function FreeQuestsLayout({ children }: { children: React.ReactNode }) {
  return <QuestFiltersProvider>{children}</QuestFiltersProvider>
}
