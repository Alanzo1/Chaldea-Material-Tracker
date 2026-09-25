# Material Page Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/items` + `/material/[itemId]` into one item browser (grid left, detail right) with an owned-quantity stepper and Usage / Sources tabs.

**Architecture:** The Atlas pipeline gains item metadata in `materials-index.json` and replaces `farming/{id}.json` with `items/{id}.json = { nodes, usage }`, where `usage` is aggregated from servant material costs. Material pages become statically generated from the index; client components load the per-item file and read owned counts from the existing tracker state.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Node 24 `node --test` (type stripping for `lib/*.ts`), dependency-free pipeline in `scripts/atlas/`.

**Spec:** `docs/superpowers/specs/2026-09-25-material-page-revamp-design.md`

## Global Constraints

- Pipeline uses only Node built-ins; no new npm dependencies anywhere.
- App code (`app/`, `components/`, `lib/`) must not reference `api.atlasacademy.io` or `/api/atlas` (enforced by `scripts/guards/no-runtime-atlas.test.mjs`).
- Pipeline output stays byte-deterministic (sorted arrays/keys, no timestamps).
- Owned quantity is the tracker's `ownedByMaterialId`, written only via `setOwnedMaterialQuantity` from `lib/material-tracker.ts`.
- Usage totals use the servant page Mat Summary multipliers: skill cost × distinct `skills[].num` count (min 1); append cost × `appendPassive.length` (min 1); ascension and costume × 1.
- Pure `lib/*.ts` modules tested by `node --test` must use only relative `import type` (erased at runtime), never `@/` aliases.
- Client components never import `lib/atlas-data.ts` (it uses `node:fs`); they import types from `lib/atlas-types.ts`.

## Spec refinement (decided while planning)

Atlas `detail` strings start with a quoted category line, e.g. `"Skill Up & Ascension Material"\nProof that…`. The index stores that as `category` (fallback `"Material"`) and the remaining text as `detail`, instead of mapping `type` through a lookup table. Only three `type` values exist in the index today (`skillLvUp`, `tdLvUp`, `eventItem`), and the quoted line is more specific than any label derived from them. `type` and `background` are still stored.

## Review Focus

1. **Typing junk into the owned field** (empty, `-5`, `abc`, `1e12`, `3.7`) — expected: clamps to an integer in `0…9,999,999`, never NaN, never negative. Pinned by `parseOwnedQuantity` tests (Task 4).
2. **Holding − or + and releasing outside the button / on touch cancel** — expected: repeating stops; no runaway timer after unmount. Pinned by `holdStepAmount` test (Task 4) + pointerleave/pointercancel/unmount cleanup and a browser check (Task 5, Task 7).
3. **Item nobody uses and nobody drops** (event/costume items) — expected: Usage shows "Not used for servant upgrades", Sources shows "No known farming locations", no error. Pinned by `buildItemFiles` test for empty entries (Task 3) + browser check (Task 7).
4. **Usage entry for a servant missing from `servants-index.json`** — expected: silently skipped, not a broken tile. Pinned by `filterUsage` test (Task 4).
5. **Old links with query strings** (`/material/6503?name=…&returnTo=…`, bookmarked or cached) — expected: still render the item (params ignored). Pinned by a browser check (Task 7).

---

## File Structure

**Pipeline**
- Modify `scripts/atlas/materials.mjs` — add `category`, `detail`, `type`, `background` to index entries.
- Create `scripts/atlas/usage.mjs` — `buildItemUsage(servantDetails)`, `buildItemFiles(farming, usage, itemIds)`.
- Modify `scripts/atlas/dataset.mjs` — write/read `items/`, validate item files and usage.
- Modify `scripts/atlas/build.mjs` — build `items` instead of `farming`.
- Tests: `scripts/atlas/materials.test.mjs`, `scripts/atlas/usage.test.mjs` (new), `scripts/atlas/dataset.test.mjs`.

**App library**
- Modify `lib/atlas-types.ts` — `MaterialIndexEntry` fields, `FarmingNode`, `ItemUsageEntry`, `ItemFile`.
- Modify `lib/atlas-data.ts` — `getMaterial(id)`.
- Create `lib/item-usage.ts` (+ `lib/item-usage.test.mjs`) — `filterUsage`, `formatUsageBreakdown`, `parseOwnedQuantity`, `holdStepAmount`.
- Create `lib/use-item-file.ts` — client hook loading `/data/items/{id}.json`.
- Create `lib/use-collection-ids.ts` — client hook for favorite + tracked servant ids (also used by `app/pages/Home.tsx`).

**Components (`components/materials/`)**
- Create `itemBackground.ts` — rarity background classes.
- Create `OwnedQuantityControl.tsx`, `MaterialSourcesList.tsx`, `MaterialUsagePanel.tsx`, `MaterialDetail.tsx`, `ItemGrid.tsx`, `ItemBrowser.tsx`.
- Delete `MaterialFarmingCard.tsx`.

**Routes and links**
- Rewrite `app/material/[itemId]/page.tsx`, `app/items/page.tsx`.
- Modify `app/track-materials/page.tsx` (fetch path, link), `components/servantPage/MaterialsSection.tsx` (links), `app/servantpage/[id]/page.tsx` (drop `returnTab`), `app/pages/Home.tsx` (use `useCollectionIds`).

---

### Task 1: Material index metadata

**Files:**
- Modify: `scripts/atlas/materials.mjs`
- Test: `scripts/atlas/materials.test.mjs`
- Modify: `lib/atlas-types.ts`

**Interfaces:**
- Produces: index entries `{ id: number, name: string, icon: string, category: string, detail: string, type: string, background: string }`; exported `splitItemDetail(detail: unknown) => { category: string, detail: string }`.

- [ ] **Step 1: Write the failing tests** — replace `scripts/atlas/materials.test.mjs` with:

```js
import { test } from "node:test"
import assert from "node:assert/strict"

import { buildMaterialsIndex, splitItemDetail } from "./materials.mjs"

const icon = (n) => `https://static.atlasacademy.io/${n}.png`

test("keeps upgrade materials, dedupes, sorts by name, adds metadata", () => {
  const result = buildMaterialsIndex([
    {
      id: 6503,
      name: "Void's Dust",
      icon: icon("a"),
      uses: ["skill"],
      type: "skillLvUp",
      background: "bronze",
      detail: '"Skill Up Material"\nDust left behind\nby the void.',
    },
    { id: 6001, name: "Gem of Saber", icon: icon("b"), uses: ["ascension"], type: "skillLvUp", background: "bronze", detail: "" },
    { id: 6001, name: "Gem of Saber", icon: icon("b"), uses: ["ascension"] },
    { id: 94000001, name: "Event Point", icon: icon("c"), uses: [] },
    { id: 7002, name: "No Icon", icon: "", uses: ["skill"] },
  ])

  assert.deepEqual(result, [
    { id: 6001, name: "Gem of Saber", icon: icon("b"), category: "Material", detail: "", type: "skillLvUp", background: "bronze" },
    {
      id: 6503,
      name: "Void's Dust",
      icon: icon("a"),
      category: "Skill Up Material",
      detail: "Dust left behind by the void.",
      type: "skillLvUp",
      background: "bronze",
    },
  ])
})

test("splitItemDetail separates the quoted category line", () => {
  assert.deepEqual(splitItemDetail('"Skill Up & Ascension Material"\r\nProof of a hero.\nMany possess it.'), {
    category: "Skill Up & Ascension Material",
    detail: "Proof of a hero. Many possess it.",
  })
  assert.deepEqual(splitItemDetail("Plain text only"), { category: "Material", detail: "Plain text only" })
  assert.deepEqual(splitItemDetail(undefined), { category: "Material", detail: "" })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test scripts/atlas/materials.test.mjs`
Expected: FAIL — `splitItemDetail` is not exported.

- [ ] **Step 3: Implement** — replace `scripts/atlas/materials.mjs` with:

```js
const UPGRADE_USES = ["skill", "appendSkill", "ascension", "costume"]
const DEFAULT_CATEGORY = "Material"

function shouldIncludeItem(item) {
  const id = Number(item.id ?? 0)
  if (!id || id === 6999) return true

  const uses = Array.isArray(item.uses) ? item.uses : []
  return uses.some((use) => UPGRADE_USES.includes(String(use)))
}

// Atlas item details start with a quoted category line: "Skill Up Material"\nFlavor text…
export function splitItemDetail(detail) {
  const text = String(detail ?? "").replace(/\r/g, "").trim()
  const match = text.match(/^"([^"\n]+)"\s*/)
  const category = match ? match[1].trim() : ""
  const rest = match ? text.slice(match[0].length) : text

  return {
    category: category || DEFAULT_CATEGORY,
    detail: rest.replace(/\s+/g, " ").trim(),
  }
}

export function buildMaterialsIndex(items) {
  const seen = new Set()

  return (Array.isArray(items) ? items : [])
    .filter(shouldIncludeItem)
    .map((item) => ({
      id: Number(item.id ?? 0),
      name: String(item.name ?? "").trim(),
      icon: String(item.icon ?? "").trim(),
      ...splitItemDetail(item.detail),
      type: String(item.type ?? ""),
      background: String(item.background ?? ""),
    }))
    .filter((item) => item.id > 0 && item.name.length > 0 && item.icon.length > 0)
    .filter((item) => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
    .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test scripts/atlas/materials.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 5: Update the app type** — in `lib/atlas-types.ts` replace the `MaterialIndexEntry` interface with:

```ts
export interface MaterialIndexEntry {
  id: number
  name: string
  icon: string
  /** From the quoted first line of the Atlas detail, e.g. "Skill Up & Ascension Material". */
  category: string
  /** Description without the category line. */
  detail: string
  /** Atlas item type: "skillLvUp" | "tdLvUp" | "eventItem" | … */
  type: string
  /** Rarity frame: "bronze" | "silver" | "gold" | … */
  background: string
}
```

Run: `npx tsc --noEmit` — Expected: no errors (existing callers only read `id/name/icon`).

- [ ] **Step 6: Commit**

```bash
git add scripts/atlas/materials.mjs scripts/atlas/materials.test.mjs lib/atlas-types.ts
git commit -m "feat(data): add category, detail, type, background to materials index"
```

---

### Task 2: Item usage aggregation

**Files:**
- Create: `scripts/atlas/usage.mjs`
- Test: `scripts/atlas/usage.test.mjs`

**Interfaces:**
- Consumes: servant detail objects as written by `trimServantDetail` (`skills`, `appendPassive`, `ascensionMaterials`, `skillMaterials`, `appendSkillMaterials`, `costumeMaterials`; each material map is `{ [stage]: { items: [{ item: { id }, amount }], qp } }`).
- Produces: `buildItemUsage(servantDetails: Iterable<[number, detail]>) => Record<string, ItemUsageEntry[]>` where `ItemUsageEntry = { servantId, ascension, skill, append, costume, total }`, each list sorted by `total` desc then `servantId` asc.

- [ ] **Step 1: Write the failing test** — create `scripts/atlas/usage.test.mjs`:

```js
import { test } from "node:test"
import assert from "node:assert/strict"

import { buildItemUsage } from "./usage.mjs"

const stage = (...pairs) => ({ qp: 1, items: pairs.map(([id, amount]) => ({ item: { id }, amount })) })

test("buildItemUsage multiplies skill/append costs per slot and sorts by total", () => {
  const servants = new Map([
    [
      100,
      {
        skills: [{ num: 1 }, { num: 2 }, { num: 2 }, { num: 3 }], // 3 distinct slots (upgrade variant shares num)
        appendPassive: [{}, {}, {}, {}, {}], // 5 append slots
        ascensionMaterials: { "0": stage([7001, 5]), "1": stage([7001, 10], [6503, 2]) },
        skillMaterials: { "1": stage([6001, 4]), "2": stage([6503, 1]) },
        appendSkillMaterials: { "1": stage([6503, 2]) },
        costumeMaterials: { "100130": stage([6503, 3]) },
      },
    ],
    [
      200,
      {
        skills: [],
        appendPassive: [],
        ascensionMaterials: { "0": stage([6503, 30]) },
        skillMaterials: {},
        appendSkillMaterials: {},
        costumeMaterials: {},
      },
    ],
  ])

  const usage = buildItemUsage(servants)

  assert.deepEqual(usage["7001"], [{ servantId: 100, ascension: 15, skill: 0, append: 0, costume: 0, total: 15 }])
  assert.deepEqual(usage["6001"], [{ servantId: 100, ascension: 0, skill: 12, append: 0, costume: 0, total: 12 }])
  // 6503: servant 100 = asc 2 + skill 1×3 + append 2×5 + costume 3 = 18; servant 200 = 30 → 200 first.
  assert.deepEqual(usage["6503"], [
    { servantId: 200, ascension: 30, skill: 0, append: 0, costume: 0, total: 30 },
    { servantId: 100, ascension: 2, skill: 3, append: 10, costume: 3, total: 18 },
  ])
})

test("buildItemUsage ignores zero/invalid amounts and missing maps", () => {
  const usage = buildItemUsage(
    new Map([[1, { ascensionMaterials: { "0": { items: [{ item: { id: 5 }, amount: 0 }, { item: {}, amount: 3 }] } } }]])
  )
  assert.deepEqual(usage, {})
})

test("buildItemUsage breaks total ties by servant id", () => {
  const detail = { ascensionMaterials: { "0": stage([9, 1]) } }
  const usage = buildItemUsage(new Map([[30, detail], [10, detail], [20, detail]]))
  assert.deepEqual(usage["9"].map((entry) => entry.servantId), [10, 20, 30])
})
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test scripts/atlas/usage.test.mjs`
Expected: FAIL — cannot find module `./usage.mjs`.

- [ ] **Step 3: Implement** — create `scripts/atlas/usage.mjs`:

```js
// Item → servants that need it, aggregated from trimmed servant details.
// Multipliers match the servant page's Mat Summary: per-level skill/append costs apply to every slot.

function emptyCounts() {
  return { ascension: 0, skill: 0, append: 0, costume: 0 }
}

function addStageMap(perItem, stageMap, key, multiplier) {
  for (const stage of Object.values(stageMap ?? {})) {
    for (const entry of stage?.items ?? []) {
      const itemId = Number(entry?.item?.id ?? 0)
      const amount = Number(entry?.amount ?? 0)
      if (!itemId || !(amount > 0)) continue

      const counts = perItem.get(itemId) ?? emptyCounts()
      counts[key] += amount * multiplier
      perItem.set(itemId, counts)
    }
  }
}

export function buildItemUsage(servantDetails) {
  const usage = {}

  for (const [servantId, detail] of servantDetails) {
    const skillSlots = Math.max(new Set((detail.skills ?? []).map((skill) => skill?.num)).size, 1)
    const appendSlots = Math.max((detail.appendPassive ?? []).length, 1)
    const perItem = new Map()

    addStageMap(perItem, detail.ascensionMaterials, "ascension", 1)
    addStageMap(perItem, detail.skillMaterials, "skill", skillSlots)
    addStageMap(perItem, detail.appendSkillMaterials, "append", appendSlots)
    addStageMap(perItem, detail.costumeMaterials, "costume", 1)

    for (const [itemId, counts] of perItem) {
      const total = counts.ascension + counts.skill + counts.append + counts.costume
      ;(usage[String(itemId)] ??= []).push({ servantId: Number(servantId), ...counts, total })
    }
  }

  for (const list of Object.values(usage)) {
    list.sort((a, b) => b.total - a.total || a.servantId - b.servantId)
  }
  return usage
}
```

Note: `skills` with no `num` field collapse to one `undefined` key → 1 slot, same as the servant page.

- [ ] **Step 4: Run to verify pass**

Run: `node --test scripts/atlas/usage.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/atlas/usage.mjs scripts/atlas/usage.test.mjs
git commit -m "feat(data): aggregate item usage across servants"
```

---

### Task 3: Per-item files in the dataset; switch consumers; regenerate data

**Files:**
- Modify: `scripts/atlas/usage.mjs` (add `buildItemFiles`)
- Modify: `scripts/atlas/usage.test.mjs`
- Modify: `scripts/atlas/dataset.mjs`
- Modify: `scripts/atlas/dataset.test.mjs`
- Modify: `scripts/atlas/build.mjs`
- Modify: `components/materials/MaterialFarmingCard.tsx:175` (fetch path; file is deleted in Task 5)
- Modify: `app/track-materials/page.tsx:323` (fetch path)
- Regenerate: `public/data/**`

**Interfaces:**
- Consumes: `buildFarmingIndex(...) => Record<string, FarmingNode[]>` (existing), `buildItemUsage` (Task 2).
- Produces: `buildItemFiles(farming, usage, itemIds: number[]) => Record<string, { nodes, usage }>` (keys sorted numerically); dataset field `items` replaces `farming`; files `public/data/items/{id}.json`; `readPreviousStats` returns `{ servantCount, materialCount, farmedItemCount, usedItemCount }`.

- [ ] **Step 1: Write failing test for `buildItemFiles`** — append to `scripts/atlas/usage.test.mjs`:

```js
import { buildItemFiles } from "./usage.mjs"

test("buildItemFiles covers every index item plus any farmed or used item", () => {
  const files = buildItemFiles(
    { "6503": [{ id: 1 }], "9000": [{ id: 2 }] },
    { "6503": [{ servantId: 1, total: 5 }], "7001": [{ servantId: 2, total: 3 }] },
    [6999, 6503]
  )

  assert.deepEqual(Object.keys(files), ["6503", "6999", "7001", "9000"])
  assert.deepEqual(files["6503"], { nodes: [{ id: 1 }], usage: [{ servantId: 1, total: 5 }] })
  // Review Focus 3: an index item nobody uses or drops still gets an (empty) file.
  assert.deepEqual(files["6999"], { nodes: [], usage: [] })
  assert.deepEqual(files["7001"], { nodes: [], usage: [{ servantId: 2, total: 3 }] })
})
```

Run: `node --test scripts/atlas/usage.test.mjs` — Expected: FAIL, `buildItemFiles` not exported.

- [ ] **Step 2: Implement `buildItemFiles`** — append to `scripts/atlas/usage.mjs`:

```js
// One file per item: farming nodes (Sources tab) + servant usage (Usage tab).
export function buildItemFiles(farming, usage, itemIds) {
  const ids = [
    ...new Set([...itemIds.map(String), ...Object.keys(farming), ...Object.keys(usage)]),
  ].sort((a, b) => Number(a) - Number(b))

  return Object.fromEntries(
    ids.map((id) => [id, { nodes: farming[id] ?? [], usage: usage[id] ?? [] }])
  )
}
```

Run: `node --test scripts/atlas/usage.test.mjs` — Expected: PASS (4 tests).

- [ ] **Step 3: Update dataset tests** — in `scripts/atlas/dataset.test.mjs`:

Replace the `dataset()` helper with:

```js
function dataset({ servants = 400, materials = 200, farmItems = 100, usedItems = 100, failed = 0 } = {}) {
  const servantsIndex = Array.from({ length: servants }, (_, i) => ({ id: i + 1 }))
  const materialsIndex = Array.from({ length: materials }, (_, i) => ({ id: i + 1 }))
  return {
    servantsIndex,
    servantDetails: new Map(servantsIndex.map((s) => [s.id, { id: s.id }])),
    materialsIndex,
    items: Object.fromEntries(
      materialsIndex.map(({ id }, i) => [
        String(id),
        {
          nodes: i < farmItems ? [{ id: 1 }] : [],
          usage: i < usedItems ? [{ servantId: 1, total: 1 }] : [],
        },
      ])
    ),
    questFetch: { total: 1000, failed },
  }
}
```

Replace `const PREVIOUS = …` with:

```js
const PREVIOUS = { servantCount: 400, materialCount: 200, farmedItemCount: 100, usedItemCount: 100 }
```

and in `"validateDataset accepts a healthy dataset"` pass `PREVIOUS` instead of the inline object (move the `PREVIOUS` declaration above that test).

Add tests:

```js
test("validateDataset rejects index items without an item file", () => {
  const data = dataset()
  delete data.items["7"]
  assert.match(validateDataset(data, null).join("\n"), /missing item file.*7/)
})

test("validateDataset rejects too few used items and a used-item drop vs previous", () => {
  assert.match(validateDataset(dataset({ usedItems: 10 }), null).join("\n"), /used item count 10 < 50/)
  assert.match(
    validateDataset(dataset({ usedItems: 80 }), { ...PREVIOUS, usedItemCount: 120 }).join("\n"),
    /used item count dropped from 120 to 80/
  )
})
```

In `"validateDataset rejects a material or farmed-item drop over 5% vs previous run"` keep the call as is (it now builds `items`).

In `"writeDataset replaces the directory and removes stale files"` replace the three assertions after `await writeDataset(outDir, data)` with:

```js
  assert.deepEqual((await readdir(join(outDir, "servants"))).sort(), ["1.json", "2.json"])
  assert.deepEqual(JSON.parse(await readFile(join(outDir, "items", "1.json"), "utf8")), {
    nodes: [{ id: 1 }],
    usage: [{ servantId: 1, total: 1 }],
  })
  assert.equal(await readFile(join(outDir, "servants-index.json"), "utf8"), '[{"id":1},{"id":2}]\n')
  assert.deepEqual(await readPreviousStats(outDir), {
    servantCount: 2,
    materialCount: 1,
    farmedItemCount: 1,
    usedItemCount: 1,
  })
  assert.equal(await readPreviousStats(join(root, "missing")), null)
```

Run: `node --test scripts/atlas/dataset.test.mjs` — Expected: FAIL (dataset.mjs still uses `farming`).

- [ ] **Step 4: Update `scripts/atlas/dataset.mjs`** — replace the whole file with:

```js
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"

const MIN_SERVANTS = 300
const MIN_MATERIALS = 100
const MIN_FARMED_ITEMS = 50
const MIN_USED_ITEMS = 50
const MAX_DROP_VS_PREVIOUS = 0.05

function countItems(items, key) {
  return Object.values(items).filter((file) => (file?.[key] ?? []).length > 0).length
}

function stats(dataset) {
  return {
    servantCount: dataset.servantsIndex.length,
    materialCount: dataset.materialsIndex.length,
    farmedItemCount: countItems(dataset.items, "nodes"),
    usedItemCount: countItems(dataset.items, "usage"),
  }
}

export function validateDataset(dataset, previous) {
  const errors = []
  const current = stats(dataset)
  const { total, failed } = dataset.questFetch

  if (current.servantCount < MIN_SERVANTS) errors.push(`servant count ${current.servantCount} < ${MIN_SERVANTS}`)
  if (current.materialCount < MIN_MATERIALS) errors.push(`material count ${current.materialCount} < ${MIN_MATERIALS}`)
  if (current.farmedItemCount < MIN_FARMED_ITEMS) {
    errors.push(`farmed item count ${current.farmedItemCount} < ${MIN_FARMED_ITEMS}`)
  }
  if (current.usedItemCount < MIN_USED_ITEMS) {
    errors.push(`used item count ${current.usedItemCount} < ${MIN_USED_ITEMS}`)
  }
  // Failures remaining after the retry pass would silently drop nodes and churn the committed output.
  if (failed > 0) errors.push(`quest phase fetch failures ${failed}/${total} after retry pass`)

  // Fixed minimums miss partial outages (e.g. 600 → 60 farmed items), so also compare to the last run.
  const labels = {
    servantCount: "servant count",
    materialCount: "material count",
    farmedItemCount: "farmed item count",
    usedItemCount: "used item count",
  }
  for (const [key, label] of Object.entries(labels)) {
    if (previous?.[key] !== undefined && current[key] < previous[key] * (1 - MAX_DROP_VS_PREVIOUS)) {
      errors.push(`${label} dropped from ${previous[key]} to ${current[key]}`)
    }
  }

  const missing = dataset.servantsIndex.filter((s) => !dataset.servantDetails.has(s.id)).map((s) => s.id)
  if (missing.length) errors.push(`missing detail for servants: ${missing.join(", ")}`)

  const missingItems = dataset.materialsIndex.filter((m) => !dataset.items[String(m.id)]).map((m) => m.id)
  if (missingItems.length) errors.push(`missing item file for materials: ${missingItems.join(", ")}`)

  return errors
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value)}\n`)
}

export async function writeDataset(outDir, dataset) {
  const tmpDir = `${outDir}.tmp`
  await rm(tmpDir, { recursive: true, force: true })
  await mkdir(join(tmpDir, "servants"), { recursive: true })
  await mkdir(join(tmpDir, "items"), { recursive: true })

  await writeJson(join(tmpDir, "servants-index.json"), dataset.servantsIndex)
  await writeJson(join(tmpDir, "materials-index.json"), dataset.materialsIndex)
  for (const [id, detail] of dataset.servantDetails) {
    await writeJson(join(tmpDir, "servants", `${id}.json`), detail)
  }
  for (const [itemId, file] of Object.entries(dataset.items)) {
    await writeJson(join(tmpDir, "items", `${itemId}.json`), { nodes: file.nodes, usage: file.usage })
  }

  await rm(outDir, { recursive: true, force: true })
  await rename(tmpDir, outDir)
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"))
}

// Returns null when there is no previous output (fresh checkout, or the first run after
// the farming/ → items/ layout change); validation then skips the vs-previous comparison.
export async function readPreviousStats(outDir) {
  try {
    const servantsIndex = await readJson(join(outDir, "servants-index.json"))
    const materialsIndex = await readJson(join(outDir, "materials-index.json"))
    const items = {}
    for (const file of await readdir(join(outDir, "items"))) {
      items[file] = await readJson(join(outDir, "items", file))
    }
    return stats({ servantsIndex, materialsIndex, items })
  } catch {
    return null
  }
}
```

Run: `node --test scripts/atlas/dataset.test.mjs` — Expected: PASS.

- [ ] **Step 5: Update `scripts/atlas/build.mjs`**

Change the import line `import { aggregateDrops, buildFarmingIndex, buildQuestMeta, selectQuestPhaseJobs } from "./farming.mjs"` to keep as is, and add:

```js
import { buildItemFiles, buildItemUsage } from "./usage.mjs"
```

Replace the block from `const farming = buildFarmingIndex(` through the `const dataset = {` object and the final `console.log(` with:

```js
  const farming = buildFarmingIndex(
    aggregateDrops(questResults.filter(Boolean)),
    materialsIndex.map((m) => m.id),
    buildQuestMeta(wars)
  )
  const items = buildItemFiles(farming, buildItemUsage(servantDetails), materialsIndex.map((m) => m.id))

  const dataset = {
    servantsIndex,
    servantDetails,
    materialsIndex,
    items,
    questFetch: { total: jobs.length, failed },
  }
```

and the final log:

```js
  console.log(
    `Wrote ${servantsIndex.length} servants, ${materialsIndex.length} materials, ` +
      `${Object.keys(items).length} item files (quest failures ${failed}/${jobs.length}) to ${OUT_DIR}`
  )
```

- [ ] **Step 6: Switch consumers to `items/`**

`components/materials/MaterialFarmingCard.tsx` — change `` fetch(`/data/farming/${itemId}.json`, `` to `` fetch(`/data/items/${itemId}.json`, ``.

`app/track-materials/page.tsx` — change `` const r = await fetch(`/data/farming/${material.id}.json`, { cache: "force-cache" }) `` to `` const r = await fetch(`/data/items/${material.id}.json`, { cache: "force-cache" }) ``.

Run: `grep -rn "data/farming" app components lib` — Expected: no output.

- [ ] **Step 7: Run all tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 8: Regenerate data**

Run: `npm run data:refresh`
Expected: exit 0; last line `Wrote 420 servants, 138 materials, ~170 item files (quest failures 0/930) …` (counts may drift with Atlas).

Verify:

```bash
test ! -d public/data/farming && echo "farming removed"
node -e 'const f=require("./public/data/items/6503.json");console.log(f.nodes.length, f.usage.length, f.usage[0])'
node -e 'const m=require("./public/data/materials-index.json");console.log(m.find(x=>x.id===6503))'
```

Expected: `farming removed`; 6503 has nodes and usage (first entry has `servantId` and `total`); the index entry has `category`, `detail`, `type`, `background`.

- [ ] **Step 9: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

- [ ] **Step 10: Commit**

```bash
git add scripts/atlas components/materials/MaterialFarmingCard.tsx app/track-materials/page.tsx public/data
git commit -m "feat(data): write items/{id}.json with farming nodes and servant usage"
```

---

### Task 4: App library — types, pure helpers, hooks

**Files:**
- Modify: `lib/atlas-types.ts`
- Modify: `lib/atlas-data.ts`
- Create: `lib/item-usage.ts`
- Test: `lib/item-usage.test.mjs`
- Create: `lib/use-item-file.ts`
- Create: `lib/use-collection-ids.ts`
- Modify: `app/pages/Home.tsx`

**Interfaces:**
- Produces:
  - types `FarmingNode`, `ItemUsageEntry`, `ItemFile` in `lib/atlas-types.ts`
  - `getMaterial(id: number): MaterialIndexEntry | undefined` (server only)
  - `type UsageFilter = "all" | "tracked" | "favorites"`
  - `filterUsage(usage: ItemUsageEntry[], filter: UsageFilter, ctx: { trackedIds: number[]; favoriteIds: number[]; knownServantIds: Iterable<number> }): ItemUsageEntry[]`
  - `formatUsageBreakdown(entry: ItemUsageEntry): string` → e.g. `"Ascension 15 · Skill 48"`
  - `parseOwnedQuantity(value: unknown): number` (integer, 0…`MAX_OWNED_QUANTITY` = 9_999_999)
  - `holdStepAmount(heldMs: number): number` (1 before 1000 ms, then 10)
  - `useItemFile(itemId: number): { nodes: FarmingNode[]; usage: ItemUsageEntry[]; status: "loading" | "ready" | "error"; retry: () => void }`
  - `useCollectionIds(): { favoriteIds: number[]; trackedIds: number[] }`

- [ ] **Step 1: Add types** — append to `lib/atlas-types.ts`:

```ts
export interface FarmingNode {
  id: number
  questName: string
  apCost: number
  dropRate: number
  apPerDrop: number
  warName?: string
  locationName?: string
  questTitle?: string
}

export interface ItemUsageEntry {
  servantId: number
  ascension: number
  skill: number
  append: number
  costume: number
  total: number
}

/** public/data/items/{id}.json */
export interface ItemFile {
  nodes: FarmingNode[]
  usage: ItemUsageEntry[]
}
```

- [ ] **Step 2: Add `getMaterial`** — in `lib/atlas-data.ts`, after `getMaterialsIndex`:

```ts
export function getMaterial(id: number): MaterialIndexEntry | undefined {
  return getMaterialsIndex().find((material) => material.id === id)
}
```

- [ ] **Step 3: Write failing tests** — create `lib/item-usage.test.mjs`:

```js
import { test } from "node:test"
import assert from "node:assert/strict"

import {
  MAX_OWNED_QUANTITY,
  filterUsage,
  formatUsageBreakdown,
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
```

Run: `node --test lib/item-usage.test.mjs` — Expected: FAIL, cannot find `./item-usage.ts`.

- [ ] **Step 4: Implement** — create `lib/item-usage.ts`:

```ts
// Pure helpers for the material page. No `@/` imports: loaded directly by `node --test`.
import type { ItemUsageEntry } from "./atlas-types"

export type UsageFilter = "all" | "tracked" | "favorites"

export const MAX_OWNED_QUANTITY = 9_999_999
const HOLD_ACCELERATE_AFTER_MS = 1000

export function filterUsage(
  usage: ItemUsageEntry[],
  filter: UsageFilter,
  ctx: { trackedIds: number[]; favoriteIds: number[]; knownServantIds: Iterable<number> }
): ItemUsageEntry[] {
  const known = new Set(ctx.knownServantIds)
  const picked =
    filter === "tracked" ? new Set(ctx.trackedIds) : filter === "favorites" ? new Set(ctx.favoriteIds) : null

  return usage.filter((entry) => known.has(entry.servantId) && (!picked || picked.has(entry.servantId)))
}

const BREAKDOWN_LABELS: [keyof ItemUsageEntry, string][] = [
  ["ascension", "Ascension"],
  ["skill", "Skill"],
  ["append", "Append"],
  ["costume", "Costume"],
]

export function formatUsageBreakdown(entry: ItemUsageEntry): string {
  return BREAKDOWN_LABELS.filter(([key]) => entry[key] > 0)
    .map(([key, label]) => `${label} ${entry[key].toLocaleString("en-US")}`)
    .join(" · ")
}

export function parseOwnedQuantity(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").trim() || 0)
  if (!Number.isFinite(parsed)) return 0
  return Math.min(MAX_OWNED_QUANTITY, Math.max(0, Math.floor(parsed)))
}

export function holdStepAmount(heldMs: number): number {
  return heldMs >= HOLD_ACCELERATE_AFTER_MS ? 10 : 1
}
```

Run: `node --test lib/item-usage.test.mjs` — Expected: PASS (4 tests).

- [ ] **Step 5: Create `lib/use-item-file.ts`**

```ts
"use client"

import { useEffect, useState } from "react"

import type { ItemFile } from "@/lib/atlas-types"

const EMPTY: ItemFile = { nodes: [], usage: [] }

type Status = "loading" | "ready" | "error"

// Loads public/data/items/{id}.json (Sources + Usage for one material).
export function useItemFile(itemId: number) {
  const [state, setState] = useState<{ status: Status; file: ItemFile }>({ status: "loading", file: EMPTY })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState({ status: "loading", file: EMPTY })

    fetch(`/data/items/${itemId}.json`, { cache: "force-cache" })
      .then(async (response) => {
        if (response.status === 404) return EMPTY
        if (!response.ok) throw new Error(`Item data request failed (${response.status})`)
        return (await response.json()) as Partial<ItemFile>
      })
      .then((file) => {
        if (cancelled) return
        setState({
          status: "ready",
          file: {
            nodes: Array.isArray(file.nodes) ? file.nodes : [],
            usage: Array.isArray(file.usage) ? file.usage : [],
          },
        })
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", file: EMPTY })
      })

    return () => {
      cancelled = true
    }
  }, [itemId, attempt])

  return { ...state.file, status: state.status, retry: () => setAttempt((count) => count + 1) }
}
```

- [ ] **Step 6: Create `lib/use-collection-ids.ts`**

```ts
"use client"

import { useEffect, useState } from "react"

import { readFavoriteServantIds } from "@/lib/favorites"
import { readTrackedMaterialsState } from "@/lib/material-tracker"

// Favorite and tracked servant ids (localStorage-backed). Read on mount so changes made on
// other pages show up when the component remounts.
export function useCollectionIds() {
  const [ids, setIds] = useState<{ favoriteIds: number[]; trackedIds: number[] }>({
    favoriteIds: [],
    trackedIds: [],
  })

  useEffect(() => {
    setIds({
      favoriteIds: readFavoriteServantIds(),
      trackedIds: readTrackedMaterialsState().servants.map((entry) => entry.servantId),
    })
  }, [])

  return ids
}
```

- [ ] **Step 7: Use it in `app/pages/Home.tsx`**

Replace the imports `import { readFavoriteServantIds } from "@/lib/favorites"` and `import { readTrackedMaterialsState } from "@/lib/material-tracker"` with `import { useCollectionIds } from "@/lib/use-collection-ids"`.

Replace:

```tsx
  const [favoriteIds, setFavoriteIds] = useState<number[]>([])
  const [trackedIds, setTrackedIds] = useState<number[]>([])
```

with:

```tsx
  const { favoriteIds, trackedIds } = useCollectionIds()
```

and delete the `useEffect` block commented `// localStorage-backed; read on mount…` (the one calling `setFavoriteIds`/`setTrackedIds`). Remove `useEffect` from the React import if now unused.

- [ ] **Step 8: Verify**

Run: `npm test && npx tsc --noEmit`
Expected: all tests pass; no type errors.

- [ ] **Step 9: Commit**

```bash
git add lib/atlas-types.ts lib/atlas-data.ts lib/item-usage.ts lib/item-usage.test.mjs lib/use-item-file.ts lib/use-collection-ids.ts app/pages/Home.tsx
git commit -m "feat(lib): item usage helpers and item-file/collection hooks"
```

---

### Task 5: Material detail components

**Files:**
- Create: `components/materials/itemBackground.ts`
- Create: `components/materials/OwnedQuantityControl.tsx`
- Create: `components/materials/MaterialSourcesList.tsx`
- Create: `components/materials/MaterialUsagePanel.tsx`
- Create: `components/materials/MaterialDetail.tsx`
- Delete: `components/materials/MaterialFarmingCard.tsx`

**Interfaces:**
- Consumes: Task 4 exports; `ServantTabs` (`components/servantPage/ServantTabs.tsx`, props `{ tabs: { id: string; label: string; content: ReactNode }[] }`); `useServants()` (`servants: ServantIndexEntry[]`); tracker functions `readTrackedMaterialsState`, `setOwnedMaterialQuantity`, `calculateAggregateRequirements`; `computeTrackerStateInWorker`.
- Produces: `MaterialDetail({ material }: { material: MaterialIndexEntry })`; `ITEM_BACKGROUND_CLASS: Record<string, string>` and `itemBackgroundClass(background: string): string`.

Note: `app/material/[itemId]/page.tsx` imports `MaterialFarmingCard` until Task 6. Do Task 5 and Task 6 before running the build; Step 7 below only typechecks the new files.

- [ ] **Step 1: Create `components/materials/itemBackground.ts`**

```ts
// Tile/icon backdrop by Atlas item rarity frame.
export const ITEM_BACKGROUND_CLASS: Record<string, string> = {
  bronze: "bg-gradient-to-b from-amber-800/50 to-amber-950/40",
  silver: "bg-gradient-to-b from-slate-300/35 to-slate-500/20",
  gold: "bg-gradient-to-b from-yellow-400/40 to-amber-600/25",
}

export function itemBackgroundClass(background: string) {
  return ITEM_BACKGROUND_CLASS[background] ?? "bg-muted"
}
```

- [ ] **Step 2: Create `components/materials/OwnedQuantityControl.tsx`**

```tsx
"use client"

import { Minus, Plus } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { holdStepAmount, parseOwnedQuantity } from "@/lib/item-usage"
import * as materialTracker from "@/lib/material-tracker"
import { computeTrackerStateInWorker } from "@/lib/material-tracker-worker-client"

const HOLD_DELAY_MS = 400
const HOLD_INTERVAL_MS = 90
const NUMBER = new Intl.NumberFormat("en-US")

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${tone ?? "text-foreground"}`}>{NUMBER.format(value)}</p>
    </div>
  )
}

// Owned count for one material, shared with the Planning page (tracker ownedByMaterialId).
export function OwnedQuantityControl({ itemId }: { itemId: number }) {
  const [owned, setOwned] = useState(0)
  const [needed, setNeeded] = useState(0)
  const ownedRef = useRef(0)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdStartedAt = useRef(0)

  useEffect(() => {
    const trackerState = materialTracker.readTrackedMaterialsState()
    const initial = parseOwnedQuantity(trackerState.ownedByMaterialId[String(itemId)] ?? 0)
    ownedRef.current = initial
    setOwned(initial)

    let cancelled = false
    computeTrackerStateInWorker(trackerState)
      .then((payload) => {
        if (cancelled) return
        setNeeded(payload.aggregate.requiredMaterials.find((entry) => entry.id === itemId)?.amount ?? 0)
      })
      .catch(() => {
        if (cancelled) return
        const aggregate = materialTracker.calculateAggregateRequirements(trackerState)
        setNeeded(aggregate.requiredMaterials.find((entry) => entry.id === itemId)?.amount ?? 0)
      })

    return () => {
      cancelled = true
    }
  }, [itemId])

  const commit = (value: unknown) => {
    const safe = parseOwnedQuantity(value)
    ownedRef.current = safe
    setOwned(safe)
    materialTracker.setOwnedMaterialQuantity(itemId, safe)
  }

  const stopHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current)
    holdTimer.current = null
  }

  // Press: step once now; keep holding: repeat, stepping by 10 after 1 s.
  const startHold = (direction: 1 | -1) => {
    stopHold()
    commit(ownedRef.current + direction)
    holdStartedAt.current = Date.now()
    const tick = () => {
      commit(ownedRef.current + direction * holdStepAmount(Date.now() - holdStartedAt.current))
      holdTimer.current = setTimeout(tick, HOLD_INTERVAL_MS)
    }
    holdTimer.current = setTimeout(tick, HOLD_DELAY_MS)
  }

  // Review Focus 2: never leave a repeating timer behind.
  useEffect(() => stopHold, [])

  const stepButton = (direction: 1 | -1) => (
    <button
      type="button"
      aria-label={direction > 0 ? "Increase owned" : "Decrease owned"}
      disabled={direction < 0 && owned === 0}
      onPointerDown={(event) => {
        event.preventDefault()
        startHold(direction)
      }}
      onPointerUp={stopHold}
      onPointerLeave={stopHold}
      onPointerCancel={stopHold}
      // Keyboard activation (Enter/Space) fires click with detail 0 and no pointer events.
      onClick={(event) => {
        if (event.detail === 0) commit(ownedRef.current + direction)
      }}
      className="grid size-10 shrink-0 select-none place-items-center rounded-full bg-muted text-foreground transition-colors hover:bg-muted/70 disabled:opacity-40"
    >
      {direction > 0 ? <Plus className="size-4" aria-hidden="true" /> : <Minus className="size-4" aria-hidden="true" />}
    </button>
  )

  const remaining = Math.max(0, needed - owned)

  return (
    <section className="grid gap-4 rounded-lg bg-card/60 p-4 sm:grid-cols-[auto_1fr_1fr] sm:items-center">
      <div>
        <label htmlFor={`owned-${itemId}`} className="text-xs text-muted-foreground">
          Owned
        </label>
        <div className="mt-1 flex items-center gap-2">
          {stepButton(-1)}
          <input
            id={`owned-${itemId}`}
            type="number"
            inputMode="numeric"
            min={0}
            value={owned}
            onChange={(event) => commit(event.target.value)}
            className="h-10 w-28 rounded-md border border-border bg-background px-3 text-center text-base font-semibold tabular-nums"
          />
          {stepButton(1)}
        </div>
      </div>
      <Stat label="Needed by tracked servants" value={needed} />
      <Stat label="Remaining" value={remaining} tone={remaining > 0 ? "text-rose-300" : "text-emerald-300"} />
    </section>
  )
}
```

- [ ] **Step 3: Create `components/materials/MaterialSourcesList.tsx`** (logic moved from `MaterialFarmingCard`)

```tsx
"use client"

import type { FarmingNode } from "@/lib/atlas-types"

const LORE_ID = 6999

function getApPerDropColor(value: number) {
  if (value < 40) return "text-emerald-400"
  if (value <= 70) return "text-amber-300"
  return "text-rose-400"
}

function formatPercent(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "--"
  return `${(value * 100).toFixed(1)}%`
}

function formatApPerDrop(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "--"
  return `${value.toFixed(1)} AP/drop`
}

function sanitizeLabel(value: unknown) {
  const normalized = String(value ?? "").trim()
  if (!normalized) return ""
  if (/^[-‐‑‒–—―ー－\s]+$/u.test(normalized)) return ""
  return normalized
}

function getDisplayParts(node: FarmingNode) {
  const warName = sanitizeLabel(node.warName)
  const locationName = sanitizeLabel(node.locationName)
  const questTitle = sanitizeLabel(node.questTitle)

  if (questTitle || locationName || warName) {
    return { questTitle: questTitle || node.questName, locationName, warName }
  }

  const raw = String(node.questName ?? "").trim()
  const separatorIndex = raw.indexOf(" - ")
  if (separatorIndex < 0) return { questTitle: raw, locationName: "", warName: "" }

  return {
    locationName: sanitizeLabel(raw.slice(0, separatorIndex)),
    questTitle: sanitizeLabel(raw.slice(separatorIndex + 3)),
    warName: "",
  }
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={`sources-skeleton-${index}`} className="space-y-2">
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-3 w-full animate-pulse rounded bg-muted/70" />
        </div>
      ))}
    </div>
  )
}

interface MaterialSourcesListProps {
  itemId: number
  nodes: FarmingNode[]
  status: "loading" | "ready" | "error"
  onRetry: () => void
}

export function MaterialSourcesList({ itemId, nodes, status, onRetry }: MaterialSourcesListProps) {
  if (itemId === LORE_ID) {
    return (
      <p className="text-sm text-muted-foreground">
        Crystallized Lore is primarily obtained through Rare Prism exchange and Rank Up Quests.
      </p>
    )
  }
  if (status === "loading") return <LoadingSkeleton />
  if (status === "error") {
    return (
      <p className="text-sm text-rose-300">
        Couldn&apos;t load item data.{" "}
        <button type="button" onClick={onRetry} className="underline underline-offset-4">
          Retry
        </button>
      </p>
    )
  }
  if (!nodes.length) return <p className="text-sm text-muted-foreground">No known farming locations</p>

  return (
    <div className="space-y-4 rounded-lg bg-card/60 p-4">
      {nodes.map((node, index) => {
        const display = getDisplayParts(node)
        const locationLine = [display.locationName, display.warName].filter(Boolean).join(" - ")
        return (
          <div key={`${node.id}-${index}`} className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">{display.questTitle}</p>
                {locationLine ? <p className="text-xs text-muted-foreground">{locationLine}</p> : null}
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p>AP {node.apCost}</p>
                <p>{formatPercent(node.dropRate)}</p>
                <p className={getApPerDropColor(node.apPerDrop)}>{formatApPerDrop(node.apPerDrop)}</p>
              </div>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded bg-muted">
              <div
                className="h-full rounded bg-sky-400"
                style={{ width: `${Math.min(Math.max(Number.isFinite(node.dropRate) ? node.dropRate * 100 : 0, 0), 100)}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

(`locationLine` joins with " - " exactly as the old `getLocationWarLine`: both parts → "loc - war"; location only → "loc"; war only → "war". The old code dropped a war-only line; showing it is harmless and simpler.)

- [ ] **Step 4: Create `components/materials/MaterialUsagePanel.tsx`**

```tsx
"use client"

import Image from "next/image"
import Link from "next/link"
import { Heart, ListChecks } from "lucide-react"
import { useMemo, useState } from "react"

import { useServants } from "@/app/contexts/HomePageContext"
import type { ItemUsageEntry } from "@/lib/atlas-types"
import { filterUsage, formatUsageBreakdown, type UsageFilter } from "@/lib/item-usage"
import { useCollectionIds } from "@/lib/use-collection-ids"
import { cn } from "@/lib/utils"

const FILTERS: { id: UsageFilter; label: string; icon?: React.ReactNode }[] = [
  { id: "all", label: "All" },
  { id: "tracked", label: "Tracked", icon: <ListChecks className="size-4" aria-hidden="true" /> },
  { id: "favorites", label: "Favorites", icon: <Heart className="size-4" aria-hidden="true" /> },
]

const EMPTY_MESSAGE: Record<UsageFilter, string> = {
  all: "Not used for servant upgrades",
  tracked: "None of your tracked servants use this",
  favorites: "None of your favorite servants use this",
}

interface MaterialUsagePanelProps {
  usage: ItemUsageEntry[]
  status: "loading" | "ready" | "error"
  onRetry: () => void
}

export function MaterialUsagePanel({ usage, status, onRetry }: MaterialUsagePanelProps) {
  const { servants } = useServants()
  const { favoriteIds, trackedIds } = useCollectionIds()
  const [filter, setFilter] = useState<UsageFilter>("all")

  const servantById = useMemo(() => new Map(servants.map((servant) => [servant.id, servant])), [servants])
  // A Map key iterator is single-use, so each filterUsage call gets a fresh one.
  const byFilter = Object.fromEntries(
    FILTERS.map(({ id }) => [
      id,
      filterUsage(usage, id, { trackedIds, favoriteIds, knownServantIds: servantById.keys() }),
    ])
  ) as Record<UsageFilter, ItemUsageEntry[]>
  const visible = byFilter[filter]

  if (status === "loading") return <div className="h-40 animate-pulse rounded-lg bg-card/60" />
  if (status === "error") {
    return (
      <p className="text-sm text-rose-300">
        Couldn&apos;t load item data.{" "}
        <button type="button" onClick={onRetry} className="underline underline-offset-4">
          Retry
        </button>
      </p>
    )
  }

  return (
    <div className="space-y-4 rounded-lg bg-card/60 p-4">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter servants">
        {FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={filter === option.id}
            onClick={() => setFilter(option.id)}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors",
              filter === option.id ? "bg-foreground text-background" : "bg-muted text-foreground/80 hover:bg-muted/70"
            )}
          >
            {option.icon}
            {option.label}
            <span className="tabular-nums opacity-70">{byFilter[option.id].length}</span>
          </button>
        ))}
      </div>

      {visible.length ? (
        <>
          <p className="text-sm text-muted-foreground">
            Used by {visible.length} servant{visible.length === 1 ? "" : "s"}
          </p>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-3">
            {visible.map((entry) => {
              const servant = servantById.get(entry.servantId)
              if (!servant) return null
              const label = `${servant.name}: ${formatUsageBreakdown(entry)}`
              return (
                <li key={entry.servantId}>
                  <Link
                    href={`/servantpage/${entry.servantId}#materials`}
                    title={label}
                    aria-label={label}
                    className="group relative block aspect-square overflow-hidden rounded-full border-2 border-transparent bg-muted transition hover:border-foreground/60"
                  >
                    {servant.portrait ? (
                      <Image src={servant.portrait} alt="" fill sizes="80px" className="object-cover" />
                    ) : null}
                    <span className="absolute inset-x-0 bottom-0 bg-background/80 py-0.5 text-center text-xs font-semibold tabular-nums">
                      ×{entry.total.toLocaleString("en-US")}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">{EMPTY_MESSAGE[filter]}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Create `components/materials/MaterialDetail.tsx`**

```tsx
"use client"

import Image from "next/image"

import { itemBackgroundClass } from "@/components/materials/itemBackground"
import { MaterialSourcesList } from "@/components/materials/MaterialSourcesList"
import { MaterialUsagePanel } from "@/components/materials/MaterialUsagePanel"
import { OwnedQuantityControl } from "@/components/materials/OwnedQuantityControl"
import { ServantTabs } from "@/components/servantPage/ServantTabs"
import type { MaterialIndexEntry } from "@/lib/atlas-types"
import { useItemFile } from "@/lib/use-item-file"
import { cn } from "@/lib/utils"

const RARITY_BADGE: Record<string, string> = {
  bronze: "bg-amber-800/40 text-amber-200",
  silver: "bg-slate-400/25 text-slate-100",
  gold: "bg-yellow-500/25 text-yellow-200",
}

export function MaterialDetail({ material }: { material: MaterialIndexEntry }) {
  const itemFile = useItemFile(material.id)

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <header className="space-y-2">
        <h1 className="font-serif text-4xl font-bold italic tracking-tight text-foreground sm:text-5xl">
          {material.name}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base text-foreground/85">{material.category}</span>
          {material.background ? (
            <span
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold capitalize",
                RARITY_BADGE[material.background] ?? "bg-muted text-foreground/80"
              )}
            >
              {material.background}
            </span>
          ) : null}
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <div className={cn("grid aspect-square place-items-center rounded-lg", itemBackgroundClass(material.background))}>
          <Image src={material.icon} alt={material.name} width={112} height={112} priority className="object-contain" />
        </div>
        <p className="rounded-lg bg-card/60 p-4 text-base leading-relaxed text-foreground/90">
          {material.detail || "No description."}
        </p>
      </div>

      <OwnedQuantityControl itemId={material.id} />

      <ServantTabs
        tabs={[
          {
            id: "usage",
            label: "Usage",
            content: <MaterialUsagePanel usage={itemFile.usage} status={itemFile.status} onRetry={itemFile.retry} />,
          },
          {
            id: "sources",
            label: "Sources",
            content: (
              <MaterialSourcesList
                itemId={material.id}
                nodes={itemFile.nodes}
                status={itemFile.status}
                onRetry={itemFile.retry}
              />
            ),
          },
        ]}
      />
    </div>
  )
}
```

- [ ] **Step 6: Delete the old card**

```bash
git rm components/materials/MaterialFarmingCard.tsx
```

- [ ] **Step 7: Typecheck new files**

Run: `npx tsc --noEmit 2>&1 | grep -v "app/material/"`
Expected: no output (the only remaining error is `app/material/[itemId]/page.tsx` importing the deleted card, fixed in Task 6).

- [ ] **Step 8: Commit** (together with Task 6, since the tree does not build in between)

Continue to Task 6, then commit both.

---

### Task 6: Item browser routes and link cleanup

**Files:**
- Create: `components/materials/ItemGrid.tsx`
- Create: `components/materials/ItemBrowser.tsx`
- Rewrite: `app/material/[itemId]/page.tsx`
- Rewrite: `app/items/page.tsx`
- Modify: `app/track-materials/page.tsx` (material link)
- Modify: `components/servantPage/MaterialsSection.tsx` (links)
- Modify: `app/servantpage/[id]/page.tsx` (drop `returnTab`)

**Interfaces:**
- Consumes: `MaterialDetail` (Task 5), `itemBackgroundClass` (Task 5), `getMaterialsIndex`, `getMaterial` (Task 4).
- Produces: `ItemBrowser({ items, selected }: { items: MaterialIndexEntry[]; selected?: MaterialIndexEntry })`.

- [ ] **Step 1: Create `components/materials/ItemGrid.tsx`**

```tsx
"use client"

import Image from "next/image"
import Link from "next/link"
import { Search } from "lucide-react"
import { useState } from "react"

import { itemBackgroundClass } from "@/components/materials/itemBackground"
import { Input } from "@/components/ui/input"
import type { MaterialIndexEntry } from "@/lib/atlas-types"
import { cn } from "@/lib/utils"

export function ItemGrid({ items, selectedId }: { items: MaterialIndexEntry[]; selectedId?: number }) {
  const [query, setQuery] = useState("")
  const search = query.trim().toLowerCase()
  const visible = search ? items.filter((item) => item.name.toLowerCase().includes(search)) : items

  return (
    <div className="flex h-full min-h-0 w-full flex-col rounded-xl border border-border bg-card/60">
      <div className="p-3">
        <label className="relative block">
          <span className="sr-only">Search items</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search items..."
            className="h-10 rounded-full pl-9"
          />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {visible.length ? (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
            {visible.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/material/${item.id}`}
                  aria-current={item.id === selectedId ? "page" : undefined}
                  className={cn(
                    "flex h-full flex-col overflow-hidden rounded-md border-2 bg-card transition-colors hover:border-foreground/40",
                    item.id === selectedId ? "border-foreground" : "border-transparent"
                  )}
                >
                  <span className={cn("relative grid aspect-square place-items-center", itemBackgroundClass(item.background))}>
                    <Image src={item.icon} alt="" width={64} height={64} className="object-contain" />
                  </span>
                  <span className="line-clamp-2 px-1 py-1 text-center text-xs font-medium leading-tight text-foreground">
                    {item.name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">No items match</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `components/materials/ItemBrowser.tsx`**

```tsx
"use client"

import { Boxes } from "lucide-react"
import { useState } from "react"

import { ItemGrid } from "@/components/materials/ItemGrid"
import { MaterialDetail } from "@/components/materials/MaterialDetail"
import type { MaterialIndexEntry } from "@/lib/atlas-types"
import { cn } from "@/lib/utils"

export function ItemBrowser({ items, selected }: { items: MaterialIndexEntry[]; selected?: MaterialIndexEntry }) {
  // Mobile: the grid is the page when nothing is selected, otherwise it collapses behind a toggle.
  const [mobileGridOpen, setMobileGridOpen] = useState(!selected)

  return (
    <main className="mx-auto grid w-full max-w-[1600px] gap-4 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-6 lg:px-8">
      {selected ? (
        <button
          type="button"
          aria-expanded={mobileGridOpen}
          onClick={() => setMobileGridOpen((open) => !open)}
          className="flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-card text-sm font-medium lg:hidden"
        >
          <Boxes className="size-4" aria-hidden="true" />
          {mobileGridOpen ? "Hide items" : "All items"}
        </button>
      ) : null}

      <aside
        className={cn(
          "max-h-[70vh] lg:sticky lg:top-22 lg:flex lg:h-[calc(100vh-7rem)] lg:max-h-none",
          mobileGridOpen ? "flex" : "hidden"
        )}
      >
        <ItemGrid items={items} selectedId={selected?.id} />
      </aside>

      <section className="min-w-0">
        {selected ? (
          <MaterialDetail key={selected.id} material={selected} />
        ) : (
          <div className="hidden h-60 place-items-center rounded-xl border border-dashed border-border text-sm text-muted-foreground lg:grid">
            Pick an item to see its usage and sources
          </div>
        )}
      </section>
    </main>
  )
}
```

- [ ] **Step 3: Rewrite `app/material/[itemId]/page.tsx`**

```tsx
import { notFound } from "next/navigation"

import { ItemBrowser } from "@/components/materials/ItemBrowser"
import { getMaterial, getMaterialsIndex } from "@/lib/atlas-data"

interface MaterialPageProps {
  params: Promise<{ itemId: string }>
}

export const dynamicParams = false

export function generateStaticParams() {
  return getMaterialsIndex().map((material) => ({ itemId: String(material.id) }))
}

export default async function MaterialPage({ params }: MaterialPageProps) {
  const { itemId } = await params
  const material = getMaterial(Number(itemId))
  if (!material) notFound()

  return <ItemBrowser items={getMaterialsIndex()} selected={material} />
}
```

- [ ] **Step 4: Rewrite `app/items/page.tsx`**

```tsx
import { ItemBrowser } from "@/components/materials/ItemBrowser"
import { getMaterialsIndex } from "@/lib/atlas-data"

export default function ItemsPage() {
  return <ItemBrowser items={getMaterialsIndex()} />
}
```

- [ ] **Step 5: Simplify links**

`app/track-materials/page.tsx` — replace

```tsx
                  href={`/material/${material.id}?name=${encodeURIComponent(material.name)}&icon=${encodeURIComponent(material.icon)}&returnTo=${encodeURIComponent("/track-materials")}`}
```

with

```tsx
                  href={`/material/${material.id}`}
```

`components/servantPage/MaterialsSection.tsx`:
- Delete `normalizeMaterialDetail` and replace `getMaterialHref` with:

```tsx
function getMaterialHref(material: { id?: number }) {
  return material.id ? `/material/${material.id}#usage` : null
}
```

- Delete `useReturnTo` and the `usePathname` import.
- `MaterialTableProps`: remove `returnTo: string`; `MaterialTable({ rows, returnTo })` → `MaterialTable({ rows })`; every `getMaterialHref(material, returnTo)` → `getMaterialHref(material)`.
- `MaterialsSectionProps`: remove `returnTab?: string` and its comment.
- In `MaterialsSection`, delete `const returnTo = useReturnTo(props.returnTab)` and change `<MaterialTable rows={activeTab.rows} returnTo={returnTo} />` → `<MaterialTable rows={activeTab.rows} />`.
- In `MaterialsSummarySection`, remove `returnTab,` from the destructuring and delete `const returnTo = useReturnTo(returnTab)`.

`app/servantpage/[id]/page.tsx` — `<MaterialsSection {...materials} returnTab="materials" />` → `<MaterialsSection {...materials} />` and `<MaterialsSummarySection {...materials} returnTab="summary" />` → `<MaterialsSummarySection {...materials} />`.

Run: `grep -rn "returnTo\|returnTab\|?name=" app components lib`
Expected: no output.

- [ ] **Step 6: Verify**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: tests pass; no type errors; build route table shows `● /material/[itemId]` (SSG, ~138 paths) and `○ /items`.

- [ ] **Step 7: Commit Tasks 5 + 6**

```bash
git add components/materials app/material app/items app/track-materials/page.tsx components/servantPage/MaterialsSection.tsx "app/servantpage/[id]/page.tsx"
git commit -m "feat(items): item browser with owned stepper and Usage/Sources tabs"
```

---

### Task 7: Browser verification and PR

**Files:** none (verification only; fix and amend into Task 5/6 commits' follow-up commit if something fails).

- [ ] **Step 1: Start the production build**

Use the `next-start` preview config (`.claude/launch.json`, autoPort) after `npm run build`.

- [ ] **Step 2: Desktop checks (1440×900)**

1. `/items` — grid of ~138 tiles tinted by rarity; right side shows "Pick an item…".
2. Search "gem" — only gem items remain.
3. Click "Void's Dust" (6503) → URL `/material/6503`, tile highlighted, header shows name, category from the index, rarity badge, icon, description.
4. Owned stepper: click + three times → 3. Hold + ≥2 s → value climbs, jumps by 10 after ~1 s; move the pointer off the button while holding → stops (Review Focus 2). Type `-5` → 0; type `abc` → 0 (Review Focus 1). Reload → value persists. Open `/track-materials` → same owned value for Void's Dust.
5. Usage tab (default) — faces with ×N badges, sorted high → low; hover title shows breakdown. Chips show counts; Tracked/Favorites filter correctly (favorite a servant first if none). Click a face → `/servantpage/{id}#materials` opens the Materials tab.
6. `/material/6503#sources` → Sources tab active; nodes listed with AP/drop colors.
7. From a servant page Materials tab, click an item → lands on `/material/{id}#usage`.
8. An item with no usage and no nodes (pick an `eventItem` id from `materials-index.json` whose `items/{id}.json` has empty `nodes` and `usage`; find with `node -e 'const m=require("./public/data/materials-index.json");for(const x of m){const f=require("./public/data/items/"+x.id+".json");if(!f.nodes.length&&!f.usage.length){console.log(x.id,x.name);break}}'`) → both empty states, no error (Review Focus 3). If none exists, note it and check an item with usage but no nodes instead.
9. `/material/6503?name=Old&icon=x&returnTo=/items` → renders Void's Dust normally (Review Focus 5).
10. `/material/424242` → 404.

- [ ] **Step 3: Mobile checks (375×812)**

`/items` shows the grid; tap an item → detail with "All items" toggle; toggle opens the grid; stepper buttons usable; Usage faces wrap.

- [ ] **Step 4: Final verification**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: all green.

- [ ] **Step 5: Push and open PR against `main`**

```bash
git push -u origin feat/material-page-revamp
gh pr create --repo Alanzo1/Chaldea-Material-Tracker --base main --head feat/material-page-revamp \
  --title "Item browser: owned stepper, Usage and Sources tabs" --body-file <body>
```

PR body: summary of data changes (`items/` layout, index fields), page changes, test plan from Steps 2–3, and the rollout note (daily refresh may conflict on `public/data`; resolve by merging `main` + `npm run data:refresh`).
