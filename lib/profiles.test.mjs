import { test } from "node:test"
import assert from "node:assert/strict"

import {
  GUEST_PROFILES_KEY,
  MAX_PROFILES,
  ProfileError,
  createProfile,
  deleteProfile,
  guestProgressKey,
  loadGuestProfiles,
  normalizeProfileName,
  planImport,
  renameProfile,
  saveGuestProfiles,
} from "./profiles.ts"

const memoryStore = (entries = {}) => {
  const map = new Map(Object.entries(entries))
  return { map, get: (key) => map.get(key) ?? null, set: (key, value) => map.set(key, value) }
}
const ids = (...values) => () => values.shift()
const list = (...names) => names.map((name, index) => ({ id: `p${index + 1}`, name }))

test("normalizeProfileName trims and enforces 1-40 characters", () => {
  assert.equal(normalizeProfileName("  JP alt  "), "JP alt")
  assert.equal(normalizeProfileName("x".repeat(40)), "x".repeat(40))
  assert.throws(() => normalizeProfileName("   "), ProfileError)
  assert.throws(() => normalizeProfileName("x".repeat(41)), ProfileError)
})

test("createProfile appends, rejects case-insensitive duplicates, and caps at 10", () => {
  assert.deepEqual(createProfile(list("Main"), " JP alt ", "new"), [...list("Main"), { id: "new", name: "JP alt" }])
  assert.throws(() => createProfile(list("Main"), "main", "new"), /already/)
  const full = Array.from({ length: MAX_PROFILES }, (_, i) => ({ id: `p${i}`, name: `Alt ${i}` }))
  assert.throws(() => createProfile(full, "One more", "new"), /10 profiles/)
})

test("renameProfile renames in place and allows keeping the same name with new casing", () => {
  assert.deepEqual(renameProfile(list("Main", "Alt"), "p2", "JP"), list("Main", "JP"))
  assert.deepEqual(renameProfile(list("Main", "Alt"), "p2", "ALT"), list("Main", "ALT"))
  assert.throws(() => renameProfile(list("Main", "Alt"), "p2", "main"), /already/)
  assert.throws(() => renameProfile(list("Main"), "missing", "X"), ProfileError)
})

test("deleteProfile picks the previous profile, else the first, and never deletes the last", () => {
  assert.deepEqual(deleteProfile(list("A", "B", "C"), "p2"), { profiles: [list("A", "B", "C")[0], list("A", "B", "C")[2]], nextActive: "p1" })
  assert.deepEqual(deleteProfile(list("A", "B"), "p1").nextActive, "p2")
  assert.throws(() => deleteProfile(list("A"), "p1"), /last profile/)
})

test("loadGuestProfiles moves the legacy guest save into Main once", () => {
  const legacy = { version: 1, servants: [{ servantId: 1 }], ownedByMaterialId: { 10: 3 } }
  const store = memoryStore({ trackedMaterialsStateV1: JSON.stringify(legacy), trackerCurrentQp: "500" })
  const loaded = loadGuestProfiles(store, ids("main-id"))
  assert.deepEqual(loaded, { version: 1, active: "main-id", profiles: [{ id: "main-id", name: "Main" }] })
  assert.deepEqual(JSON.parse(store.get(guestProgressKey("main-id"))), { ...legacy, qp: 500 })
  assert.equal(store.get("trackedMaterialsStateV1"), JSON.stringify(legacy), "legacy save kept as a backup")
  // A second load reuses the saved list instead of migrating again.
  assert.deepEqual(loadGuestProfiles(store, ids("other")), loaded)
})

test("loadGuestProfiles starts an empty Main without a legacy save and repairs a bad active id", () => {
  const store = memoryStore()
  assert.equal(loadGuestProfiles(store, ids("m")).profiles[0].name, "Main")
  assert.equal(store.get(guestProgressKey("m")), null)
  saveGuestProfiles(store, { version: 1, active: "gone", profiles: list("A", "B") })
  assert.equal(loadGuestProfiles(store, ids("x")).active, "p1")
  store.set(GUEST_PROFILES_KEY, "{not json")
  assert.equal(loadGuestProfiles(store, ids("fresh")).active, "fresh")
})

test("planImport skips empty profiles, renames clashes, and stops at the cap", () => {
  const guest = [
    { id: "g1", name: "Main", hasProgress: true },
    { id: "g2", name: "Empty", hasProgress: false },
    { id: "g3", name: "JP", hasProgress: true },
    { id: "g4", name: "CN", hasProgress: true },
  ]
  const plan = planImport(guest, [...list("Main"), ...Array.from({ length: 7 }, (_, i) => ({ id: `c${i}`, name: `C${i}` }))])
  assert.deepEqual(plan.add, [{ id: "g1", name: "Main (device)" }, { id: "g3", name: "JP" }])
  assert.deepEqual(plan.skippedEmpty.map((p) => p.id), ["g2"])
  assert.deepEqual(plan.skippedOverCap.map((p) => p.id), ["g4"])
})
