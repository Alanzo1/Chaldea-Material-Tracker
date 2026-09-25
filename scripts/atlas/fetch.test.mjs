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

test("fetchJson does not retry a 404 and exposes the status", async () => {
  const { createServer } = await import("node:http")
  const { fetchJson } = await import("./fetch.mjs")
  let hits = 0
  const server = createServer((_req, res) => {
    hits += 1
    res.statusCode = 404
    res.end("{}")
  })
  await new Promise((resolve) => server.listen(0, resolve))
  try {
    await assert.rejects(
      fetchJson(`http://127.0.0.1:${server.address().port}/missing`, { retries: 2 }),
      (error) => error.status === 404
    )
    assert.equal(hits, 1)
  } finally {
    server.close()
  }
})

test("mapWithRetryPass retries failures sequentially and reports what still fails", async () => {
  const { mapWithRetryPass } = await import("./fetch.mjs")
  const attempts = new Map()
  const { results, failed } = await mapWithRetryPass(["a", "b", "c"], 2, async (item) => {
    const n = (attempts.get(item) ?? 0) + 1
    attempts.set(item, n)
    if (item === "b" && n === 1) throw new Error("cold cache")
    if (item === "c") throw new Error("down")
    return item.toUpperCase()
  })

  assert.deepEqual(results, ["A", "B", undefined])
  assert.deepEqual(failed, [2])
  assert.equal(attempts.get("b"), 2)
})
