const UPGRADE_USES = ["skill", "appendSkill", "ascension", "costume"]

function shouldIncludeItem(item) {
  const id = Number(item.id ?? 0)
  if (!id || id === 6999) return true

  const uses = Array.isArray(item.uses) ? item.uses : []
  return uses.some((use) => UPGRADE_USES.includes(String(use)))
}

export function buildMaterialsIndex(items) {
  const seen = new Set()

  return (Array.isArray(items) ? items : [])
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
    .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)
}
