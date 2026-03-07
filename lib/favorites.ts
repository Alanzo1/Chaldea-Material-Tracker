const FAVORITE_SERVANT_IDS_KEY = "favoriteServantIds"

function toUniqueSortedIds(value: unknown) {
  if (!Array.isArray(value)) return []

  const ids = value
    .map((entry) => Number(entry))
    .filter((id) => Number.isFinite(id) && id > 0)

  return [...new Set(ids)].sort((a, b) => a - b)
}

export function readFavoriteServantIds() {
  if (typeof window === "undefined") return [] as number[]

  try {
    const raw = window.localStorage.getItem(FAVORITE_SERVANT_IDS_KEY)
    if (!raw) return []
    return toUniqueSortedIds(JSON.parse(raw))
  } catch {
    return []
  }
}

export function writeFavoriteServantIds(ids: number[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(
    FAVORITE_SERVANT_IDS_KEY,
    JSON.stringify(toUniqueSortedIds(ids))
  )
}

export function isServantFavorited(servantId: number) {
  return readFavoriteServantIds().includes(servantId)
}

export function toggleFavoriteServant(servantId: number) {
  const ids = new Set(readFavoriteServantIds())

  if (ids.has(servantId)) {
    ids.delete(servantId)
  } else {
    ids.add(servantId)
  }

  const nextIds = [...ids].sort((a, b) => a - b)
  writeFavoriteServantIds(nextIds)
  return nextIds
}
