"use client"

import { SlidersHorizontal } from "lucide-react"
import { useMemo, useState } from "react"

import { FilterSidebar } from "@/components/ServantBrowser/FilterSidebar"
import { ServantGrid } from "@/components/ServantBrowser/ServantGrid"
import { countActiveFilters, filterServants, sortServants } from "@/lib/servant-filters"
import { useCollectionIds } from "@/lib/use-collection-ids"
import { cn } from "@/lib/utils"
import { useServants } from "../contexts/HomePageContext"

function Homepage() {
  const { servants, servantsStatus, filters, setFilters, sort, setSort, searchQuery, setSearchQuery } = useServants()
  const { trackedIds } = useCollectionIds()
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const visibleServants = useMemo(
    () =>
      sortServants(
        filterServants(servants, filters, { query: searchQuery, trackedIds }),
        sort
      ),
    [servants, filters, searchQuery, trackedIds, sort]
  )
  const activeCount = countActiveFilters(filters)

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
          · {visibleServants.length} / {servants.length}
        </span>
      </button>

      <aside
        className={cn(
          "max-h-[75vh] w-full shrink-0 lg:sticky lg:top-22 lg:flex lg:h-[calc(100vh-7rem)] lg:max-h-none lg:w-[340px]",
          mobileFiltersOpen ? "flex" : "hidden"
        )}
      >
        <FilterSidebar
          servants={servants}
          shownCount={visibleServants.length}
          filters={filters}
          setFilters={setFilters}
          sort={sort}
          setSort={setSort}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
      </aside>

      <section className="min-w-0 flex-1">
        <ServantGrid
          servants={visibleServants}
          emptyMessage={
            servantsStatus === "loading"
              ? "Loading servants…"
              : servantsStatus === "error"
                ? "Couldn't load servants. Refresh to try again."
                : undefined
          }
        />
      </section>
    </main>
  )
}

export default Homepage
