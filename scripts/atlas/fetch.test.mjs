import { test } from "node:test"
import assert from "node:assert/strict"

import { mapWithConcurrency } from "./fetch.mjs"

test("mapWithConcurrency keeps input order and caps parallelism", async () => {
  let active = 0
  let peak = 0
  const result = await mapWithConcurrency([30, 5, 20, 1, 10], 2, async (ms, index) => {
    active += 1
    peak = Math.max(peak, active)
    await new Promise((resolve) => setTimeout(resolve, ms))
    active -= 1
    return `${index}:${ms}`
  })

  assert.deepEqual(result, ["0:30", "1:5", "2:20", "3:1", "4:10"])
  assert.equal(peak, 2)
})
