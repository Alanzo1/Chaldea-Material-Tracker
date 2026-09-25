"use client"

import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from "react"

import { EMPTY_QUEST_FILTERS, type QuestFilters, type QuestSort } from "@/lib/quest-filters"

// Shared by /free-quests (filter sidebar + grid) and /free-quests/[questId] (list + detail),
// so filters survive moving between the two.
const Context = createContext<{
  query: string
  setQuery: (value: string) => void
  filters: QuestFilters
  setFilters: Dispatch<SetStateAction<QuestFilters>>
  sort: QuestSort
  setSort: (value: QuestSort) => void
} | null>(null)

export function QuestFiltersProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("")
  const [filters, setFilters] = useState<QuestFilters>(EMPTY_QUEST_FILTERS)
  const [sort, setSort] = useState<QuestSort>("default")
  return (
    <Context.Provider value={{ query, setQuery, filters, setFilters, sort, setSort }}>{children}</Context.Provider>
  )
}

export function useQuestFilters() {
  const filters = useContext(Context)
  if (!filters) throw new Error("Quest filters require QuestFiltersProvider")
  return filters
}
