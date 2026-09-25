import { test } from "node:test"
import assert from "node:assert/strict"

import { buildMaterialsIndex } from "./materials.mjs"

test("keeps upgrade materials, dedupes, sorts by name", () => {
  const result = buildMaterialsIndex([
    { id: 6503, name: "Void's Dust", icon: "https://static.atlasacademy.io/a.png", uses: ["skill"] },
    { id: 6001, name: "Gem of Saber", icon: "https://static.atlasacademy.io/b.png", uses: ["ascension"] },
    { id: 6001, name: "Gem of Saber", icon: "https://static.atlasacademy.io/b.png", uses: ["ascension"] },
    { id: 94000001, name: "Event Point", icon: "https://static.atlasacademy.io/c.png", uses: [] },
    { id: 7002, name: "No Icon", icon: "", uses: ["skill"] },
  ])

  assert.deepEqual(result, [
    { id: 6001, name: "Gem of Saber", icon: "https://static.atlasacademy.io/b.png" },
    { id: 6503, name: "Void's Dust", icon: "https://static.atlasacademy.io/a.png" },
  ])
})
