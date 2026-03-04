"use client"

import { createContext, useContext, useMemo, useState } from "react"

const ServantContext = createContext<any>(null)

export interface ServantFilters {
  classes: string[]
  buffs: string[]
  debuffs: string[]
  traits: string[]
  alignments: string[]
  stars: string[]
}

const defaultFilters: ServantFilters = {
  classes: [],
  buffs: [],
  debuffs: [],
  traits: [],
  alignments: [],
  stars: [],
}

function matchesAny(values: string[] = [], selected: string[]) {
  if (!selected.length) return true
  const normalizedValues = values.map((value) => String(value).toLowerCase())
  return selected.some((value) => normalizedValues.includes(String(value).toLowerCase()))
}

export function ServantProvider({
  children,
  initialServants = [],
}: {
  children: React.ReactNode
  initialServants?: any[]
}) {
  const [servants, setServants] = useState<any[]>(initialServants)
  const [filters, setFilters] = useState<ServantFilters>(defaultFilters)

  const filtered = useMemo(
    () =>
      servants.filter((servant) => {
      const classMatch =
        !filters.classes.length ||
        filters.classes.includes(String(servant.className).toLowerCase())

      const buffMatch = matchesAny(servant.buffs, filters.buffs)
      const debuffMatch = matchesAny(servant.debuffs, filters.debuffs)
      const traitMatch = matchesAny(servant.traits, filters.traits)
      const alignmentMatch = matchesAny(servant.alignments, filters.alignments)
      const starMatch = matchesAny([servant.stars], filters.stars)

      return classMatch && buffMatch && debuffMatch && traitMatch && alignmentMatch && starMatch
      }),
    [filters, servants]
  )

  return (
    <ServantContext.Provider
      value={{ servants, setServants, filtered, filters, setFilters }}
    >
      {children}
    </ServantContext.Provider>
  )
}

export function useServants() {
  return useContext(ServantContext)
}
