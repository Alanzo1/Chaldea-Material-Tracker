"use client"

import { SlidersHorizontal } from "lucide-react"
import { useMemo, useState } from "react"

import { countQuestFilters, filterQuests, sortQuests } from "@/lib/quest-filters"
import { LoadingState } from "@/components/ui/spinner"
import { useFreeQuests } from "@/lib/use-free-quests"
import { cn } from "@/lib/utils"
import { QuestCard } from "./QuestCard"
import { QuestFilterSidebar } from "./QuestFilterSidebar"
import { useQuestFilters } from "./QuestFilters"

// /free-quests: filter sidebar on the left, quest cards on the right (same layout as the servant browser).
export function QuestIndex() {
  const { quests, status } = useFreeQuests()
  const { query, filters, sort } = useQuestFilters()
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const visible = useMemo(() => sortQuests(filterQuests(quests, filters, query), sort), [quests, filters, query, sort])
  const activeCount = countQuestFilters(filters)

  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 py-6 sm:px-6 lg:flex-row lg:items-start lg:gap-6 lg:px-8">
      <button
        type="button"
        aria-expanded={mobileFiltersOpen}
        onClick={() => setMobileFiltersOpen((open) => !open)}
        className="flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-card text-sm font-medium text-foreground lg:hidden"
      >
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        Filters{activeCount > 0 ? ` (${activeCount})` : ""}
        <span className="text-muted-foreground">
          · {visible.length} / {quests.length}
        </span>
      </button>

      <aside
        className={cn(
          "max-h-[75vh] w-full shrink-0 lg:sticky lg:top-22 lg:flex lg:h-[calc(100vh-7rem)] lg:max-h-none lg:w-[340px]",
          mobileFiltersOpen ? "flex" : "hidden"
        )}
      >
        <QuestFilterSidebar quests={quests} shownCount={visible.length} />
      </aside>

      <section className="min-w-0 flex-1">
        <h1 className="sr-only">Free Quests</h1>
        {status === "loading" ? (
          <LoadingState label="Loading free quests…" className="h-60" />
        ) : visible.length ? (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3">
            {visible.map((quest) => (
              <li key={quest.questId}>
                <QuestCard quest={quest} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="grid h-60 place-items-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
            {status === "error"
                ? "Couldn't load free quests. Refresh to try again."
                : "No free quests match these filters."}
          </div>
        )}
      </section>
    </main>
  )
}
