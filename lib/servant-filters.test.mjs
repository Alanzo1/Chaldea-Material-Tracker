import { test } from "node:test"
import assert from "node:assert/strict"

import { EMPTY_FILTERS, countActiveFilters, filterServants, sortServants } from "./servant-filters.ts"

const SERVANTS = [
  {
    id: 300,
    name: "Cu Chulainn",
    className: "Lancer",
    attribute: "Sky",
    rarity: 3,
    buffs: ["Evade"],
    debuffs: [],
    traits: ["Humanoid"],
    alignments: ["Lawful", "Balanced"],
  },
  {
    id: 100,
    name: "Altria Pendragon",
    className: "Saber",
    attribute: "Earth",
    rarity: 5,
    buffs: ["Buster Up", "NP Charge"],
    debuffs: [],
    traits: ["Dragon", "Humanoid"],
    alignments: ["Lawful", "Good"],
  },
  {
    id: 200,
    name: "EMIYA",
    className: "Archer",
    attribute: "Earth",
    rarity: 4,
    buffs: ["Arts Up"],
    debuffs: ["Defense Down"],
    traits: ["Humanoid"],
    alignments: ["Neutral", "Balanced"],
  },
]

const NO_CONTEXT = { query: "", favoriteIds: [], trackedIds: [] }
const ids = (servants) => servants.map((servant) => servant.id)

test("no filters keeps every servant", () => {
  assert.deepEqual(ids(filterServants(SERVANTS, EMPTY_FILTERS, NO_CONTEXT)), [300, 100, 200])
})

test("search matches name or class, case-insensitive", () => {
  assert.deepEqual(ids(filterServants(SERVANTS, EMPTY_FILTERS, { ...NO_CONTEXT, query: "emi" })), [200])
  assert.deepEqual(ids(filterServants(SERVANTS, EMPTY_FILTERS, { ...NO_CONTEXT, query: "SABER" })), [100])
})

test("values within one group match any", () => {
  const filters = { ...EMPTY_FILTERS, classes: ["saber", "archer"] }
  assert.deepEqual(ids(filterServants(SERVANTS, filters, NO_CONTEXT)), [100, 200])
})

test("groups combine with all", () => {
  const filters = { ...EMPTY_FILTERS, attributes: ["Earth"], rarities: [4] }
  assert.deepEqual(ids(filterServants(SERVANTS, filters, NO_CONTEXT)), [200])
})

test("list groups (buffs, debuffs, traits, alignments) match any selected value", () => {
  assert.deepEqual(ids(filterServants(SERVANTS, { ...EMPTY_FILTERS, buffs: ["np charge", "Evade"] }, NO_CONTEXT)), [300, 100])
  assert.deepEqual(ids(filterServants(SERVANTS, { ...EMPTY_FILTERS, debuffs: ["Defense Down"] }, NO_CONTEXT)), [200])
  assert.deepEqual(ids(filterServants(SERVANTS, { ...EMPTY_FILTERS, traits: ["Dragon"] }, NO_CONTEXT)), [100])
  assert.deepEqual(ids(filterServants(SERVANTS, { ...EMPTY_FILTERS, alignments: ["Good"] }, NO_CONTEXT)), [100])
})

test("collection filters use favorite and tracked ids", () => {
  const context = { ...NO_CONTEXT, favoriteIds: [100], trackedIds: [300] }
  assert.deepEqual(ids(filterServants(SERVANTS, { ...EMPTY_FILTERS, collection: ["favorites"] }, context)), [100])
  assert.deepEqual(ids(filterServants(SERVANTS, { ...EMPTY_FILTERS, collection: ["favorites", "tracked"] }, context)), [300, 100])
})

test("sort orders", () => {
  assert.deepEqual(ids(sortServants(SERVANTS, "default")), [100, 200, 300])
  assert.deepEqual(ids(sortServants(SERVANTS, "name")), [100, 300, 200])
  assert.deepEqual(ids(sortServants(SERVANTS, "rarity")), [100, 200, 300])
  assert.deepEqual(ids(sortServants(SERVANTS, "class")), [100, 200, 300])
})

test("sort does not mutate input", () => {
  const input = [...SERVANTS]
  sortServants(input, "name")
  assert.deepEqual(ids(input), [300, 100, 200])
})

test("countActiveFilters counts every selected value", () => {
  assert.equal(countActiveFilters(EMPTY_FILTERS), 0)
  assert.equal(countActiveFilters({ ...EMPTY_FILTERS, classes: ["saber"], rarities: [4, 5], collection: ["tracked"] }), 4)
})
