import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"

const MIN_SERVANTS = 300
const MIN_MATERIALS = 100
const MIN_FARMED_ITEMS = 50
const MAX_DROP_VS_PREVIOUS = 0.05

function countFarmedItems(farming) {
  return Object.values(farming).filter((nodes) => nodes.length > 0).length
}

export function validateDataset(dataset, previous) {
  const errors = []
  const current = {
    servantCount: dataset.servantsIndex.length,
    materialCount: dataset.materialsIndex.length,
    farmedItemCount: countFarmedItems(dataset.farming),
  }
  const { total, failed } = dataset.questFetch

  if (current.servantCount < MIN_SERVANTS) errors.push(`servant count ${current.servantCount} < ${MIN_SERVANTS}`)
  if (current.materialCount < MIN_MATERIALS) errors.push(`material count ${current.materialCount} < ${MIN_MATERIALS}`)
  if (current.farmedItemCount < MIN_FARMED_ITEMS) {
    errors.push(`farmed item count ${current.farmedItemCount} < ${MIN_FARMED_ITEMS}`)
  }
  // Failures remaining after the retry pass would silently drop nodes and churn the committed output.
  if (failed > 0) errors.push(`quest phase fetch failures ${failed}/${total} after retry pass`)

  // Fixed minimums miss partial outages (e.g. 600 → 60 farmed items), so also compare to the last run.
  const labels = { servantCount: "servant count", materialCount: "material count", farmedItemCount: "farmed item count" }
  for (const [key, label] of Object.entries(labels)) {
    if (previous && current[key] < previous[key] * (1 - MAX_DROP_VS_PREVIOUS)) {
      errors.push(`${label} dropped from ${previous[key]} to ${current[key]}`)
    }
  }

  const missing = dataset.servantsIndex.filter((s) => !dataset.servantDetails.has(s.id)).map((s) => s.id)
  if (missing.length) errors.push(`missing detail for servants: ${missing.join(", ")}`)

  return errors
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value)}\n`)
}

export async function writeDataset(outDir, dataset) {
  const tmpDir = `${outDir}.tmp`
  await rm(tmpDir, { recursive: true, force: true })
  await mkdir(join(tmpDir, "servants"), { recursive: true })
  await mkdir(join(tmpDir, "farming"), { recursive: true })

  await writeJson(join(tmpDir, "servants-index.json"), dataset.servantsIndex)
  await writeJson(join(tmpDir, "materials-index.json"), dataset.materialsIndex)
  for (const [id, detail] of dataset.servantDetails) {
    await writeJson(join(tmpDir, "servants", `${id}.json`), detail)
  }
  for (const [itemId, nodes] of Object.entries(dataset.farming)) {
    await writeJson(join(tmpDir, "farming", `${itemId}.json`), { nodes })
  }

  await rm(outDir, { recursive: true, force: true })
  await rename(tmpDir, outDir)
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"))
}

export async function readPreviousStats(outDir) {
  try {
    const servants = await readJson(join(outDir, "servants-index.json"))
    const materials = await readJson(join(outDir, "materials-index.json"))
    const farming = {}
    for (const file of await readdir(join(outDir, "farming"))) {
      farming[file] = (await readJson(join(outDir, "farming", file))).nodes ?? []
    }

    return {
      servantCount: servants.length,
      materialCount: materials.length,
      farmedItemCount: countFarmedItems(farming),
    }
  } catch {
    return null
  }
}
