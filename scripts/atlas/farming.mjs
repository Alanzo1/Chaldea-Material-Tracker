export const FARMING_LIMIT = 6
const MIN_RUNS = 200
const EXCLUDED_ITEM_IDS = new Set([6999])
const CLASS_NAMES = ["Saber", "Archer", "Lancer", "Rider", "Caster", "Assassin", "Berserker"]
const BLOCKED_QUEST_TYPES = new Set(["main", "friendship", "tutorial", "enemy", "event"])
const DIRECT_FARM_TYPES = new Set(["free", "daily"])

function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function toArray(value) {
  return Array.isArray(value) ? value : []
}

function includesChaldeaGate(value) {
  return String(value ?? "").toLowerCase().includes("chaldea gate")
}

function isFarmableQuest(war, type, consume, questId, phases) {
  if (consume <= 0 || questId <= 0 || phases.length === 0) return false
  if (DIRECT_FARM_TYPES.has(type)) return true
  if (BLOCKED_QUEST_TYPES.has(type)) return false

  // Chaldea Gate often uses non-"free" quest typing but is still repeatable.
  return includesChaldeaGate(war?.name) || includesChaldeaGate(war?.longName)
}

function compareNodes(a, b) {
  return a.apPerDrop - b.apPerDrop || a.id - b.id || a.questName.localeCompare(b.questName)
}

export function selectQuestPhaseJobs(wars) {
  const jobs = []

  for (const war of toArray(wars)) {
    for (const spot of toArray(war?.spots)) {
      for (const quest of toArray(spot?.quests)) {
        const type = String(quest?.type ?? "").toLowerCase()
        const consume = toNumber(quest?.consume)
        const questId = toNumber(quest?.id)
        const phases = toArray(quest?.phases).map(toNumber).filter((phase) => phase > 0)

        if (!isFarmableQuest(war, type, consume, questId, phases)) continue

        for (const phase of phases) {
          jobs.push({
            questId,
            phase,
            warName: String(war?.longName ?? war?.name ?? "").trim(),
            locationName: String(spot?.name ?? "").trim(),
            questTitle: String(quest?.name ?? "").trim(),
          })
        }
      }
    }
  }

  return jobs.sort((a, b) => a.questId - b.questId || a.phase - b.phase)
}

export function aggregateDrops(results) {
  const byItem = new Map()

  for (const { job, detail } of results) {
    if (!detail?.drops?.length) continue

    const apCost = toNumber(detail.consume ?? detail.ap ?? detail.apCost)
    const warName = String(job.warName || "").trim()
    const locationName = String(job.locationName || detail.spotName || "").trim()
    const questTitle = String(job.questTitle || detail.name || "").trim()
    const questName = [locationName, questTitle].filter(Boolean).join(" - ")

    for (const drop of detail.drops) {
      const itemId = toNumber(drop?.objectId ?? drop?.itemId)
      const runs = toNumber(drop?.runs ?? detail?.runs ?? detail?.sampleNum)
      const dropNum = toNumber(drop?.dropNum ?? drop?.dropCount ?? drop?.num)

      if (!itemId || runs <= 0 || dropNum <= 0 || apCost <= 0) continue

      const dropRate = dropNum / runs
      const apPerDrop = apCost / dropRate
      if (!Number.isFinite(apPerDrop) || apPerDrop <= 0) continue

      const node = {
        id: toNumber(detail.id),
        questName: questName || `Quest ${job.questId}`,
        apCost,
        dropRate,
        apPerDrop,
        runs,
        warName: warName || undefined,
        locationName: locationName || undefined,
        questTitle: questTitle || undefined,
      }

      if (!byItem.has(itemId)) byItem.set(itemId, new Map())
      const byQuest = byItem.get(itemId)
      const key = `${node.id}-${node.questName}`
      const existing = byQuest.get(key)
      if (!existing || compareNodes(node, existing) < 0) byQuest.set(key, node)
    }
  }

  const output = new Map()
  for (const itemId of [...byItem.keys()].sort((a, b) => a - b)) {
    output.set(itemId, [...byItem.get(itemId).values()].sort(compareNodes))
  }
  return output
}

function sanitizeLabel(value) {
  const normalized = String(value ?? "").trim()
  if (!normalized) return ""
  if (/^[-‐‑‒–—―ー－\s]+$/u.test(normalized)) return ""
  return normalized
}

function pickPreferredLabel(primary, fallback) {
  return sanitizeLabel(primary) || sanitizeLabel(fallback)
}

export function buildQuestMeta(wars) {
  const questMetaById = new Map()

  for (const war of toArray(wars)) {
    const warName = sanitizeLabel(war?.name) || sanitizeLabel(war?.longName)
    for (const spot of toArray(war?.spots)) {
      const locationName = sanitizeLabel(spot?.name) || sanitizeLabel(spot?.longName)
      for (const quest of toArray(spot?.quests)) {
        const questId = Number(quest?.id)
        if (!Number.isFinite(questId) || questId <= 0 || questMetaById.has(questId)) continue
        questMetaById.set(questId, { warName, locationName, questTitle: sanitizeLabel(quest?.name) })
      }
    }
  }

  return questMetaById
}

function getTrainingGroundNodes(itemId) {
  const itemGroups = [
    [6001, 6007], // Gem of <Class>
    [6101, 6107], // Magic Gem of <Class>
    [6201, 6207], // Secret Gem of <Class>
    [7001, 7007], // <Class> Piece
    [7101, 7107], // <Class> Monument
  ]

  const range = itemGroups.find(([start, end]) => itemId >= start && itemId <= end)
  if (!range) return []

  const classIndex = itemId % 10
  if (classIndex < 1 || classIndex > CLASS_NAMES.length) return []
  const className = CLASS_NAMES[classIndex - 1]

  // APD values follow the benchmark table requested for class materials.
  const templates = [
    { tier: "Intermediate", apCost: 20, apPerDrop: 30 },
    { tier: "Advanced", apCost: 30, apPerDrop: 30 },
    { tier: "Novice", apCost: 10, apPerDrop: 45 },
    { tier: "Expert", apCost: 40, apPerDrop: 55 },
  ]

  return templates.map((template, index) => ({
    id: -(classIndex * 100 + index + 1),
    questName: `${className} Training Ground - ${template.tier} (Sunday - Chaldea Gate)`,
    apCost: template.apCost,
    dropRate: template.apCost / template.apPerDrop,
    apPerDrop: template.apPerDrop,
    // synthetic rows: large runs value so they are not removed by minRuns filtering
    runs: 999999,
    warName: "Chaldea Gate",
    locationName: `Sunday ${className} Training Ground`,
    questTitle: template.tier,
  }))
}

function isPinnedTrainingNode(node) {
  return Number(node.id) < 0 || node.warName === "Chaldea Gate"
}

function normalizeNode(node) {
  const normalizedLocationName = sanitizeLabel(node.locationName)
  const normalizedQuestTitle = sanitizeLabel(node.questTitle)
  const normalizedWarName = sanitizeLabel(node.warName)

  if (normalizedLocationName && normalizedQuestTitle) return node

  const rawQuestName = String(node.questName ?? "").trim()
  const separatorIndex = rawQuestName.indexOf(" - ")
  if (separatorIndex < 0) {
    return {
      ...node,
      warName: normalizedWarName || undefined,
      questTitle: normalizedQuestTitle || sanitizeLabel(rawQuestName),
      locationName: normalizedLocationName || "",
    }
  }

  return {
    ...node,
    warName: normalizedWarName || undefined,
    locationName: normalizedLocationName || sanitizeLabel(rawQuestName.slice(0, separatorIndex)),
    questTitle: normalizedQuestTitle || sanitizeLabel(rawQuestName.slice(separatorIndex + 3)),
  }
}

function enrichWithQuestMeta(node, questMetaById) {
  const questId = Number(node.id)
  if (!Number.isFinite(questId) || questId <= 0) return node

  const metadata = questMetaById.get(questId)
  if (!metadata) return node

  return {
    ...node,
    warName: pickPreferredLabel(node.warName, metadata.warName) || undefined,
    locationName: pickPreferredLabel(node.locationName, metadata.locationName) || undefined,
    questTitle: pickPreferredLabel(node.questTitle, metadata.questTitle) || undefined,
  }
}

function selectNodes(itemId, dropNodes, questMetaById) {
  if (EXCLUDED_ITEM_IDS.has(itemId)) return []

  const rawNodes = [...dropNodes]
  for (const trainingNode of getTrainingGroundNodes(itemId)) {
    if (!rawNodes.some((node) => node.questName === trainingNode.questName)) rawNodes.push(trainingNode)
  }

  const sorted = rawNodes
    .map(normalizeNode)
    .map((node) => enrichWithQuestMeta(node, questMetaById))
    .filter((node) => Number(node.runs ?? 0) >= MIN_RUNS || Number(node.id) <= 0)
    .sort(compareNodes)

  const pinned = sorted.filter(isPinnedTrainingNode)
  const normal = sorted.filter((node) => !isPinnedTrainingNode(node))
  return [...pinned, ...normal].slice(0, Math.max(FARMING_LIMIT, pinned.length))
}

export function buildFarmingIndex(dropsByItemId, itemIds, questMetaById) {
  const allIds = [...new Set([...itemIds, ...dropsByItemId.keys()])].sort((a, b) => a - b)
  const index = {}
  for (const itemId of allIds) {
    index[String(itemId)] = selectNodes(itemId, dropsByItemId.get(itemId) ?? [], questMetaById)
  }
  return index
}
