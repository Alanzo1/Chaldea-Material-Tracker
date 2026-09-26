"use client"

import { useEffect, useState } from "react"

import { readTrackedMaterialsState, subscribeTracker } from "@/lib/material-tracker"

// Tracked servant ids (localStorage-backed). Read on mount so changes made on
// other pages show up when the component remounts.
export function useCollectionIds() {
  const [ids, setIds] = useState<{ trackedIds: number[] }>({
    trackedIds: [],
  })

  useEffect(() => {
    const update = () => setIds({
      trackedIds: readTrackedMaterialsState().servants.map((entry) => entry.servantId),
    })
    update()
    return subscribeTracker(update)
  }, [])

  return ids
}
