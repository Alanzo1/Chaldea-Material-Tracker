import { test } from "node:test"
import assert from "node:assert/strict"

import { EMPTY_QUEST_FILTERS, apBucket, countQuestFilters, filterQuests, sortQuests } from "./quest-filters.ts"

const quest = (questId, extra = {}) => ({
  questId, name: `Quest ${questId}`, spotName: `Spot ${questId}`, warId: 100, warName: "Fuyuki", apCost: 10,
  enemyClasses: [], enemyAttributes: [], enemyTraits: [], drops: [], ...extra,
})

const QUESTS = [
  quest(1, { warId: 100, apCost: 5, enemyClasses: ["saber"], enemyTraits: ["undead"], drops: [{ id: 6503 }] }),
  quest(2, { warId: 200, warName: "Orleans", apCost: 20, enemyClasses: ["archer", "saber"], enemyAttributes: ["earth"], enemyTraits: ["dragon"] }),
  quest(3, { warId: 200, warName: "Orleans", apCost: 40, spotName: "La Charité", enemyTraits: ["dragon", "undead"], drops: [{ id: 7001 }, { id: 6503 }] }),
]
const ids = (list) => list.map((q) => q.questId)

test("apBucket groups AP costs", () => {
  assert.equal(apBucket(5), "≤10")
  assert.equal(apBucket(10), "≤10")
  assert.equal(apBucket(20), "11–20")
  assert.equal(apBucket(40), "31–40")
  assert.equal(apBucket(41), "41+")
  assert.equal(apBucket(null), "Other")
})

test("filterQuests: no filters keeps all; search matches quest, spot or chapter", () => {
  assert.deepEqual(ids(filterQuests(QUESTS, EMPTY_QUEST_FILTERS, "")), [1, 2, 3])
  assert.deepEqual(ids(filterQuests(QUESTS, EMPTY_QUEST_FILTERS, "charité")), [3])
  assert.deepEqual(ids(filterQuests(QUESTS, EMPTY_QUEST_FILTERS, "orleans")), [2, 3])
})

test("filterQuests: any value within a group, all groups together", () => {
  assert.deepEqual(ids(filterQuests(QUESTS, { ...EMPTY_QUEST_FILTERS, enemyTraits: ["undead", "dragon"] }, "")), [1, 2, 3])
  assert.deepEqual(ids(filterQuests(QUESTS, { ...EMPTY_QUEST_FILTERS, enemyTraits: ["dragon"], chapters: [200], apBuckets: ["31–40"] }, "")), [3])
  assert.deepEqual(ids(filterQuests(QUESTS, { ...EMPTY_QUEST_FILTERS, enemyClasses: ["saber"] }, "")), [1, 2])
  assert.deepEqual(ids(filterQuests(QUESTS, { ...EMPTY_QUEST_FILTERS, enemyAttributes: ["earth"] }, "")), [2])
  assert.deepEqual(ids(filterQuests(QUESTS, { ...EMPTY_QUEST_FILTERS, drops: [7001] }, "")), [3])
})

test("sortQuests: default keeps input order, ap ascending, name alphabetical; no mutation", () => {
  const input = [QUESTS[2], QUESTS[0], QUESTS[1]]
  assert.deepEqual(ids(sortQuests(input, "default")), [3, 1, 2])
  assert.deepEqual(ids(sortQuests(input, "ap")), [1, 2, 3])
  assert.deepEqual(ids(sortQuests(input, "name")), [3, 1, 2])
  assert.deepEqual(ids(input), [3, 1, 2])
})

test("countQuestFilters counts every selected value", () => {
  assert.equal(countQuestFilters(EMPTY_QUEST_FILTERS), 0)
  assert.equal(countQuestFilters({ ...EMPTY_QUEST_FILTERS, chapters: [1, 2], drops: [3] }), 3)
})
