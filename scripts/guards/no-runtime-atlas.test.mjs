import { test } from "node:test"
import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

const APP_ROOTS = ["app", "components", "lib"]
const FORBIDDEN = ["api.atlasacademy.io", "/api/atlas"]

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(path)
    else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) yield path
  }
}

test("app code makes no runtime calls to the Atlas API", async () => {
  const offenders = []
  for (const root of APP_ROOTS) {
    for await (const file of walk(root)) {
      const source = await readFile(file, "utf8")
      for (const needle of FORBIDDEN) {
        if (source.includes(needle)) offenders.push(`${file}: ${needle}`)
      }
    }
  }
  assert.deepEqual(offenders, [])
})
