import { test } from "node:test"
import assert from "node:assert/strict"

import { dataBase, parseSitePath, regionFromPath, regionHref, switchRegionPath } from "./region.ts"

test("regionFromPath and dataBase", () => {
  assert.equal(regionFromPath("/jp"), "JP")
  assert.equal(regionFromPath("/jp/servants/100100"), "JP")
  assert.equal(regionFromPath("/jpx"), "NA")
  assert.equal(regionFromPath("/servants"), "NA")
  assert.equal(dataBase("NA"), "/data")
  assert.equal(dataBase("JP"), "/data-jp")
})

test("parseSitePath understands both regions' routes", () => {
  assert.deepEqual(parseSitePath("/servantpage/100100"), { region: "NA", section: "servants", id: "100100" })
  assert.deepEqual(parseSitePath("/jp/servants/100100"), { region: "JP", section: "servants", id: "100100" })
  assert.deepEqual(parseSitePath("/material/6001"), { region: "NA", section: "items", id: "6001" })
  assert.deepEqual(parseSitePath("/jp/items"), { region: "JP", section: "items", id: null })
  assert.deepEqual(parseSitePath("/free-quests/93000001"), { region: "NA", section: "free-quests", id: "93000001" })
  assert.deepEqual(parseSitePath("/jp/track-materials/2"), { region: "JP", section: "track-materials", id: "2" })
  assert.deepEqual(parseSitePath("/account"), { region: "NA", section: null, id: null })
  assert.deepEqual(parseSitePath("/jp"), { region: "JP", section: null, id: null })
})

test("regionHref maps NA links to the region's routes and keeps query and hash", () => {
  assert.equal(regionHref("NA", "/servantpage/1"), "/servantpage/1")
  assert.equal(regionHref("JP", "/servantpage/1"), "/jp/servants/1")
  assert.equal(regionHref("JP", "/servants"), "/jp/servants")
  assert.equal(regionHref("JP", "/material/6001"), "/jp/items/6001")
  assert.equal(regionHref("JP", "/items?q=gem"), "/jp/items?q=gem")
  assert.equal(regionHref("JP", "/free-quests/93000001#drops"), "/jp/free-quests/93000001#drops")
  assert.equal(regionHref("JP", "/track-materials/5"), "/jp/track-materials/5")
  assert.equal(regionHref("JP", "/filter/attribute/Earth"), "/jp/filter/attribute/Earth")
  assert.equal(regionHref("NA", "/filter/attribute/Earth"), "/filter/attribute/Earth")
  assert.equal(regionHref("JP", "/account"), "/account")
  assert.equal(regionHref("JP", "/"), "/")
})

test("switchRegionPath keeps you on the same page, or falls back to the section list", () => {
  const has = (ids) => (section, id) => ids.includes(`${section}:${id}`)
  assert.equal(switchRegionPath("/servantpage/100100", "JP", has(["servants:100100"])), "/jp/servants/100100")
  assert.equal(switchRegionPath("/jp/servants/900", "NA", has([])), "/servants")
  assert.equal(switchRegionPath("/jp/items/6001", "NA", has(["items:6001"])), "/material/6001")
  assert.equal(switchRegionPath("/free-quests/1", "JP", has([])), "/jp/free-quests")
  assert.equal(switchRegionPath("/track-materials", "JP", has([])), "/jp/track-materials")
  assert.equal(switchRegionPath("/items", "JP", has([])), "/jp/items")
  assert.equal(switchRegionPath("/account", "JP", has([])), "/jp/servants")
  assert.equal(switchRegionPath("/", "JP", has([])), "/jp/servants")
  assert.equal(switchRegionPath("/jp/servants", "NA", has([])), "/servants")
  assert.equal(switchRegionPath("/jp", "NA", has([])), "/")
  // Already in the target region: stay put.
  assert.equal(switchRegionPath("/jp/items/1", "JP", has([])), "/jp/items/1")
})
