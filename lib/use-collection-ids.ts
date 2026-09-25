"use client"

import { useEffect, useState } from "react"

import { readFavoriteServantIds } from "@/lib/favorites"
import { readTrackedMaterialsState } from "@/lib/material-tracker"

// Favorite and tracked servant ids (localStorage-backed). Read on mount so changes made on
// other pages show up when the component remounts.
export function useCollectionIds() {
  const [ids, setIds] = useState<{ favoriteIds: number[]; trackedIds: number[] }>({
    favoriteIds: [],
    trackedIds: [],
  })

  useEffect(() => {
    setIds({
      favoriteIds: readFavoriteServantIds(),
      trackedIds: readTrackedMaterialsState().servants.map((entry) => entry.servantId),
    })
  }, [])

  return ids
}
