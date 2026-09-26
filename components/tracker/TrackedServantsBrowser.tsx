"use client"

import { Plus, SlidersHorizontal, X } from "lucide-react"
import { useMemo, useState } from "react"

import { useServants } from "@/app/contexts/HomePageContext"
import { FilterSidebar } from "@/components/ServantBrowser/FilterSidebar"
import { ServantGrid } from "@/components/ServantBrowser/ServantGrid"
import type { ServantIndexEntry } from "@/lib/atlas-types"
import type { TrackedServantEntry } from "@/lib/material-tracker"
import {
  EMPTY_FILTERS,
  countActiveFilters,
  filterServants,
  sortServants,
  type ServantFilters,
  type ServantSort,
} from "@/lib/servant-filters"
import { cn } from "@/lib/utils"

interface ServantSummary {
  progressPercent: number
  remainingCount: number
}

interface TrackedServantsBrowserProps {
  trackedServants: TrackedServantEntry[]
  summaryById: Record<string, ServantSummary>
  onRemove: (servantId: number) => void
  onAdd: () => void
}

// A tracked entry only has name/class/rarity/portrait; fall back to that if the
// servant is missing from the index (e.g. removed upstream) so it stays visible.
function fallbackEntry(entry: TrackedServantEntry): ServantIndexEntry {
  return {
    id: entry.servantId,
    name: entry.servantName,
    className: entry.className,
    attribute: "",
    rarity: entry.rarity,
    portrait: entry.portrait ?? "",
    buffs: [],
    debuffs: [],
    traits: [],
    alignments: [],
    stars: "",
  }
}

// Planning → Servants tab: the servant browser layout, limited to tracked servants.
// Filters here are independent of /servants.
export function TrackedServantsBrowser({ trackedServants, summaryById, onRemove, onAdd }: TrackedServantsBrowserProps) {
  const { servants } = useServants()
  const [filters, setFilters] = useState<ServantFilters>(EMPTY_FILTERS)
  const [sort, setSort] = useState<ServantSort>("default")
  const [searchQuery, setSearchQuery] = useState("")
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const tracked = useMemo(() => {
    const byId = new Map(servants.map((servant) => [servant.id, servant]))
    return trackedServants.map((entry) => byId.get(entry.servantId) ?? fallbackEntry(entry))
  }, [servants, trackedServants])

  const trackedIds = useMemo(() => tracked.map((servant) => servant.id), [tracked])
  const visible = useMemo(() => {
    const filtered = filterServants(tracked, filters, { query: searchQuery, trackedIds })
    // "Default" keeps the order servants were added in the tracker.
    return sort === "default" ? filtered : sortServants(filtered, sort)
  }, [tracked, filters, searchQuery, trackedIds, sort])
  const activeCount = countActiveFilters(filters)

  if (!trackedServants.length) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center">
        <p className="text-sm text-muted-foreground">No servants tracked yet.</p>
        <button
          type="button"
          onClick={onAdd}
          className="mt-3 text-xs text-primary underline underline-offset-2 transition-colors hover:text-primary/80"
        >
          Add your first servant
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
      <button
        type="button"
        aria-expanded={mobileFiltersOpen}
        onClick={() => setMobileFiltersOpen((open) => !open)}
        className="flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-card text-sm font-medium text-foreground lg:hidden"
      >
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        Filters{activeCount > 0 ? ` (${activeCount})` : ""}
        <span className="text-muted-foreground">
          · {visible.length} / {tracked.length}
        </span>
      </button>

      <aside
        className={cn(
          "max-h-[75vh] w-full shrink-0 lg:sticky lg:top-36 lg:flex lg:h-[calc(100vh-10rem)] lg:max-h-none lg:w-[340px]",
          mobileFiltersOpen ? "flex" : "hidden"
        )}
      >
        <FilterSidebar
          servants={tracked}
          shownCount={visible.length}
          filters={filters}
          setFilters={setFilters}
          sort={sort}
          setSort={setSort}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          showCollection={false}
        />
      </aside>

      <section className="min-w-0 flex-1 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {trackedServants.length} servant{trackedServants.length === 1 ? "" : "s"} tracked
          </p>
          <button
            type="button"
            onClick={onAdd}
            className="flex h-9 items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 text-sm font-medium text-amber-400 transition-all hover:border-amber-500/50 hover:bg-amber-500/15"
          >
            <Plus className="size-4" aria-hidden="true" />
            Add Servant
          </button>
        </div>
        <ServantGrid
          servants={visible}
          getHref={(servant) => `/track-materials/${servant.id}`}
          emptyMessage="No tracked servants match these filters."
          renderFooter={(servant) => {
            const summary = summaryById[String(servant.id)] ?? { progressPercent: 0, remainingCount: 0 }
            const progress = Math.min(100, Math.max(0, summary.progressPercent))
            return (
              <span className="block px-2 pb-2" title={`${summary.remainingCount} material types remaining`}>
                <span className="block h-1 w-full overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
                </span>
                <span className="mt-1 block text-center text-[11px] tabular-nums text-muted-foreground">
                  {progress.toFixed(0)}% complete
                </span>
              </span>
            )
          }}
          renderOverlay={(servant) => (
            <button
              type="button"
              onClick={() => onRemove(servant.id)}
              aria-label={`Remove ${servant.name} from Planning`}
              title="Remove from Planning"
              className="grid size-7 place-items-center rounded-full bg-background/85 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        />
      </section>
    </div>
  )
}
