import { test } from "node:test"
import assert from "node:assert/strict"

import { isBrowsableFreeQuest } from "./free-quests.ts"

test("isBrowsableFreeQuest keeps repeatable quests outside the GUDAGUDA Imperial Capital war", () => {
  assert.equal(isBrowsableFreeQuest({ repeatable: true, warId: 100 }), true)
  assert.equal(isBrowsableFreeQuest({ repeatable: false, warId: 100 }), false)
  // Imperial Capital (war 9033) belongs to an event, not the main free-quest browser.
  assert.equal(isBrowsableFreeQuest({ repeatable: true, warId: 9033 }), false)
})
