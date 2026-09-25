import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readdir, readFile, mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { readPreviousStats, validateDataset, writeDataset } from "./dataset.mjs"

function dataset({ servants = 400, materials = 200, farmItems = 100, failed = 0 } = {}) {
  const servantsIndex = Array.from({ length: servants }, (_, i) => ({ id: i + 1 }))
  return {
    servantsIndex,
    servantDetails: new Map(servantsIndex.map((s) => [s.id, { id: s.id }])),
    materialsIndex: Array.from({ length: materials }, (_, i) => ({ id: i + 1 })),
    farming: Object.fromEntries(
      Array.from({ length: farmItems }, (_, i) => [String(i + 1), [{ id: 1 }]])
    ),
    questFetch: { total: 1000, failed },
  }
}

test("validateDataset accepts a healthy dataset", () => {
  assert.deepEqual(
    validateDataset(dataset(), { servantCount: 400, materialCount: 200, farmedItemCount: 100 }),
    []
  )
})

const PREVIOUS = { servantCount: 400, materialCount: 200, farmedItemCount: 100 }

test("validateDataset rejects too many quest-phase failures", () => {
  const errors = validateDataset(dataset({ failed: 60 }), null)
  assert.equal(errors.length, 1)
  assert.match(errors[0], /quest phase/)
})

test("validateDataset rejects a servant count drop over 5%", () => {
  const errors = validateDataset(dataset({ servants: 370 }), PREVIOUS)
  assert.match(errors.join("\n"), /servant count/)
})

test("validateDataset rejects a material or farmed-item drop over 5% vs previous run", () => {
  // Above the fixed minimums (100 / 50) but a big drop from the last run: partial outage.
  const errors = validateDataset(
    dataset({ materials: 150, farmItems: 60 }),
    { ...PREVIOUS, materialCount: 500, farmedItemCount: 600 }
  ).join("\n")
  assert.match(errors, /material count dropped/)
  assert.match(errors, /farmed item count dropped/)
})

test("validateDataset rejects index entries without detail", () => {
  const data = dataset()
  data.servantDetails.delete(5)
  assert.match(validateDataset(data, null).join("\n"), /missing detail.*5/)
})

test("writeDataset replaces the directory and removes stale files", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-data-"))
  const outDir = join(root, "data")
  await mkdir(join(outDir, "servants"), { recursive: true })
  await writeFile(join(outDir, "servants", "999.json"), "{}")

  const data = dataset({ servants: 2, materials: 1, farmItems: 1 })
  await writeDataset(outDir, data)

  assert.deepEqual((await readdir(join(outDir, "servants"))).sort(), ["1.json", "2.json"])
  assert.deepEqual(JSON.parse(await readFile(join(outDir, "farming", "1.json"), "utf8")), { nodes: [{ id: 1 }] })
  assert.equal(await readFile(join(outDir, "servants-index.json"), "utf8"), '[{"id":1},{"id":2}]\n')
  assert.deepEqual(await readPreviousStats(outDir), { servantCount: 2, materialCount: 1, farmedItemCount: 1 })
  assert.equal(await readPreviousStats(join(root, "missing")), null)
})
