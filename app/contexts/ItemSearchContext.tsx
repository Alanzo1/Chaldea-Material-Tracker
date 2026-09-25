"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

const ItemSearchContext = createContext<{
  query: string
  setQuery: (query: string) => void
} | null>(null)

// Keep the search above the item routes so selecting an item does not reset it.
export function ItemSearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("")

  return (
    <ItemSearchContext.Provider value={{ query, setQuery }}>
      {children}
    </ItemSearchContext.Provider>
  )
}

export function useItemSearch() {
  const context = useContext(ItemSearchContext)
  if (!context) throw new Error("useItemSearch must be used within ItemSearchProvider")
  return context
}
