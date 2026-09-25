"use client"

import { FilterX, Search } from "lucide-react"
import { useMemo } from "react"

import { ChipGroup } from "@/components/ServantBrowser/ChipGroup"
import { FilterListSection } from "@/components/ServantBrowser/FilterListSection"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { FreeQuestIndexEntry } from "@/lib/atlas-types"
import {
  AP_BUCKETS,
  EMPTY_QUEST_FILTERS,
  apBucket,
  countQuestFilters,
  type QuestFilters,
  type QuestSort,
} from "@/lib/quest-filters"
import { useQuestFilters } from "./QuestFilters"

const SORT_LABELS: Record<QuestSort, string> = { default: "Story order", ap: "AP cost", name: "Location" }

const cleanName = (value: string) => value.replace(/\s+/g, " ").trim()

// "undeadOrDemon" → "Undead Or Demon"
function humanize(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (first) => first.toUpperCase())
}

function toggle<T>(values: T[], value: T) {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value]
}

function setChecked<T>(values: T[], value: T, checked: boolean) {
  const without = values.filter((entry) => entry !== value)
  return checked ? [...without, value] : without
}

// Searchable-list options show labels; this maps a label back to its filter value.
function labelled<T>(entries: [T, string][]) {
  const byLabel = new Map(entries.map(([value, label]) => [label, value]))
  const byValue = new Map(entries.map(([value, label]) => [value, label]))
  return {
    labels: entries.map(([, label]) => label),
    valueOf: (label: string) => byLabel.get(label),
    labelsOf: (values: T[]) => values.map((value) => byValue.get(value)).filter((label): label is string => !!label),
  }
}

export function QuestFilterSidebar({ quests, shownCount }: { quests: FreeQuestIndexEntry[]; shownCount: number }) {
  const { query, setQuery, filters, setFilters, sort, setSort } = useQuestFilters()

  const options = useMemo(() => {
    const unique = <T,>(values: T[]) => [...new Set(values)]
    const byName = (a: string, b: string) => a.localeCompare(b)
    const presentBuckets = new Set(quests.map((quest) => apBucket(quest.apCost)))
    const dropNames = new Map(quests.flatMap((quest) => (quest.drops ?? []).map((drop) => [drop.id, cleanName(drop.name)] as const)))
    const dropIcons = Object.fromEntries(
      quests.flatMap((quest) => (quest.drops ?? []).map((drop) => [cleanName(drop.name), drop.icon] as const))
    )

    return {
      chapters: labelled(unique(quests.map((quest) => quest.warId)).map((id) => [
        id,
        cleanName(quests.find((quest) => quest.warId === id)?.warName ?? String(id)),
      ])),
      apBuckets: AP_BUCKETS.filter((bucket) => presentBuckets.has(bucket)).map((bucket) => ({ value: bucket as string, label: `${bucket} AP` })),
      classes: unique(quests.flatMap((quest) => quest.enemyClasses ?? [])).sort(byName).map((value) => ({ value, label: humanize(value) })),
      attributes: unique(quests.flatMap((quest) => quest.enemyAttributes ?? [])).sort(byName).map((value) => ({ value, label: humanize(value) })),
      traits: labelled(unique(quests.flatMap((quest) => quest.enemyTraits ?? [])).sort(byName).map((value) => [value, humanize(value)])),
      drops: labelled([...dropNames.entries()].sort((a, b) => a[1].localeCompare(b[1]))),
      dropIcons,
    }
  }, [quests])

  const update = <K extends keyof QuestFilters>(key: K, next: (current: QuestFilters[K]) => QuestFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: next(current[key]) }))

  const activeCount = countQuestFilters(filters)

  return (
    <div className="flex min-h-0 w-full flex-col rounded-xl border border-border bg-card/60">
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
        <label className="relative block">
          <span className="sr-only">Search quests or locations</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search quests or locations..."
            className="h-10 rounded-full pl-9"
          />
        </label>

        <label className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-muted-foreground">Sort</span>
          <Select value={sort} onValueChange={(value) => setSort(value as QuestSort)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABELS) as QuestSort[]).map((value) => (
                <SelectItem key={value} value={value}>
                  {SORT_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <ChipGroup
          title="AP cost"
          options={options.apBuckets}
          selected={filters.apBuckets}
          onToggle={(value) => update("apBuckets", (current) => toggle(current, value))}
        />
        <ChipGroup
          title="Enemy class"
          options={options.classes}
          selected={filters.enemyClasses}
          onToggle={(value) => update("enemyClasses", (current) => toggle(current, value))}
        />
        <ChipGroup
          title="Enemy attribute"
          options={options.attributes}
          selected={filters.enemyAttributes}
          onToggle={(value) => update("enemyAttributes", (current) => toggle(current, value))}
        />

        <FilterListSection
          title="Enemy traits"
          options={options.traits.labels}
          selected={options.traits.labelsOf(filters.enemyTraits)}
          onChange={(label, checked) => {
            const value = options.traits.valueOf(label)
            if (value) update("enemyTraits", (current) => setChecked(current, value, checked))
          }}
        />
        <FilterListSection
          title="Drops"
          options={options.drops.labels}
          icons={options.dropIcons}
          selected={options.drops.labelsOf(filters.drops)}
          onChange={(label, checked) => {
            const value = options.drops.valueOf(label)
            if (value !== undefined) update("drops", (current) => setChecked(current, value, checked))
          }}
        />
        <FilterListSection
          title="Chapters"
          options={options.chapters.labels}
          selected={options.chapters.labelsOf(filters.chapters)}
          onChange={(label, checked) => {
            const value = options.chapters.valueOf(label)
            if (value !== undefined) update("chapters", (current) => setChecked(current, value, checked))
          }}
        />
      </div>

      <div className="flex flex-col gap-2 border-t border-border p-4">
        <p className="text-center text-sm text-muted-foreground" aria-live="polite">
          {shownCount} / {quests.length} free quests displayed
        </p>
        <button
          type="button"
          onClick={() => {
            setFilters(EMPTY_QUEST_FILTERS)
            setQuery("")
          }}
          disabled={activeCount === 0 && !query}
          className="flex h-10 items-center justify-center gap-2 rounded-full bg-muted text-sm font-medium text-foreground transition-colors hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FilterX className="size-4" aria-hidden="true" />
          Clear {activeCount} filter{activeCount === 1 ? "" : "s"}
        </button>
      </div>
    </div>
  )
}
