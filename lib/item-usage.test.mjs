import { test } from "node:test"
import assert from "node:assert/strict"

import {
  MAX_OWNED_QUANTITY,
  filterUsage,
  formatUsageBreakdown,
  normalizeOwnedDraft,
  parseOwnedQuantity,
} from "./item-usage.ts"

const entry = (servantId, total, extra = {}) => ({ servantId, ascension: 0, skill: 0, append: 0, costume: 0, total, ...extra })
const USAGE = [entry(1, 50), entry(2, 30), entry(3, 10), entry(99, 5)]
const CTX = { trackedIds: [2, 3], knownServantIds: [1, 2, 3] }

test("filterUsage filters by collection and drops servants missing from the index", () => {
  // Review Focus 4: servant 99 is not in the servants index → skipped everywhere.
  assert.deepEqual(filterUsage(USAGE, "all", CTX).map((e) => e.servantId), [1, 2, 3])
  assert.deepEqual(filterUsage(USAGE, "tracked", CTX).map((e) => e.servantId), [2, 3])
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

test("normalizeOwnedDraft keeps digits only and drops leading zeros", () => {
  // Typing into a field showing "0" must replace it, not produce "05".
  assert.equal(normalizeOwnedDraft("05"), "5")
  assert.equal(normalizeOwnedDraft("0012"), "12")
  assert.equal(normalizeOwnedDraft("000"), "0")
  assert.equal(normalizeOwnedDraft("0"), "0")
  // Clearing the field while editing is allowed; saving an empty draft stores 0.
  assert.equal(normalizeOwnedDraft(""), "")
  assert.equal(normalizeOwnedDraft("1,234"), "1234")
  assert.equal(normalizeOwnedDraft("-5"), "5")
  assert.equal(normalizeOwnedDraft("99999999"), String(MAX_OWNED_QUANTITY))
})
