import { test } from "node:test"
import assert from "node:assert/strict"

import { buildServantsIndex, trimServantDetail } from "./servants.mjs"

const FACE = "https://static.atlasacademy.io/NA/Faces/f_1000000.png"

function servant(overrides = {}) {
  return {
    id: 100100,
    name: "Altria Pendragon",
    className: "saber",
    attribute: "earth",
    rarity: 5,
    lvMax: 90,
    traits: [
      { id: 1, name: "alignmentLawful" },
      { id: 2, name: "alignmentGood" },
      { id: 3, name: "dragon" },
      { id: 4, name: "classSaber" },
      { id: 5, name: "servant" },
    ],
    cards: ["1", "2", "2", "3", "3"],
    hpMax: 15150,
    atkMax: 11221,
    extraAssets: {
      faces: { ascension: { "1": FACE } },
      charaGraph: { ascension: { "1": "a1.png" }, costume: { "100130": "c.png" } },
      commands: { ascension: { "1": "cmd.png" } },
    },
    skills: [
      {
        id: 1,
        name: "Charisma B",
        functions: [
          {
            funcType: "addState",
            funcTargetType: "ptAll",
            funcTargetTeam: "playerAndEnemy",
            buffs: [{ name: "ATK Up", type: "upAtk" }],
          },
        ],
      },
    ],
    noblePhantasms: [
      {
        id: 2,
        name: "Excalibur",
        functions: [
          {
            funcType: "addState",
            funcTargetType: "enemyAll",
            funcTargetTeam: "enemy",
            buffs: [{ name: "DEF Down", type: "downDefence" }],
            funcPopupText: "DEF Down",
          },
        ],
      },
    ],
    classPassive: [],
    appendPassive: [],
    ascensionMaterials: { "0": { items: [], qp: 100000 } },
    skillMaterials: {},
    appendSkillMaterials: {},
    costumeMaterials: {},
    ...overrides,
  }
}

test("buildServantsIndex drops servants without a first-ascension face", () => {
  const noFace = servant({ id: 9, extraAssets: { faces: { ascension: {} } } })
  assert.deepEqual(buildServantsIndex([noFace]), [])
})

test("buildServantsIndex produces home page entries", () => {
  const [entry] = buildServantsIndex([servant()])

  assert.equal(entry.id, 100100)
  assert.equal(entry.className, "Saber")
  assert.equal(entry.attribute, "Earth")
  assert.equal(entry.portrait, FACE)
  assert.equal(entry.stars, "★★★★★ (5)")
  assert.deepEqual(entry.alignments, ["Lawful", "Good"])
  assert.deepEqual(entry.traits, ["Dragon"])
  assert.deepEqual(entry.buffs, ["ATK Up"])
  assert.deepEqual(entry.debuffs, ["DEF Down"])
})

test("buildServantsIndex sorts by id regardless of input order", () => {
  const ids = buildServantsIndex([servant({ id: 3 }), servant({ id: 1 }), servant({ id: 2 })]).map((s) => s.id)
  assert.deepEqual(ids, [1, 2, 3])
})

test("trimServantDetail keeps page fields and drops the rest", () => {
  const detail = trimServantDetail(servant())

  assert.equal(detail.portrait, FACE)
  assert.equal(detail.lvMax, undefined)
  assert.equal(detail.extraAssets.commands, undefined)
  assert.deepEqual(detail.extraAssets.charaGraph.costume, { "100130": "c.png" })
  assert.equal(detail.skills[0].name, "Charisma B")
  assert.deepEqual(detail.ascensionMaterials, { "0": { items: [], qp: 100000 } })
})
