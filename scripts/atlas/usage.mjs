// Item → servants that need it, aggregated from trimmed servant details.
// Multipliers match the servant page's Mat Summary: per-level skill/append costs apply to every slot.

function emptyCounts() {
  return { ascension: 0, skill: 0, append: 0, costume: 0 }
}

function addStageMap(perItem, stageMap, key, multiplier) {
  for (const stage of Object.values(stageMap ?? {})) {
    for (const entry of stage?.items ?? []) {
      const itemId = Number(entry?.item?.id ?? 0)
      const amount = Number(entry?.amount ?? 0)
      if (!itemId || !(amount > 0)) continue

      const counts = perItem.get(itemId) ?? emptyCounts()
      counts[key] += amount * multiplier
      perItem.set(itemId, counts)
    }
  }
}

export function buildItemUsage(servantDetails) {
  const usage = {}

  for (const [servantId, detail] of servantDetails) {
    const skillSlots = Math.max(new Set((detail.skills ?? []).map((skill) => skill?.num)).size, 1)
    const appendSlots = Math.max((detail.appendPassive ?? []).length, 1)
    const perItem = new Map()

    addStageMap(perItem, detail.ascensionMaterials, "ascension", 1)
    addStageMap(perItem, detail.skillMaterials, "skill", skillSlots)
    addStageMap(perItem, detail.appendSkillMaterials, "append", appendSlots)
    addStageMap(perItem, detail.costumeMaterials, "costume", 1)

    for (const [itemId, counts] of perItem) {
      const total = counts.ascension + counts.skill + counts.append + counts.costume
      ;(usage[String(itemId)] ??= []).push({ servantId: Number(servantId), ...counts, total })
    }
  }

  for (const list of Object.values(usage)) {
    list.sort((a, b) => b.total - a.total || a.servantId - b.servantId)
  }
  return usage
}
