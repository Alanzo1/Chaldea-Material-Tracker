import { join } from "node:path"

import { readPreviousStats, validateDataset, writeDataset } from "./dataset.mjs"
import { aggregateDrops, buildFarmingIndex, buildQuestMeta, selectQuestPhaseJobs } from "./farming.mjs"
import { fetchJson, mapWithConcurrency } from "./fetch.mjs"
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
    fetchJson(EXPORT_URL("nice_servant"), { timeoutMs: 120000 }),
    fetchJson(EXPORT_URL("nice_item"), { timeoutMs: 60000 }),
    fetchJson(EXPORT_URL("nice_war"), { timeoutMs: 120000 }),
  ])

  const jobs = selectQuestPhaseJobs(wars)
  console.log(`Fetching ${jobs.length} quest phases (concurrency ${QUEST_CONCURRENCY})...`)
  let failed = 0
  let completed = 0
  const questResults = await mapWithConcurrency(jobs, QUEST_CONCURRENCY, async (job) => {
    const detail = await fetchJson(QUEST_PHASE_URL(job.questId, job.phase), { timeoutMs: 60000 }).catch(() => {
      failed += 1
      return null
    })
    completed += 1
    if (completed % 200 === 0) console.log(`  ${completed}/${jobs.length}`)
    return { job, detail }
  })

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
    aggregateDrops(questResults),
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
