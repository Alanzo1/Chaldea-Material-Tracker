import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

const REGION = "NA"
const WARS_URL = `https://api.atlasacademy.io/export/${REGION}/nice_war.json`
const QUEST_PHASE_URL = (questId, phase) =>
  `https://api.atlasacademy.io/nice/${REGION}/quest/${questId}/${phase}`
const CONCURRENCY = 20
const OUTPUT_PATH = join(process.cwd(), "data", "drop-data.json")
const BLOCKED_QUEST_TYPES = new Set([
  "main",
  "friendship",
  "tutorial",
  "enemy",
  "event",
])
const DIRECT_FARM_TYPES = new Set(["free", "daily"])

function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function toArray(value) {
  return Array.isArray(value) ? value : []
}

function includesChaldeaGate(value) {
  const text = String(value ?? "").toLowerCase()
  return text.includes("chaldea gate")
}

function isFarmableQuest(war, quest, type, consume, questId, phases) {
  if (consume <= 0 || questId <= 0 || phases.length === 0) return false
  if (DIRECT_FARM_TYPES.has(type)) return true
  if (BLOCKED_QUEST_TYPES.has(type)) return false

  // Chaldea Gate often uses non-"free" quest typing but is still repeatable.
  const isChaldeaGateWar =
    includesChaldeaGate(war?.name) || includesChaldeaGate(war?.longName)

  return isChaldeaGateWar
}

function dedupeAndSort(nodes) {
  const byQuest = new Map()

  nodes.forEach((node) => {
    const key = `${node.id}-${node.questName}`
    const existing = byQuest.get(key)
    if (!existing || node.apPerDrop < existing.apPerDrop) {
      byQuest.set(key, node)
    }
  })

  return [...byQuest.values()]
    .sort((a, b) => a.apPerDrop - b.apPerDrop)
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Fetch failed (${response.status}): ${url}`)
  }
  return response.json()
}

async function loadExistingOutput() {
  try {
    const raw = await readFile(OUTPUT_PATH, "utf8")
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed
    }
    return {}
  } catch {
    return {}
  }
}

async function run() {
  console.log("Fetching wars...")
  const wars = await fetchJson(WARS_URL)

  const farmableQuests = []

  for (const war of toArray(wars)) {
    for (const spot of toArray(war?.spots)) {
      for (const quest of toArray(spot?.quests)) {
        const type = String(quest?.type ?? "").toLowerCase()
        const consume = toNumber(quest?.consume)
        const questId = toNumber(quest?.id)
        const phases = toArray(quest?.phases)
          .map((phase) => toNumber(phase))
          .filter((phase) => phase > 0)

        if (isFarmableQuest(war, quest, type, consume, questId, phases)) {
          farmableQuests.push({
            id: questId,
            phases,
            warName: String(war?.longName ?? war?.name ?? "").trim(),
            locationName: String(spot?.name ?? "").trim(),
            questTitle: String(quest?.name ?? "").trim(),
          })
        }
      }
    }
  }

  console.log(`Found ${farmableQuests.length} farmable quests (free + daily)`)

  const jobs = farmableQuests.flatMap((quest) =>
    quest.phases.map((phase) => ({
      questId: quest.id,
      phase,
      warName: quest.warName,
      locationName: quest.locationName,
      questTitle: quest.questTitle,
    }))
  )

  console.log(`Fetching ${jobs.length} quest phases with concurrency ${CONCURRENCY}...`)

  const dropMap = new Map()
  let cursor = 0
  let completed = 0

  async function worker() {
    while (true) {
      const index = cursor
      cursor += 1
      if (index >= jobs.length) break

      const { questId, phase, warName, locationName, questTitle } = jobs[index]
      const detail = await fetch(QUEST_PHASE_URL(questId, phase))
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null)

      completed += 1
      if (completed % 100 === 0) {
        console.log(`  ${completed}/${jobs.length}`)
      }

      if (!detail?.drops?.length) continue

      const apCost = toNumber(detail.consume ?? detail.ap ?? detail.apCost)
      const resolvedWarName = String(warName || "").trim()
      const resolvedLocationName = String(locationName || detail.spotName || "").trim()
      const resolvedQuestTitle = String(questTitle || detail.name || "").trim()
      const questName = [resolvedLocationName, resolvedQuestTitle].filter(Boolean).join(" - ")

      for (const drop of detail.drops) {
        const itemId = toNumber(drop?.objectId ?? drop?.itemId)
        const runs = toNumber(drop?.runs ?? detail?.runs ?? detail?.sampleNum)
        const dropNum = toNumber(drop?.dropNum ?? drop?.dropCount ?? drop?.num)

        if (!itemId || runs <= 0 || dropNum <= 0 || apCost <= 0) continue

        const dropRate = dropNum / runs
        if (dropRate <= 0) continue

        const apPerDrop = apCost / dropRate
        if (!Number.isFinite(apPerDrop) || apPerDrop <= 0) continue

        if (!dropMap.has(itemId)) dropMap.set(itemId, [])

        dropMap.get(itemId).push({
          id: toNumber(detail.id),
          questName: questName || `Quest ${questId}`,
          apCost,
          dropRate,
          apPerDrop,
          runs,
          warName: resolvedWarName || undefined,
          locationName: resolvedLocationName || undefined,
          questTitle: resolvedQuestTitle || undefined,
        })
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

  const output = {}
  for (const [itemId, nodes] of dropMap.entries()) {
    output[itemId] = dedupeAndSort(nodes)
  }

  await mkdir(dirname(OUTPUT_PATH), { recursive: true })
  await writeFile(OUTPUT_PATH, JSON.stringify(output))

  console.log(`Done. Wrote ${Object.keys(output).length} items to ${OUTPUT_PATH}`)
}

run().catch(async (error) => {
  console.error("Drop data build failed:", error)
  const fallback = await loadExistingOutput()
  await mkdir(dirname(OUTPUT_PATH), { recursive: true })
  await writeFile(OUTPUT_PATH, JSON.stringify(fallback))
  process.exitCode = 0
})
