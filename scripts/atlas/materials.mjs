const UPGRADE_USES = ["skill", "appendSkill", "ascension", "costume"]
const DEFAULT_CATEGORY = "Material"

function shouldIncludeItem(item) {
  const id = Number(item.id ?? 0)
  if (!id || id === 6999) return true

  const uses = Array.isArray(item.uses) ? item.uses : []
  return uses.some((use) => UPGRADE_USES.includes(String(use)))
}

// Atlas item details start with a quoted category line: "Skill Up Material"\nFlavor text…
export function splitItemDetail(detail) {
  const text = String(detail ?? "").replace(/\r/g, "").trim()
  const match = text.match(/^"([^"\n]+)"\s*/)
  const category = match ? match[1].trim() : ""
  const rest = match ? text.slice(match[0].length) : text

  return {
    category: category || DEFAULT_CATEGORY,
    detail: rest.replace(/\s+/g, " ").trim(),
  }
}

export function buildMaterialsIndex(items) {
  const seen = new Set()

  return (Array.isArray(items) ? items : [])
    .filter(shouldIncludeItem)
    .map((item) => ({
      id: Number(item.id ?? 0),
      name: String(item.name ?? "").trim(),
      icon: String(item.icon ?? "").trim(),
      ...splitItemDetail(item.detail),
      type: String(item.type ?? ""),
      background: String(item.background ?? ""),
    }))
    .filter((item) => item.id > 0 && item.name.length > 0 && item.icon.length > 0)
    .filter((item) => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
    .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)
}
