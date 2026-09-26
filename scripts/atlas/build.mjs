import { createRegionConfig } from "./region.mjs"

import { readPreviousStats, validateDataset, writeDataset } from "./dataset.mjs"
import { aggregateDrops, buildFarmingIndex, buildQuestMeta, selectQuestPhaseJobs } from "./farming.mjs"
import { fetchJson, mapWithRetryPass } from "./fetch.mjs"
import { buildMaterialsIndex } from "./materials.mjs"
import { buildEffectNameMaps, buildServantsIndex, trimServantDetail } from "./servants.mjs"
import { buildItemFiles, buildItemUsage } from "./usage.mjs"
import { buildFreeQuestData, selectFreeQuestJobs } from "./quests.mjs"

const QUEST_CONCURRENCY = 8

// Only wars with quests the pipeline reads (free quests and farming phases) are re-fetched.
async function fetchTranslatedWars(wars, warUrl) {
  const questIds = new Set([...selectFreeQuestJobs(wars), ...selectQuestPhaseJobs(wars)].map((job) => job.questId))
  const ids = wars
    .filter((war) => (war.spots ?? []).some((spot) => (spot.quests ?? []).some((quest) => questIds.has(quest.id))))
    .map((war) => war.id)
  console.log(`Fetching ${ids.length} translated wars...`)
  const { results, failed } = await mapWithRetryPass(ids, QUEST_CONCURRENCY, (id) => fetchJson(warUrl(id), { timeoutMs: 60000 }))
  if (failed.length) throw new Error("Translated war fetch failed; existing data kept")
  const translated = new Map(results.map((war) => [war.id, war]))
  return wars.map((war) => translated.get(war.id) ?? war)
}

async function run() {
  const { region, outDir: OUT_DIR, exportUrl: EXPORT_URL, questPhaseUrl: QUEST_PHASE_URL, basicServantUrl, warUrl, translateWars, effectNamesUrl } = createRegionConfig(process.argv.slice(2))
  console.log(`Fetching ${region} exports...`)
  const [servants, items, exportedWars] = await Promise.all([
    // The lore export is nice_servant plus profile data, which holds costume names.
    fetchJson(EXPORT_URL("nice_servant_lore"), { timeoutMs: 180000 }),
    fetchJson(EXPORT_URL("nice_item"), { timeoutMs: 60000 }),
    fetchJson(EXPORT_URL("nice_war"), { timeoutMs: 120000 }),
  ])
  const wars = translateWars ? await fetchTranslatedWars(exportedWars, warUrl) : exportedWars

  const freeQuestJobs = selectFreeQuestJobs(wars)
  const jobs = [...new Map([...freeQuestJobs, ...selectQuestPhaseJobs(wars)].map((job) => [
    `${job.questId}/${job.phase}`, job,
  ])).values()].sort((a, b) => a.questId - b.questId || a.phase - b.phase)
  console.log(`Fetching ${jobs.length} quest phases (concurrency ${QUEST_CONCURRENCY})...`)
  let completed = 0
  const { results: questResults, failed: failedIndexes } = await mapWithRetryPass(jobs, QUEST_CONCURRENCY, async (job) => {
    // A phase Atlas doesn't have (404) is a stable answer, not a failure: it just has no drops.
    const detail = await fetchJson(QUEST_PHASE_URL(job.questId, job.phase), { timeoutMs: 60000 }).catch((error) => {
      if (error.status === 404) return null
      throw error
    })
    completed += 1
    if (completed % 200 === 0) console.log(`  ${completed}/${jobs.length}`)
    return { job, detail }
  })
  for (const index of failedIndexes) {
    const { questId, phase } = jobs[index]
    console.error(`  failed after retry: quest ${questId} phase ${phase}`)
  }
  const failed = failedIndexes.length
  if (failed) throw new Error(`${failed} quest phase fetches failed after retries; existing data kept`)

  const dropServantIds = [...new Set(questResults.flatMap(({ detail }) =>
    (detail?.drops ?? []).filter((drop) => drop.type === "servant").map((drop) => drop.objectId)
  ))].sort((a, b) => a - b)
  const dropServants = await mapWithRetryPass(dropServantIds, QUEST_CONCURRENCY, (id) =>
    fetchJson(basicServantUrl(id))
  )
  if (dropServants.failed.length) throw new Error("Drop servant metadata fetch failed; existing data kept")
  const dropItems = [...items, ...dropServants.results.map((svt) => ({
    id: svt.id, name: `${svt.name} (${svt.className})`, icon: svt.face,
  }))]

  const effectNames = effectNamesUrl ? buildEffectNameMaps(await fetchJson(effectNamesUrl, { timeoutMs: 180000 })) : undefined
  const servantsIndex = buildServantsIndex(servants, effectNames)
  const indexedIds = new Set(servantsIndex.map((s) => s.id))
  const servantDetails = new Map(
    servants
      .filter((servant) => indexedIds.has(servant.id))
      .sort((a, b) => a.id - b.id)
      .map((servant) => [servant.id, trimServantDetail(servant)])
  )
  const materialsIndex = buildMaterialsIndex(items)
  const farming = buildFarmingIndex(
    aggregateDrops(questResults.filter(Boolean)),
    materialsIndex.map((m) => m.id),
    buildQuestMeta(wars)
  )
  const itemFiles = buildItemFiles(farming, buildItemUsage(servantDetails), materialsIndex.map((m) => m.id))

  const dataset = {
    servantsIndex,
    servantDetails,
    materialsIndex,
    items: itemFiles,
    freeQuests: buildFreeQuestData(freeQuestJobs, questResults, dropItems),
    questFetch: { total: jobs.length, failed },
  }

  const errors = validateDataset(dataset, await readPreviousStats(OUT_DIR))
  if (errors.length) {
    throw new Error(`Dataset validation failed:\n  - ${errors.join("\n  - ")}`)
  }

  await writeDataset(OUT_DIR, dataset)
  console.log(
    `Wrote ${servantsIndex.length} servants, ${materialsIndex.length} materials, ` +
      `${Object.keys(itemFiles).length} item files (quest failures ${failed}/${jobs.length}) to ${OUT_DIR}`
  )
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
