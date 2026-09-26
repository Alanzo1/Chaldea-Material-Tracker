import { test } from "node:test"
import assert from "node:assert/strict"

import { filterServantsByRoute } from "./servant-filter-route.ts"

const servants = [
  { id: 1, attribute: "Earth", alignments: ["Lawful"], traits: ["Dragon"] },
  { id: 2, attribute: "Sky", alignments: ["Chaotic"], traits: ["Riding"] },
]

test("filterServantsByRoute matches trait, alignment and attribute case-insensitively", () => {
  assert.deepEqual(filterServantsByRoute(servants, "trait", "dragon"), { title: "Trait: dragon", servants: [servants[0]] })
  assert.deepEqual(filterServantsByRoute(servants, "alignment", "Chaotic")?.servants.map((s) => s.id), [2])
  assert.deepEqual(filterServantsByRoute(servants, "attribute", "Sky%20")?.servants, [])
  assert.equal(filterServantsByRoute(servants, "attribute", "earth")?.title, "Attribute: earth")
  assert.equal(filterServantsByRoute(servants, "rarity", "5"), null)
})
