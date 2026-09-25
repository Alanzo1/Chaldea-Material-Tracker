import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"

const MIN_SERVANTS = 300
const MIN_MATERIALS = 100
const MIN_FARMED_ITEMS = 50
const MIN_USED_ITEMS = 50
const MAX_DROP_VS_PREVIOUS = 0.05

function countItems(items, key) {
  return Object.values(items).filter((file) => (file?.[key] ?? []).length > 0).length
}

function stats(dataset) {
  return {
    servantCount: dataset.servantsIndex.length,
    materialCount: dataset.materialsIndex.length,
    farmedItemCount: countItems(dataset.items, "nodes"),
    usedItemCount: countItems(dataset.items, "usage"),
  }
}

export function validateDataset(dataset, previous) {
  const errors = []
  const current = stats(dataset)
  const { total, failed } = dataset.questFetch

  if (current.servantCount < MIN_SERVANTS) errors.push(`servant count ${current.servantCount} < ${MIN_SERVANTS}`)
  if (current.materialCount < MIN_MATERIALS) errors.push(`material count ${current.materialCount} < ${MIN_MATERIALS}`)
  if (current.farmedItemCount < MIN_FARMED_ITEMS) {
    errors.push(`farmed item count ${current.farmedItemCount} < ${MIN_FARMED_ITEMS}`)
  }
  if (current.usedItemCount < MIN_USED_ITEMS) {
    errors.push(`used item count ${current.usedItemCount} < ${MIN_USED_ITEMS}`)
  }
  // Failures remaining after the retry pass would silently drop nodes and churn the committed output.
  if (failed > 0) errors.push(`quest phase fetch failures ${failed}/${total} after retry pass`)

  // Fixed minimums miss partial outages (e.g. 600 → 60 farmed items), so also compare to the last run.
  const labels = {
    servantCount: "servant count",
    materialCount: "material count",
    farmedItemCount: "farmed item count",
    usedItemCount: "used item count",
  }
  for (const [key, label] of Object.entries(labels)) {
    if (previous?.[key] !== undefined && current[key] < previous[key] * (1 - MAX_DROP_VS_PREVIOUS)) {
      errors.push(`${label} dropped from ${previous[key]} to ${current[key]}`)
    }
  }

  const missing = dataset.servantsIndex.filter((s) => !dataset.servantDetails.has(s.id)).map((s) => s.id)
  if (missing.length) errors.push(`missing detail for servants: ${missing.join(", ")}`)

  const missingItems = dataset.materialsIndex.filter((m) => !dataset.items[String(m.id)]).map((m) => m.id)
  if (missingItems.length) errors.push(`missing item file for materials: ${missingItems.join(", ")}`)

  return errors
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value)}\n`)
}

export async function writeDataset(outDir, dataset) {
  const tmpDir = `${outDir}.tmp`
  await rm(tmpDir, { recursive: true, force: true })
  await mkdir(join(tmpDir, "servants"), { recursive: true })
  await mkdir(join(tmpDir, "items"), { recursive: true })

  await writeJson(join(tmpDir, "servants-index.json"), dataset.servantsIndex)
  await writeJson(join(tmpDir, "materials-index.json"), dataset.materialsIndex)
  for (const [id, detail] of dataset.servantDetails) {
    await writeJson(join(tmpDir, "servants", `${id}.json`), detail)
  }
  for (const [itemId, file] of Object.entries(dataset.items)) {
    await writeJson(join(tmpDir, "items", `${itemId}.json`), { nodes: file.nodes, usage: file.usage })
  }

  await rm(outDir, { recursive: true, force: true })
  await rename(tmpDir, outDir)
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"))
}

// Returns null when there is no previous output (fresh checkout, or the first run after
// the farming/ → items/ layout change); validation then skips the vs-previous comparison.
export async function readPreviousStats(outDir) {
  try {
    const servantsIndex = await readJson(join(outDir, "servants-index.json"))
    const materialsIndex = await readJson(join(outDir, "materials-index.json"))
    const items = {}
    for (const file of await readdir(join(outDir, "items"))) {
      items[file] = await readJson(join(outDir, "items", file))
    }
    return stats({ servantsIndex, materialsIndex, items })
  } catch {
    return null
  }
}
