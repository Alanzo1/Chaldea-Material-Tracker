import { test } from "node:test"
import assert from "node:assert/strict"
import { originalName } from "./names.mjs"
import { buildMaterialsIndex } from "./materials.mjs"
import { buildServantsIndex, trimServantDetail } from "./servants.mjs"
import { selectFreeQuestJobs } from "./quests.mjs"

test("originalName is kept only when it differs from the English name", () => {
  assert.deepEqual(originalName({ name: "Altria Pendragon", originalName: "アルトリア・ペンドラゴン" }), { originalName: "アルトリア・ペンドラゴン" })
  assert.deepEqual(originalName({ name: "Saber", originalName: "Saber" }), {})
  assert.deepEqual(originalName({ name: "Saber" }), {})
  assert.deepEqual(originalName({ name: "Saber", originalName: "  " }), {})
})

test("materials, servants and free quests carry the Japanese name through", () => {
  const item = { id: 6001, name: "Gem of Saber", originalName: "剣の輝石", icon: "x.png", type: "skillLvUp", background: "gold", detail: "", uses: ["skill"] }
  assert.equal(buildMaterialsIndex([item])[0]?.originalName, "剣の輝石")
  assert.equal(buildMaterialsIndex([{ ...item, originalName: item.name }])[0]?.originalName, undefined)

  const servant = {
    id: 100100, name: "Altria Pendragon", originalName: "アルトリア・ペンドラゴン", className: "saber", attribute: "earth",
    rarity: 5, traits: [], extraAssets: { faces: { ascension: { 1: "f.png" } } }, skills: [], classPassive: [], noblePhantasms: [],
  }
  assert.equal(buildServantsIndex([servant])[0].originalName, "アルトリア・ペンドラゴン")
  assert.equal(trimServantDetail(servant).originalName, "アルトリア・ペンドラゴン")

  const wars = [{ id: 100, name: "Fuyuki", spots: [{ id: 1, name: "X-A", originalName: "未確認座標X-A", quests: [
    { id: 93000001, name: "The Residential Ruin", originalName: "屋敷跡", type: "free", phases: [1], afterClear: "repeatLast", consumeType: "ap", consume: 3 },
  ] }] }]
  const [job] = selectFreeQuestJobs(wars)
  assert.equal(job.originalName, "屋敷跡")
  assert.equal(job.spotOriginalName, "未確認座標X-A")
})

test("JP buff and effect labels use the NA English name for the same buff or function id", async () => {
  const { buildEffectNameMaps } = await import("./servants.mjs")
  const skill = (buff, popup, funcId = 11) => ({ name: "S", functions: [
    { funcId, funcType: "addState", funcTargetType: "self", funcTargetTeam: "player", funcPopupText: popup, buffs: [buff] },
  ] })
  const na = [{ skills: [skill({ id: 101, name: "NP Strength Up", type: "upNpdamage" }, "NP Strength Up")], noblePhantasms: [] }]
  const names = buildEffectNameMaps(na)
  assert.equal(names.buff.get(101), "NP Strength Up")
  assert.equal(names.func.get(11), "NP Strength Up")

  const jpServant = {
    id: 1, name: "X", className: "saber", attribute: "earth", rarity: 5, traits: [], extraAssets: { faces: { ascension: { 1: "f" } } },
    skills: [skill({ id: 101, name: "宝具威力アップ", type: "upNpdamage" }, "宝具威力アップ"), skill({ id: 999, name: "新バフ", type: "unknownType" }, "新バフ", 12)],
    noblePhantasms: [],
  }
  const [entry] = buildServantsIndex([jpServant], names)
  assert.ok(entry.buffs.includes("NP Strength Up"), entry.buffs.join())
  assert.ok(!entry.buffs.includes("宝具威力アップ"))
  // A buff NA doesn't have yet keeps its Japanese name.
  assert.ok(entry.buffs.includes("新バフ"))
})

test("a JP-only buff id reuses the English name of another buff with the same Japanese name", async () => {
  const { buildEffectNameMaps } = await import("./servants.mjs")
  const fn = (funcId, buff, popup) => ({ funcId, funcType: "addState", funcTargetType: "self", funcTargetTeam: "player", funcPopupText: popup, buffs: [buff] })
  const names = buildEffectNameMaps([{ skills: [{ name: "S", functions: [fn(21, { id: 201, name: "NP Gain Up", type: "x" }, "NP Gain Up")] }], noblePhantasms: [] }])
  const base = { className: "saber", attribute: "earth", rarity: 5, traits: [], extraAssets: { faces: { ascension: { 1: "f" } } }, noblePhantasms: [] }
  const shared = { ...base, id: 1, name: "A", skills: [{ name: "S", functions: [fn(21, { id: 201, name: "NP獲得アップ", type: "x" }, "NP獲得アップ")] }] }
  const jpOnlyId = { ...base, id: 2, name: "B", skills: [{ name: "S", functions: [fn(99, { id: 777, name: "NP獲得アップ", type: "x" }, "NP獲得アップ")] }] }
  const index = buildServantsIndex([shared, jpOnlyId], names)
  assert.deepEqual(index.find((s) => s.id === 2).buffs, ["NP Gain Up"])
})
