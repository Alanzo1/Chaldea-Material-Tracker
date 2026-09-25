import { test } from "node:test"
import assert from "node:assert/strict"

import { buildItemFiles, buildItemUsage } from "./usage.mjs"

const stage = (...pairs) => ({ qp: 1, items: pairs.map(([id, amount]) => ({ item: { id }, amount })) })

test("buildItemUsage multiplies skill/append costs per slot and sorts by total", () => {
  const servants = new Map([
    [
      100,
      {
        skills: [{ num: 1 }, { num: 2 }, { num: 2 }, { num: 3 }], // 3 distinct slots (upgrade variant shares num)
        appendPassive: [{}, {}, {}, {}, {}], // 5 append slots
        ascensionMaterials: { "0": stage([7001, 5]), "1": stage([7001, 10], [6503, 2]) },
        skillMaterials: { "1": stage([6001, 4]), "2": stage([6503, 1]) },
        appendSkillMaterials: { "1": stage([6503, 2]) },
        costumeMaterials: { "100130": stage([6503, 3]) },
      },
    ],
    [
      200,
      {
        skills: [],
        appendPassive: [],
        ascensionMaterials: { "0": stage([6503, 30]) },
        skillMaterials: {},
        appendSkillMaterials: {},
        costumeMaterials: {},
      },
    ],
  ])

  const usage = buildItemUsage(servants)

  assert.deepEqual(usage["7001"], [{ servantId: 100, ascension: 15, skill: 0, append: 0, costume: 0, total: 15 }])
  assert.deepEqual(usage["6001"], [{ servantId: 100, ascension: 0, skill: 12, append: 0, costume: 0, total: 12 }])
  // 6503: servant 100 = asc 2 + skill 1×3 + append 2×5 + costume 3 = 18; servant 200 = 30 → 200 first.
  assert.deepEqual(usage["6503"], [
    { servantId: 200, ascension: 30, skill: 0, append: 0, costume: 0, total: 30 },
    { servantId: 100, ascension: 2, skill: 3, append: 10, costume: 3, total: 18 },
  ])
})

test("buildItemUsage ignores zero/invalid amounts and missing maps", () => {
  const usage = buildItemUsage(
    new Map([[1, { ascensionMaterials: { "0": { items: [{ item: { id: 5 }, amount: 0 }, { item: {}, amount: 3 }] } } }]])
  )
  assert.deepEqual(usage, {})
})

test("buildItemUsage breaks total ties by servant id", () => {
  const detail = { ascensionMaterials: { "0": stage([9, 1]) } }
  const usage = buildItemUsage(new Map([[30, detail], [10, detail], [20, detail]]))
  assert.deepEqual(usage["9"].map((entry) => entry.servantId), [10, 20, 30])
})

test("buildItemFiles covers every index item plus any farmed or used item", () => {
  const files = buildItemFiles(
    { "6503": [{ id: 1 }], "9000": [{ id: 2 }] },
    { "6503": [{ servantId: 1, total: 5 }], "7001": [{ servantId: 2, total: 3 }] },
    [6999, 6503]
  )

  assert.deepEqual(Object.keys(files), ["6503", "6999", "7001", "9000"])
  assert.deepEqual(files["6503"], { nodes: [{ id: 1 }], usage: [{ servantId: 1, total: 5 }] })
  // Review Focus 3: an index item nobody uses or drops still gets an (empty) file.
  assert.deepEqual(files["6999"], { nodes: [], usage: [] })
  assert.deepEqual(files["7001"], { nodes: [], usage: [{ servantId: 2, total: 3 }] })
})
