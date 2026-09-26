"use client"

import { RegionLink as Link } from "@/components/RegionLink"
import { Map as MapIcon, Search, SlidersHorizontal } from "lucide-react"
import { useMemo, useState } from "react"
import type { FreeQuestPhase } from "@/lib/atlas-types"
import { countQuestFilters, filterQuests, sortQuests } from "@/lib/quest-filters"
import { LoadingState } from "@/components/ui/spinner"
import { useFreeQuests } from "@/lib/use-free-quests"
import { cn } from "@/lib/utils"
import { QuestCard } from "./QuestCard"
import { useQuestFilters } from "./QuestFilters"
import { QuestDetail } from "./QuestDetail"

// /free-quests/[questId]: compact quest list (honoring the /free-quests filters) beside the quest detail.
export function QuestBrowser({ selected }: { selected?: FreeQuestPhase }) {
  const { quests, status } = useFreeQuests()
  const { query, setQuery, filters, sort } = useQuestFilters()
  const [mobileOpen, setMobileOpen] = useState(!selected)
  const visible = useMemo(() => sortQuests(filterQuests(quests, filters, query), sort), [quests, filters, query, sort])
  const activeCount = countQuestFilters(filters)

  return (
    <main className="mx-auto grid w-full max-w-[1600px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:px-8">
      {selected && <button type="button" onClick={() => setMobileOpen(!mobileOpen)} aria-expanded={mobileOpen} className="flex h-11 items-center justify-center gap-2 rounded-md border bg-card lg:hidden"><SlidersHorizontal className="size-4" />{mobileOpen ? "Hide quests" : "Browse quests"}</button>}
      <aside className={cn("min-h-0 max-h-[70svh] flex-col rounded-xl border bg-card/60 lg:sticky lg:top-22 lg:flex lg:h-[calc(100svh-7rem)] lg:max-h-none", mobileOpen ? "flex" : "hidden")}>
        <div className="space-y-3 p-4">
          <h2 className="text-lg font-bold">Free Quests</h2>
          <label className="relative block">
            <span className="sr-only">Search quests or locations</span>
            <Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" aria-hidden="true" />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search quests or locations…" className="h-11 w-full rounded-full border bg-background pl-9 pr-3 text-sm" />
          </label>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span aria-live="polite">{visible.length} of {quests.length} quests{activeCount ? ` · ${activeCount} filter${activeCount === 1 ? "" : "s"}` : ""}</span>
            <Link href="/free-quests" className="underline underline-offset-4">{activeCount ? "Edit filters" : "All filters"}</Link>
          </div>
        </div>
        <div className="min-h-0 overflow-y-auto px-3 pb-3">
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
            {visible.map((quest) => <li key={quest.questId}>
              <QuestCard quest={quest} selected={selected?.questId === quest.questId} onNavigate={() => setMobileOpen(false)} />
            </li>)}
          </ul>
          {status === "loading" && <LoadingState label="Loading quests…" className="py-10" />}
          {status !== "loading" && !visible.length && <p className="py-10 text-center text-sm text-muted-foreground">{status === "error" ? "Couldn't load quests. Refresh to try again." : "No quests match these filters."}</p>}
        </div>
      </aside>
      <section className="min-w-0">
        {selected ? <QuestDetail key={selected.questId} quest={selected} /> : <div className="rounded-xl border border-dashed p-8 text-center lg:py-20"><MapIcon className="mx-auto mb-4 size-10 text-cyan-400" /><h1 className="text-2xl font-bold">Explore Free Quests</h1><p className="mt-3 text-muted-foreground">Choose a quest to compare drops and inspect each wave.</p></div>}
      </section>
    </main>
  )
}
