"use client"

import { JpDataState } from "@/components/jp/JpDataState"
import { ItemBrowser } from "@/components/materials/ItemBrowser"
import type { MaterialIndexEntry } from "@/lib/atlas-types"
import { useStaticJson } from "@/lib/use-static-json"

const NO_ITEMS: MaterialIndexEntry[] = []

export function JpItemBrowser({ itemId }: { itemId?: string }) {
  const { data: items, status } = useStaticJson("/data-jp/materials-index.json", NO_ITEMS)
  if (status !== "ready") return <JpDataState status={status === "error" ? "error" : "loading"} what="item" />
  const selected = itemId ? items.find((item) => String(item.id) === itemId) : undefined
  if (itemId && !selected) return <JpDataState status="missing" what="item" />
  return <ItemBrowser items={items} selected={selected} />
}
