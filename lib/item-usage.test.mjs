import { test } from "node:test"
import assert from "node:assert/strict"

import {
  MAX_OWNED_QUANTITY,
  filterUsage,
  formatUsageBreakdown,
  holdReachedLimit,
  holdStepAmount,
  parseOwnedQuantity,
} from "./item-usage.ts"

const entry = (servantId, total, extra = {}) => ({ servantId, ascension: 0, skill: 0, append: 0, costume: 0, total, ...extra })
const USAGE = [entry(1, 50), entry(2, 30), entry(3, 10), entry(99, 5)]
const CTX = { trackedIds: [2, 3], favoriteIds: [1], knownServantIds: [1, 2, 3] }

test("filterUsage filters by collection and drops servants missing from the index", () => {
  // Review Focus 4: servant 99 is not in the servants index → skipped everywhere.
  assert.deepEqual(filterUsage(USAGE, "all", CTX).map((e) => e.servantId), [1, 2, 3])
  assert.deepEqual(filterUsage(USAGE, "tracked", CTX).map((e) => e.servantId), [2, 3])
  assert.deepEqual(filterUsage(USAGE, "favorites", CTX).map((e) => e.servantId), [1])
  assert.deepEqual(filterUsage(USAGE, "favorites", { ...CTX, favoriteIds: [] }), [])
})

test("formatUsageBreakdown lists non-zero categories", () => {
  assert.equal(
    formatUsageBreakdown(entry(1, 1063, { ascension: 15, skill: 1048, costume: 0 })),
    "Ascension 15 · Skill 1,048"
  )
  assert.equal(formatUsageBreakdown(entry(1, 0)), "")
})

test("parseOwnedQuantity clamps junk to a safe integer", () => {
  // Review Focus 1.
  assert.equal(parseOwnedQuantity("12"), 12)
  assert.equal(parseOwnedQuantity(3.7), 3)
  assert.equal(parseOwnedQuantity(""), 0)
  assert.equal(parseOwnedQuantity("-5"), 0)
  assert.equal(parseOwnedQuantity("abc"), 0)
  assert.equal(parseOwnedQuantity(Number.NaN), 0)
  assert.equal(parseOwnedQuantity("1e12"), MAX_OWNED_QUANTITY)
})

test("holdStepAmount accelerates after one second", () => {
  // Review Focus 2.
  assert.equal(holdStepAmount(0), 1)
  assert.equal(holdStepAmount(999), 1)
  assert.equal(holdStepAmount(1000), 10)
})

test("holdReachedLimit stops a hold at 0 going down and at the max going up", () => {
  // Final review Important #1: the − button disables at 0 mid-hold, and some browsers then
  // never deliver pointerup/leave, so the repeat must stop itself at the bound.
  assert.equal(holdReachedLimit(0, -1), true)
  assert.equal(holdReachedLimit(1, -1), false)
  assert.equal(holdReachedLimit(MAX_OWNED_QUANTITY, 1), true)
  assert.equal(holdReachedLimit(MAX_OWNED_QUANTITY - 1, 1), false)
  assert.equal(holdReachedLimit(0, 1), false)
})
