import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createRegionConfig } from "./region.mjs"
import { writeDataset, readPreviousStats } from "./dataset.mjs"

test("region defaults to NA; JP uses English exports and public/data-jp", () => {
  assert.equal(createRegionConfig([]).region, "NA")
  for (const region of ["NA", "JP"]) {
    const config = createRegionConfig(["--region", region], "/project")
    assert.equal(config.region, region)
    assert.equal(config.outDir, region === "NA" ? "/project/public/data" : "/project/public/data-jp")
    // JP uses Atlas's English exports; NA names are already English.
    const suffix = region === "JP" ? "_lang_en" : ""
    const lang = region === "JP" ? "?lang=en" : ""
    assert.equal(config.exportUrl("nice_item"), `https://api.atlasacademy.io/export/${region}/nice_item${suffix}.json`)
    assert.equal(config.questPhaseUrl(123, 2), `https://api.atlasacademy.io/nice/${region}/quest/123/2${lang}`)
    assert.equal(config.basicServantUrl(100), `https://api.atlasacademy.io/basic/${region}/servant/100${lang}`)
    // The war export ignores _lang_en, so JP fetches translated wars one by one.
    assert.equal(config.warUrl(100), `https://api.atlasacademy.io/nice/${region}/war/100${lang}`)
    assert.equal(config.translateWars, region === "JP")
    // JP buff labels are relabelled from NA's English names for the same ids.
    assert.equal(config.effectNamesUrl, region === "JP" ? "https://api.atlasacademy.io/export/NA/nice_servant.json" : null)
  }
})

test("invalid regions and malformed arguments fail before configuration is returned", () => {
  for (const args of [["--region"], ["--region", "EU"], ["--region", "jp"], ["--region", "../NA"], ["--other", "JP"], ["JP"], ["--region", "JP", "--region", "NA"]]) {
    assert.throws(() => createRegionConfig(args), /Usage:/)
  }
})

test("refreshing either region preserves the other dataset and uses its own previous stats", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-regions-"))
  const output = (region) => createRegionConfig(["--region", region], root).outDir
  const data = (count) => ({
    servantsIndex: Array.from({ length: count }, (_, id) => ({ id })),
    servantDetails: new Map(), materialsIndex: [], items: {},
    freeQuests: { index: [], phases: {} },
  })
  try {
    await writeDataset(output("NA"), data(1))
    await writeDataset(output("JP"), data(2))
    for (const [region, other, count] of [["NA", "JP", 3], ["JP", "NA", 4]]) {
      const before = await readFile(join(output(other), "servants-index.json"), "utf8")
      await writeDataset(output(region), data(count))
      assert.equal(await readFile(join(output(other), "servants-index.json"), "utf8"), before)
      assert.equal((await readPreviousStats(output(region))).servantCount, count)
    }
    assert.equal((await readPreviousStats(output("NA"))).servantCount, 3)
    assert.equal((await readPreviousStats(output("JP"))).servantCount, 4)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
