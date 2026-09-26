"use client"

import { createContext, useContext, useState } from "react"

import type { ServantIndexEntry } from "@/lib/atlas-types"
import { EMPTY_FILTERS, type ServantFilters, type ServantSort } from "@/lib/servant-filters"
import { useStaticJson, type StaticJsonStatus } from "@/lib/use-static-json"

const NO_SERVANTS: ServantIndexEntry[] = []

// Home page servant browser state (filters, sort, name search).
// Lives in the root layout, so it survives navigation between pages.
interface ServantContextValue {
  /** Loaded client-side from /data/servants-index.json (empty until `servantsStatus` is "ready"). */
  servants: ServantIndexEntry[]
  servantsStatus: StaticJsonStatus
  filters: ServantFilters
  setFilters: React.Dispatch<React.SetStateAction<ServantFilters>>
  sort: ServantSort
  setSort: React.Dispatch<React.SetStateAction<ServantSort>>
  searchQuery: string
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>
}

const ServantContext = createContext<ServantContextValue | null>(null)

export function ServantProvider({ children }: { children: React.ReactNode }) {
  const { data: servants, status: servantsStatus } = useStaticJson("/data/servants-index.json", NO_SERVANTS)
  const [filters, setFilters] = useState<ServantFilters>(EMPTY_FILTERS)
  const [sort, setSort] = useState<ServantSort>("default")
  const [searchQuery, setSearchQuery] = useState("")

  return (
    <ServantContext.Provider
      value={{
        servants,
        servantsStatus,
        filters,
        setFilters,
        sort,
        setSort,
        searchQuery,
        setSearchQuery,
      }}
    >
      {children}
    </ServantContext.Provider>
  )
}

export function useServants() {
  const context = useContext(ServantContext)
  if (!context) throw new Error("useServants must be used inside ServantProvider")
  return context
}
