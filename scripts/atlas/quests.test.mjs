import { test } from "node:test"
import assert from "node:assert/strict"
import { buildFreeQuestData, selectFreeQuestJobs, summarizeQuestPhase, trimFreeQuestPhase } from "./quests.mjs"

const wars = [{ id: 1, name: "Fuyuki", spots: [{ id: 2, name: "Bridge", image: "spot_010002.png", quests: [
  { id: 10, name: "Free quest", type: "free", consumeType: "ap", consume: 5, phases: [2, 1] },
  { id: 11, type: "daily", phases: [1] },
  { id: 12, type: "main", phases: [1] },
  { id: 13, type: "free", consumeType: "ap", consume: 0, phases: [1] },
] }] }]

test("free quest selection excludes other quest types, sorts phases, and includes zero AP", () => {
  const jobs = selectFreeQuestJobs([...wars, ...wars])
  assert.deepEqual(jobs.map(({ questId, phase }) => [questId, phase]), [[10, 1], [10, 2], [13, 1]])
  assert.equal(jobs[0].spotName, "Bridge")
  assert.equal(jobs[0].spotImage, "spot_010002.png")
  assert.equal(jobs[2].apCost, 0)
})

test("stage trimming preserves enemy positions and stats without bulky skill/AI data", () => {
  const detail = { bond: 100, exp: 200, stages: [{ wave: 1, enemies: [
    { name: "Skeleton", hp: 1234, atk: 55, lv: 10, deck: "enemy", deckId: 1,
      svt: { id: 42, className: "saber", face: "icon.png", traits: [{ id: 1, name: "undead" }] },
      traits: [{ id: 1, name: "undead" }, { id: 2, name: "male" }], skills: [{ large: true }] },
    { name: "Reserve", deck: "enemy2", deckId: 1 },
  ] }] }
  const file = trimFreeQuestPhase(selectFreeQuestJobs(wars)[0], detail)
  assert.equal(file.enemyDataAvailable, true)
  assert.equal(file.stages[0].enemies[0].hp, 1234)
  assert.equal(file.stages[0].enemies[0].className, "saber")
  assert.equal(file.stages[0].enemies[0].traits.length, 2)
  assert.equal(file.stages[0].enemies[1].deck, "enemy2")
  assert.equal(file.stages[0].enemies[1].hp, null)
  assert.equal(file.stages[0].enemies[0].skills, undefined)
})

test("missing enemy data and 404 phases remain explicit, and phases never overwrite each other", () => {
  const jobs = selectFreeQuestJobs(wars).slice(0, 2)
  const data = buildFreeQuestData(jobs, [
    { job: jobs[1], detail: null },
    { job: jobs[0], detail: { stages: [] } },
  ])
  assert.equal(data.phases["10/1"].status, "available")
  assert.equal(data.phases["10/1"].enemyDataAvailable, false)
  assert.equal(data.phases["10/2"].status, "unavailable")
  assert.deepEqual(data.phases["10/2"].stages, [])
  assert.throws(() => buildFreeQuestData(jobs, []), /Missing free quest fetch result/)
})

test("only the last phase of a repeatLast quest is marked repeatable", () => {
  const input = [{ id: 1, spots: [{ id: 2, quests: [
    { id: 1, type: "free", afterClear: "repeatLast", phases: [3, 1, 2] },
    { id: 2, type: "free", afterClear: "close", phases: [1] },
  ] }] }]
  assert.deepEqual(selectFreeQuestJobs(input).filter(q => q.repeatable).map(q => [q.questId, q.phase]), [[1, 3]])
})

test("drop statistics use observed samples and stack quantity, including zero and missing samples", () => {
  const job = { questId: 1, phase: 3, apCost: 20 }
  const file = trimFreeQuestPhase(job, { drops: [
    { objectId: 1, type: "item", runs: 100, dropCount: 50, num: 3 },
    { objectId: 2, type: "item", runs: 0, dropCount: 0, num: 1 },
    { objectId: 3, type: "item", runs: 100, dropCount: 0, num: 1 },
  ] }, [{ id: 1, name: "QP", icon: "qp.png" }])
  assert.equal(file.drops[0].perRun, 1.5)
  assert.equal(file.drops[0].apPerItem, 20 / 1.5)
  assert.equal(file.drops[0].name, "QP")
  assert.equal(file.drops[1].perRun, null)
  assert.equal(file.drops[2].perRun, 0)
  assert.equal(file.drops[2].apPerItem, null)
})

test("free quest jobs fall back to a null spot image when Atlas has none", () => {
  const [job] = selectFreeQuestJobs([{ id: 1, spots: [{ id: 3, name: "Russian Area", quests: [
    { id: 20, type: "free", consumeType: "ap", consume: 1, phases: [1] },
  ] }] }])
  assert.equal(job.spotImage, null)
})

test("summarizeQuestPhase lists enemy classes, attributes, non-class traits and drops for filtering", () => {
  const summary = summarizeQuestPhase({
    stages: [
      { wave: 1, enemies: [
        { className: "saber", attribute: "human", traits: [{ id: 100, name: "classSaber" }, { id: 202, name: "attributeHuman" }, { id: 1002, name: "undead" }] },
        { className: "saber", attribute: "human", traits: [{ id: 1002, name: "undead" }] },
      ] },
      { wave: 2, enemies: [{ className: "archer", attribute: "earth", traits: [{ id: 2001, name: "dragon" }, { id: 1, name: "genderMale" }] }] },
    ],
    drops: [
      { id: 6503, name: "Proof of Hero", icon: "p.png", perRun: 0.5 },
      { id: 7001, name: "Saber Piece", icon: "s.png", perRun: 0.1 },
    ],
  })

  assert.deepEqual(summary, {
    enemyClasses: ["archer", "saber"],
    enemyAttributes: ["earth", "human"],
    enemyTraits: ["dragon", "genderMale", "undead"],
    drops: [
      { id: 6503, name: "Proof of Hero", icon: "p.png" },
      { id: 7001, name: "Saber Piece", icon: "s.png" },
    ],
  })
})

test("buildFreeQuestData puts the filter summary on index entries", () => {
  const jobs = selectFreeQuestJobs(wars)
  const data = buildFreeQuestData(jobs, [
    { job: jobs[0], detail: { stages: [{ wave: 1, enemies: [{ svt: { className: "lancer", attribute: "sky", traits: [{ id: 5, name: "dragon" }] } }] }] } },
    { job: jobs[1], detail: null },
    { job: jobs[2], detail: null },
  ])
  assert.deepEqual(data.index[0].enemyClasses, ["lancer"])
  assert.deepEqual(data.index[0].enemyTraits, ["dragon"])
  assert.deepEqual(data.index[1].drops, [])
})
