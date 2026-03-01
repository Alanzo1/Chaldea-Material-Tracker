"use client"

import { createContext, useContext, useEffect, useState } from "react"

import { getServantsHomePage } from "../services/api"

const ServantContext = createContext<any>(null)

export interface ServantFilters {
  classes: string[]
  buffs: string[]
  debuffs: string[]
}

const defaultFilters: ServantFilters = {
  classes: [],
  buffs: [],
  debuffs: [],
}

function matchesAny(values: string[] = [], selected: string[]) {
  if (!selected.length) return true
  const normalizedValues = values.map((value) => String(value).toLowerCase())
  return selected.some((value) => normalizedValues.includes(String(value).toLowerCase()))
}

export function ServantProvider({ children }: any) {
  const [servants, setServants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtered, setFiltered] = useState<any[]>([])
  const [filters, setFilters] = useState<ServantFilters>(defaultFilters)

  useEffect(() => {
    const loadServants = async () => {
      try {
        const servantData = await getServantsHomePage()
        setServants(servantData)
      } catch (err) {
        console.log(err)
      } finally {
        setLoading(false)
      }
    }

    loadServants()
  }, [])

  useEffect(() => {
    const nextFiltered = servants.filter((servant) => {
      const classMatch =
        !filters.classes.length ||
        filters.classes.includes(String(servant.className).toLowerCase())

      const buffMatch = matchesAny(servant.buffs, filters.buffs)
      const debuffMatch = matchesAny(servant.debuffs, filters.debuffs)

      return classMatch && buffMatch && debuffMatch
    })

    setFiltered(nextFiltered)
  }, [filters, servants])

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <ServantContext.Provider
      value={{ servants, setServants, filtered, setFiltered, filters, setFilters }}
    >
      {children}
    </ServantContext.Provider>
  )
}

export function useServants() {
  return useContext(ServantContext)
}