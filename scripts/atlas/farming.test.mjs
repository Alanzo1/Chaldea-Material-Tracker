import { test } from "node:test"
import assert from "node:assert/strict"

import {
  aggregateDrops,
  buildFarmingIndex,
  buildQuestMeta,
  selectQuestPhaseJobs,
} from "./farming.mjs"

const WARS = [
  {
    name: "Fuyuki",
    longName: "Singularity F: Fuyuki",
    spots: [
      {
        name: "Bridge",
        quests: [
          { id: 20, type: "free", consume: 10, phases: [1, 3], name: "Giant Bridge" },
          { id: 10, type: "free", consume: 10, phases: [3], name: "Port" },
          { id: 11, type: "main", consume: 10, phases: [1], name: "Story" },
          { id: 12, type: "free", consume: 0, phases: [1], name: "Free AP" },
          { id: 13, type: "event", consume: 20, phases: [1], name: "Event" },
        ],
      },
    ],
  },
  {
    name: "Chaldea Gate",
    longName: "Chaldea Gate",
    spots: [{ name: "Gate", quests: [{ id: 30, type: "warBoard", consume: 40, phases: [1], name: "Gate Quest" }] }],
  },
]

function job(questId, phase = 1) {
  return { questId, phase, warName: "War", locationName: "Loc", questTitle: `Q${questId}` }
}

function detail(id, consume, drops) {
  return { id, consume, drops }
}

test("selectQuestPhaseJobs keeps free/daily/Chaldea Gate quests, sorted by quest then phase", () => {
  const jobs = selectQuestPhaseJobs(WARS)
  assert.deepEqual(
    jobs.map((j) => [j.questId, j.phase]),
    [[10, 3], [20, 1], [20, 3], [30, 1]]
  )
  assert.equal(jobs[0].warName, "Singularity F: Fuyuki")
  assert.equal(jobs[0].locationName, "Bridge")
})

test("aggregateDrops computes AP per drop and skips invalid rows", () => {
  const drops = aggregateDrops([
    { job: job(1), detail: detail(1, 10, [{ objectId: 6503, runs: 100, dropNum: 50 }]) },
    { job: job(2), detail: detail(2, 10, [{ objectId: 6503, runs: 0, dropNum: 5 }]) },
    { job: job(3), detail: null },
  ])

  assert.deepEqual([...drops.keys()], [6503])
  const [node] = drops.get(6503)
  assert.equal(node.apPerDrop, 20)
  assert.equal(node.dropRate, 0.5)
  assert.equal(node.questName, "Loc - Q1")
})

test("aggregateDrops output does not depend on fetch completion order", () => {
  const results = [
    { job: job(5), detail: detail(5, 10, [{ objectId: 1, runs: 100, dropNum: 50 }]) },
    { job: job(4), detail: detail(4, 10, [{ objectId: 1, runs: 100, dropNum: 50 }]) },
    { job: job(6), detail: detail(6, 10, [{ objectId: 1, runs: 100, dropNum: 25 }]) },
  ]
  const forward = JSON.stringify([...aggregateDrops(results)])
  const reversed = JSON.stringify([...aggregateDrops([...results].reverse())])

  assert.equal(forward, reversed)
  assert.deepEqual(aggregateDrops(results).get(1).map((n) => n.id), [4, 5, 6])
})

test("aggregateDrops keeps the better phase of the same quest", () => {
  const drops = aggregateDrops([
    { job: job(7, 1), detail: detail(7, 10, [{ objectId: 1, runs: 100, dropNum: 10 }]) },
    { job: job(7, 3), detail: detail(7, 10, [{ objectId: 1, runs: 100, dropNum: 50 }]) },
  ])
  assert.equal(drops.get(1).length, 1)
  assert.equal(drops.get(1)[0].apPerDrop, 20)
})

test("buildFarmingIndex pins Saber training grounds first for Gem of Saber", () => {
  const drops = new Map([
    [6001, [{ id: 99, questName: "A - B", apCost: 10, dropRate: 1, apPerDrop: 10, runs: 500 }]],
  ])
  const index = buildFarmingIndex(drops, [6001], new Map())
  const names = index["6001"].map((n) => n.questName)

  assert.equal(names.length, 5)
  assert.ok(names[0].startsWith("Saber Training Ground"))
  assert.equal(names[4], "A - B")
})

test("buildFarmingIndex filters low-sample nodes, caps at 6, emits empty lists", () => {
  const many = Array.from({ length: 10 }, (_, i) => ({
    id: 100 + i,
    questName: `Loc - Q${i}`,
    apCost: 10,
    dropRate: 1 / (i + 1),
    apPerDrop: 10 * (i + 1),
    runs: i === 0 ? 50 : 500,
  }))
  const index = buildFarmingIndex(new Map([[6503, many]]), [6503, 6999, 1234], new Map())

  assert.equal(index["6503"].length, 6)
  assert.equal(index["6503"][0].id, 101)
  assert.deepEqual(index["6999"], [])
  assert.deepEqual(index["1234"], [])
})

test("buildFarmingIndex fills missing labels from quest meta and drops dash-only labels", () => {
  const drops = new Map([
    [6503, [{ id: 20, questName: "—", apCost: 10, dropRate: 1, apPerDrop: 10, runs: 500, locationName: "—" }]],
  ])
  const [node] = buildFarmingIndex(drops, [], buildQuestMeta(WARS))["6503"]

  assert.equal(node.locationName, "Bridge")
  assert.equal(node.questTitle, "Giant Bridge")
  assert.equal(node.warName, "Fuyuki")
})
