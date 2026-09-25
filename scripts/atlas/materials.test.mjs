import { test } from "node:test"
import assert from "node:assert/strict"

import { buildMaterialsIndex, splitItemDetail } from "./materials.mjs"

const icon = (n) => `https://static.atlasacademy.io/${n}.png`

test("keeps upgrade materials, dedupes, sorts by name, adds metadata", () => {
  const result = buildMaterialsIndex([
    {
      id: 6503,
      name: "Void's Dust",
      icon: icon("a"),
      uses: ["skill"],
      type: "skillLvUp",
      background: "bronze",
      detail: '"Skill Up Material"\nDust left behind\nby the void.',
    },
    { id: 6001, name: "Gem of Saber", icon: icon("b"), uses: ["ascension"], type: "skillLvUp", background: "bronze", detail: "" },
    { id: 6001, name: "Gem of Saber", icon: icon("b"), uses: ["ascension"] },
    { id: 94000001, name: "Event Point", icon: icon("c"), uses: [] },
    { id: 7002, name: "No Icon", icon: "", uses: ["skill"] },
  ])

  assert.deepEqual(result, [
    { id: 6001, name: "Gem of Saber", icon: icon("b"), category: "Material", detail: "", type: "skillLvUp", background: "bronze" },
    {
      id: 6503,
      name: "Void's Dust",
      icon: icon("a"),
      category: "Skill Up Material",
      detail: "Dust left behind by the void.",
      type: "skillLvUp",
      background: "bronze",
    },
  ])
})

test("splitItemDetail separates the quoted category line", () => {
  assert.deepEqual(splitItemDetail('"Skill Up & Ascension Material"\r\nProof of a hero.\nMany possess it.'), {
    category: "Skill Up & Ascension Material",
    detail: "Proof of a hero. Many possess it.",
  })
  assert.deepEqual(splitItemDetail("Plain text only"), { category: "Material", detail: "Plain text only" })
  assert.deepEqual(splitItemDetail(undefined), { category: "Material", detail: "" })
})
