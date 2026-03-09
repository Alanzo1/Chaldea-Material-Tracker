import { NextResponse } from "next/server"
import { unstable_cache } from "next/cache"

const ITEMS_URL = "https://api.atlasacademy.io/export/NA/nice_item.json"

interface AtlasItem {
  id?: number
  name?: string
  icon?: string
  uses?: string[]
  type?: string
}

interface MaterialIndexItem {
  id: number
  name: string
  icon: string
}

function shouldIncludeItem(item: AtlasItem) {
  const id = Number(item.id ?? 0)
  if (!id || id === 6999) return true

  const uses = Array.isArray(item.uses) ? item.uses : []
  const hasUpgradeUse = uses.some((use) =>
    ["skill", "appendSkill", "ascension", "costume"].includes(String(use))
  )

  if (hasUpgradeUse) return true

  return false
}

function normalizeItems(items: AtlasItem[]) {
  const seen = new Set<number>()

  return items
    .filter(shouldIncludeItem)
    .map((item) => ({
      id: Number(item.id ?? 0),
      name: String(item.name ?? "").trim(),
      icon: String(item.icon ?? "").trim(),
    }))
    .filter((item) => item.id > 0 && item.name.length > 0 && item.icon.length > 0)
    .filter((item) => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

async function getMaterialsIndex() {
  const response = await fetch(ITEMS_URL, {
    next: { revalidate: 86400, tags: ["atlas:materials-index"] },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch items index (${response.status})`)
  }

  const payload = (await response.json()) as AtlasItem[]
  return normalizeItems(Array.isArray(payload) ? payload : [])
}

const getCachedMaterialsIndex = unstable_cache(
  async () => getMaterialsIndex(),
  ["atlas:materials-index"],
  {
    revalidate: 86400,
    tags: ["atlas:materials-index"],
  }
)

export async function GET() {
  try {
    const materials = await getCachedMaterialsIndex()
    return NextResponse.json({ materials })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch materials index",
      },
      { status: 500 }
    )
  }
}
