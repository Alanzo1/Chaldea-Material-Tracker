"use client"

import { usePathname } from "next/navigation"
import { createContext, useContext, useMemo, type ReactNode } from "react"

import { dataBase, regionFromPath, regionHref, type Region } from "@/lib/region"

const DataRegionContext = createContext<Region>("NA")

// The URL decides the region: /jp/... pages read public/data-jp and link within /jp.
export function DataRegionProvider({ children }: { children: ReactNode }) {
  const region = regionFromPath(usePathname() ?? "/")
  return <DataRegionContext.Provider value={region}>{children}</DataRegionContext.Provider>
}

export function useDataRegion() {
  const region = useContext(DataRegionContext)
  return useMemo(
    () => ({ region, base: dataBase(region), href: (naPath: string) => regionHref(region, naPath) }),
    [region]
  )
}
