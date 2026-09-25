"use client"

import { FilterX, Heart, ListChecks } from "lucide-react"
import { useMemo } from "react"

import { ChipGroup, type ChipOption } from "@/components/ServantBrowser/ChipGroup"
import { FilterListSection } from "@/components/ServantBrowser/FilterListSection"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ServantIndexEntry } from "@/lib/atlas-types"
import {
  CLASS_ORDER,
  EMPTY_FILTERS,
  countActiveFilters,
  type CollectionFilter,
  type ServantFilters,
  type ServantSort,
} from "@/lib/servant-filters"

const SORT_LABELS: Record<ServantSort, string> = {
  default: "Default",
  name: "Name",
  rarity: "Rarity",
  class: "Class",
}

const COLLECTION_OPTIONS: ChipOption<CollectionFilter>[] = [
  { value: "favorites", label: <><Heart className="size-4" aria-hidden="true" />Favorites</> },
  { value: "tracked", label: <><ListChecks className="size-4" aria-hidden="true" />Tracked</> },
]

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b))
}

function toggleValue<T>(values: T[], value: T) {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value]
}

interface FilterSidebarProps {
  servants: ServantIndexEntry[]
  shownCount: number
  filters: ServantFilters
  setFilters: React.Dispatch<React.SetStateAction<ServantFilters>>
  sort: ServantSort
  setSort: (sort: ServantSort) => void
}

export function FilterSidebar({
  servants,
  shownCount,
  filters,
  setFilters,
  sort,
  setSort,
}: FilterSidebarProps) {
  const options = useMemo(() => {
    const classNames = new Map<string, string>()
    servants.forEach((servant) => classNames.set(servant.className.toLowerCase(), servant.className))
    const classRank = (value: string) => {
      const index = CLASS_ORDER.indexOf(value)
      return index === -1 ? CLASS_ORDER.length : index
    }

    return {
      classes: [...classNames.entries()]
        .sort(([a], [b]) => classRank(a) - classRank(b) || a.localeCompare(b))
        .map(([value, label]) => ({ value, label })),
      rarities: [...new Set(servants.map((servant) => Number(servant.rarity)))]
        .sort((a, b) => b - a)
        .map((value) => ({ value, label: value > 0 ? "★".repeat(value) : "0★" })),
      attributes: uniqueSorted(servants.map((servant) => servant.attribute)).map((value) => ({ value, label: value })),
      alignments: uniqueSorted(servants.flatMap((servant) => servant.alignments)).map((value) => ({ value, label: value })),
      buffs: uniqueSorted(servants.flatMap((servant) => servant.buffs)),
      debuffs: uniqueSorted(servants.flatMap((servant) => servant.debuffs)),
      traits: uniqueSorted(servants.flatMap((servant) => servant.traits)),
    }
  }, [servants])

  const activeCount = countActiveFilters(filters)

  // Set (not flip) so a duplicate event from the checkbox's wrapping <label> is harmless.
  function setChecked(key: "buffs" | "debuffs" | "traits", value: string, checked: boolean) {
    setFilters((current) => ({
      ...current,
      [key]: checked
        ? [...current[key].filter((entry) => entry !== value), value]
        : current[key].filter((entry) => entry !== value),
    }))
  }

  function toggle<K extends keyof ServantFilters>(key: K, value: ServantFilters[K][number]) {
    setFilters((current) => ({
      ...current,
      [key]: toggleValue(current[key] as ServantFilters[K][number][], value),
    }))
  }

  return (
    <div className="flex min-h-0 w-full flex-col rounded-xl border border-border bg-card/60">
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-muted-foreground">Sort</span>
          <Select value={sort} onValueChange={(value) => setSort(value as ServantSort)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABELS) as ServantSort[]).map((value) => (
                <SelectItem key={value} value={value}>
                  {SORT_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <ChipGroup
          title="Collection"
          options={COLLECTION_OPTIONS}
          selected={filters.collection}
          onToggle={(value) => toggle("collection", value)}
        />
        <ChipGroup title="Class" options={options.classes} selected={filters.classes} onToggle={(value) => toggle("classes", value)} />
        <ChipGroup title="Rarity" options={options.rarities} selected={filters.rarities} onToggle={(value) => toggle("rarities", value)} />
        <ChipGroup title="Attribute" options={options.attributes} selected={filters.attributes} onToggle={(value) => toggle("attributes", value)} />
        <ChipGroup title="Alignment" options={options.alignments} selected={filters.alignments} onToggle={(value) => toggle("alignments", value)} />

        <FilterListSection title="Skill Effects" options={options.buffs} selected={filters.buffs} onChange={(value, checked) => setChecked("buffs", value, checked)} />
        <FilterListSection title="Debuffs" options={options.debuffs} selected={filters.debuffs} onChange={(value, checked) => setChecked("debuffs", value, checked)} />
        <FilterListSection title="Traits" options={options.traits} selected={filters.traits} onChange={(value, checked) => setChecked("traits", value, checked)} />
      </div>

      <div className="flex flex-col gap-2 border-t border-border p-4">
        <p className="text-center text-sm text-muted-foreground">
          {shownCount} / {servants.length} servants displayed
        </p>
        <button
          type="button"
          onClick={() => setFilters(EMPTY_FILTERS)}
          disabled={activeCount === 0}
          className="flex h-10 items-center justify-center gap-2 rounded-full bg-muted text-sm font-medium text-foreground transition-colors hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FilterX className="size-4" aria-hidden="true" />
          Clear {activeCount} filter{activeCount === 1 ? "" : "s"}
        </button>
      </div>
    </div>
  )
}
