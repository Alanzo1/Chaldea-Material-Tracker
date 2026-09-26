import { test } from "node:test"
import assert from "node:assert/strict"

import { flattenSearchResults, searchAll } from "./global-search.ts"

const servants = [
  { id: 1, name: "Altria Pendragon", className: "Saber" },
  { id: 2, name: "Gawain", className: "Saber" },
  { id: 3, name: "Dragon Knight", className: "Rider" },
]
const materials = [
  { id: 6512, name: "Dragon Fang", category: "Skill Up & Ascension Material" },
  { id: 6503, name: "Proof of Hero", category: "Skill Up & Ascension Material" },
  { id: 6999, name: "Crystallized Lore", category: "Skill Up Material" },
]
const quests = [
  { questId: 10, name: "Dragon's Den", spotName: "Mt. Etna", warName: "Septem" },
  { questId: 11, name: "Blazing Forest", spotName: "Dragon Valley", warName: "Orleans" },
  { questId: 12, name: "Town of Blades", spotName: "Thiers", warName: "Orleans" },
]
const data = { servants, materials, quests }

test("searchAll ranks each group and returns them servant → material → quest", () => {
  const result = searchAll(data, "dragon")
  assert.deepEqual(result.servants.map((s) => s.id), [3, 1]) // "Dragon Knight" prefix before "…Pendragon" substring
  assert.deepEqual(result.materials.map((m) => m.id), [6512])
  // Location name or quest name can match; a prefix match on either counts as a prefix.
  assert.deepEqual(result.quests.map((q) => q.questId), [11, 10])
})

test("searchAll matches secondary text (class, category, chapter) last and respects limits", () => {
  const result = searchAll(data, "orleans", { servants: 6, materials: 4, quests: 1 })
  assert.deepEqual(result.quests.map((q) => q.questId), [11])
  assert.deepEqual(searchAll(data, "saber").servants.map((s) => s.id), [1, 2])
  assert.deepEqual(searchAll(data, "ascension").materials.map((m) => m.id), [6512, 6503])
})

test("searchAll returns nothing for a blank query", () => {
  assert.deepEqual(searchAll(data, "   "), { servants: [], materials: [], quests: [] })
})

test("flattenSearchResults keeps servant → material → quest order with kind tags", () => {
  const flat = flattenSearchResults(searchAll(data, "dragon"))
  assert.deepEqual(flat.map((entry) => `${entry.kind}:${entry.key}`), [
    "servant:3", "servant:1", "material:6512", "quest:11", "quest:10",
  ])
})
