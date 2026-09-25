import { join } from "node:path"

import { readPreviousStats, validateDataset, writeDataset } from "./dataset.mjs"
import { aggregateDrops, buildFarmingIndex, buildQuestMeta, selectQuestPhaseJobs } from "./farming.mjs"
import { fetchJson, mapWithRetryPass } from "./fetch.mjs"
import { buildMaterialsIndex } from "./materials.mjs"
import { buildServantsIndex, trimServantDetail } from "./servants.mjs"

const REGION = "NA"
const BASE_URL = "https://api.atlasacademy.io"
const EXPORT_URL = (name) => `${BASE_URL}/export/${REGION}/${name}.json`
const QUEST_PHASE_URL = (questId, phase) => `${BASE_URL}/nice/${REGION}/quest/${questId}/${phase}`
const QUEST_CONCURRENCY = 8
const OUT_DIR = join(process.cwd(), "public", "data")

async function run() {
  console.log("Fetching exports...")
  const [servants, items, wars] = await Promise.all([
    // The lore export is nice_servant plus profile data, which holds costume names.
    fetchJson(EXPORT_URL("nice_servant_lore"), { timeoutMs: 180000 }),
    fetchJson(EXPORT_URL("nice_item"), { timeoutMs: 60000 }),
    fetchJson(EXPORT_URL("nice_war"), { timeoutMs: 120000 }),
  ])

  const jobs = selectQuestPhaseJobs(wars)
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

  const servantsIndex = buildServantsIndex(servants)
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

  const dataset = {
    servantsIndex,
    servantDetails,
    materialsIndex,
    farming,
    questFetch: { total: jobs.length, failed },
  }

  const errors = validateDataset(dataset, await readPreviousStats(OUT_DIR))
  if (errors.length) {
    throw new Error(`Dataset validation failed:\n  - ${errors.join("\n  - ")}`)
  }

  await writeDataset(OUT_DIR, dataset)
  console.log(
    `Wrote ${servantsIndex.length} servants, ${materialsIndex.length} materials, ` +
      `${Object.keys(farming).length} farming files (quest failures ${failed}/${jobs.length}) to ${OUT_DIR}`
  )
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
