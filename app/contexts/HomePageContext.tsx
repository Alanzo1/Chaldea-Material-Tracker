"use client"

import { createContext, useContext, useState } from "react"

import type { ServantIndexEntry } from "@/lib/atlas-types"
import { EMPTY_FILTERS, type ServantFilters, type ServantSort } from "@/lib/servant-filters"

// Browser state shared by the NavBar search and the home page servant browser.
// Lives in the root layout, so it survives navigation between pages.
interface ServantContextValue {
  servants: ServantIndexEntry[]
  filters: ServantFilters
  setFilters: React.Dispatch<React.SetStateAction<ServantFilters>>
  sort: ServantSort
  setSort: React.Dispatch<React.SetStateAction<ServantSort>>
  searchQuery: string
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>
}

const ServantContext = createContext<ServantContextValue | null>(null)

export function ServantProvider({
  children,
  initialServants = [],
}: {
  children: React.ReactNode
  initialServants?: ServantIndexEntry[]
}) {
  const [filters, setFilters] = useState<ServantFilters>(EMPTY_FILTERS)
  const [sort, setSort] = useState<ServantSort>("default")
  const [searchQuery, setSearchQuery] = useState("")

  return (
    <ServantContext.Provider
      value={{
        servants: initialServants,
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
