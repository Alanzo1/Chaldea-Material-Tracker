# Static Atlas Data Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every Atlas Academy API call out of the Vercel runtime and build into a daily GitHub Action that commits trimmed static JSON, so Vercel only serves pages + static files from CDN.

**Architecture:** A dependency-free Node pipeline (`scripts/atlas/*.mjs`) downloads Atlas exports + quest-phase drops, transforms them into `public/data/**.json`, validates, and replaces the directory only after validation passes. A daily GitHub Action runs it and commits only if output changed; the commit triggers Vercel's normal Git deploy. App server pages read the JSON from disk/imports at build time; client components fetch `/data/*.json` from the CDN. All `app/api/atlas/*` routes and `app/services/api.tsx` are deleted.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Node 24 (`node --test`, built-in `fetch`), GitHub Actions, Vercel.

**Spec:** User's architecture sketch (no spec file), verbatim:

```
GitHub Action (cron, daily)
  → fetch Atlas exports
  → trim/transform → data/*.json
  → commit or trigger Vercel deploy hook
Vercel
  → serves pages + static JSON from CDN
  → zero runtime calls to Atlas
Images → static.atlasacademy.io (or mirror, see below)
```

## Codebase vs. sketch (current state)

| Sketch item | Today | Gap |
|---|---|---|
| Action fetches Atlas exports | `scripts/build-drop-data.mjs` fetches `nice_war.json` + quest phases, run via `prebuild` on **every Vercel build** | No `.github/`; only drop data is prebuilt |
| trim/transform → `data/*.json` | Only `data/drop-data.json` (committed, last updated Jun 12) | Servant index, servant detail, materials index all fetched at request time |
| commit or deploy hook | Nothing | Chosen: **commit** (per-servant files → small diffs; Vercel Git integration deploys on push; no deploy-hook secret needed) |
| Static JSON from CDN | Client fetches `/api/atlas/*` route handlers (serverless + `unstable_cache`) | Replace with `/data/*.json` in `public/` |
| Zero runtime Atlas calls | `app/services/api.tsx` fetches `export/NA/nice_servant.json` (45 MB) and `nice/NA/svt/{id}`; `materials-index` route fetches `nice_item.json`; `material-farming` route fetches `nice_war.json` (20 MB) for label enrichment | All move into the pipeline |
| Images → static.atlasacademy.io | URLs already point there, but `next/image` + `remotePatterns` routes them through Vercel Image Optimization | **Left as-is.** `images.unoptimized: true` would skip the Vercel proxy but make pages heavier (full-size art) and move traffic onto Atlas bandwidth. Revisit only if the Vercel image-optimization quota is actually hit |
| "(or mirror, see below)" | — | The "below" section wasn't provided. Mirror is **out of scope** for this plan |

## Global Constraints

- Region: `NA` only (matches current code).
- Node 24 (`actions/setup-node` `node-version: 24`); local is v24.13.0.
- Pipeline uses **only Node built-ins** — no new npm dependencies anywhere.
- Be polite to Atlas: quest-phase concurrency **8**; every request sends `User-Agent: Chaldea-Material-Tracker (+https://github.com/Alanzo1/Chaldea-Material-Tracker)`.
- Client components never import `lib/atlas-data.ts` (it uses `node:fs`); shared types live in `lib/atlas-types.ts`.
- App code (`app/`, `components/`, `lib/`) must contain zero references to `api.atlasacademy.io` or `/api/atlas`.
- Images keep loading from `https://static.atlasacademy.io`.
- Pipeline output must be **byte-deterministic** for identical Atlas input (no timestamps, stable sort with tiebreaks) so the daily job doesn't produce no-op commits.
- A failed or suspicious pipeline run must exit non-zero and leave `public/data/` untouched.
- Output file shapes (consumed by app):
  - `public/data/servants-index.json` — `ServantIndexEntry[]`
  - `public/data/servants/{id}.json` — `ServantDetail` object
  - `public/data/materials-index.json` — `{ id, name, icon }[]`
  - `public/data/farming/{itemId}.json` — `{ nodes: FarmingNode[] }`

## Review Focus

1. **Nondeterministic drop ordering** — quest-phase fetches complete in random order; ties in `apPerDrop` must not reorder between runs, or the Action commits noise daily. Test: `aggregateDrops` output identical for shuffled input (Task 3).
2. **Partial Atlas outage** — current script swallows failed quest-phase fetches and writes thinner data. Expected: >5% quest-phase failures, or a >5% drop vs. the previous run in servant, material, or farmed-item count, aborts the run with no write. Test: `validateDataset` (Task 4).
3. **Servant added/removed upstream** — stale `servants/{id}.json` must disappear; every index entry must have a detail file. Test: `writeDataset` removes stale files + validation of detail coverage (Task 4).
4. **Material with no farming nodes** (lore, QP, event mats) — farming card should show empty state, not an error. Test: pipeline writes `{nodes:[]}` for every material-index item; card treats 404 as empty (Tasks 3, 6).
5. **Unknown servant id URL** (`/servantpage/999`) — expected 404, today it throws → 500. Covered by `dynamicParams = false` + manual check in Task 5.

---

## File Structure

**Create**
- `scripts/atlas/fetch.mjs` — `fetchJson` (timeout + retry), `mapWithConcurrency`.
- `scripts/atlas/materials.mjs` — materials index transform (ported from `app/api/atlas/materials-index/route.ts`).
- `scripts/atlas/servants.mjs` — servants index transform (ported from `app/services/api.tsx`) + detail trim.
- `scripts/atlas/farming.mjs` — farmable quest selection, drop aggregation, quest-meta enrichment, training-ground nodes, default node selection (ported from `scripts/build-drop-data.mjs` + `app/api/atlas/material-farming/route.ts`).
- `scripts/atlas/dataset.mjs` — `validateDataset`, `writeDataset`.
- `scripts/atlas/build.mjs` — CLI orchestrator.
- `scripts/atlas/*.test.mjs` — `node --test` tests.
- `lib/atlas-types.ts` — shared data types (safe for client imports).
- `lib/atlas-data.ts` — server-only readers for the static data (uses `node:fs`).
- `.github/workflows/refresh-atlas-data.yml`
- `public/data/**` — generated, committed.

**Modify**
- `package.json` — drop `prebuild`/`build:drops`, add `data:refresh`, `test`.
- `app/page.tsx`, `app/favorites/page.tsx`, `app/filter/[filterType]/[filterValue]/page.tsx`, `app/servantpage/[id]/page.tsx` — read static data.
- `app/track-materials/page.tsx`, `components/materials/MaterialFarmingCard.tsx` — fetch `/data/*.json`.
- `README.md`

**Delete**
- `app/api/atlas/` (all 4 routes), `app/services/api.tsx`, `scripts/build-drop-data.mjs`, `data/drop-data.json`.

---

### Task 1: Pipeline foundation — fetch helpers + materials index

**Files:**
- Create: `scripts/atlas/fetch.mjs`, `scripts/atlas/materials.mjs`
- Test: `scripts/atlas/fetch.test.mjs`, `scripts/atlas/materials.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces:
  - `fetchJson(url: string, opts?: { timeoutMs?: number, retries?: number }) => Promise<any>` — throws after retries.
  - `mapWithConcurrency<T,R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>) => Promise<R[]>` — results in input order.
  - `buildMaterialsIndex(items: AtlasItem[]) => { id: number, name: string, icon: string }[]`

- [ ] **Step 1: Add test script to `package.json`**

In `"scripts"` add:

```json
"test": "node --test \"scripts/atlas/*.test.mjs\"",
```

- [ ] **Step 2: Write failing tests**

`scripts/atlas/fetch.test.mjs`:

```js
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
```

`scripts/atlas/materials.test.mjs`:

```js
import { test } from "node:test"
import assert from "node:assert/strict"

import { buildMaterialsIndex } from "./materials.mjs"

test("keeps upgrade materials, dedupes, sorts by name", () => {
  const result = buildMaterialsIndex([
    { id: 6503, name: "Void's Dust", icon: "https://static.atlasacademy.io/a.png", uses: ["skill"] },
    { id: 6001, name: "Gem of Saber", icon: "https://static.atlasacademy.io/b.png", uses: ["ascension"] },
    { id: 6001, name: "Gem of Saber", icon: "https://static.atlasacademy.io/b.png", uses: ["ascension"] },
    { id: 94000001, name: "Event Point", icon: "https://static.atlasacademy.io/c.png", uses: [] },
    { id: 7002, name: "No Icon", icon: "", uses: ["skill"] },
  ])

  assert.deepEqual(result, [
    { id: 6001, name: "Gem of Saber", icon: "https://static.atlasacademy.io/b.png" },
    { id: 6503, name: "Void's Dust", icon: "https://static.atlasacademy.io/a.png" },
  ])
})
```

- [ ] **Step 3: Run tests — expect failure**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../scripts/atlas/fetch.mjs'`

- [ ] **Step 4: Implement `scripts/atlas/fetch.mjs`**

```js
const DEFAULT_TIMEOUT_MS = 20000
const DEFAULT_RETRIES = 2
// Identify ourselves so Atlas Academy can see (and contact) who is calling.
const USER_AGENT = "Chaldea-Material-Tracker (+https://github.com/Alanzo1/Chaldea-Material-Tracker)"

export async function fetchJson(url, { timeoutMs = DEFAULT_TIMEOUT_MS, retries = DEFAULT_RETRIES } = {}) {
  let lastError
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!response.ok) throw new Error(`Fetch failed (${response.status}): ${url}`)
      return await response.json()
    } catch (error) {
      lastError = error
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt))
      }
    }
  }
  throw lastError
}

export async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length)
  let cursor = 0

  async function worker() {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await fn(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
  return results
}
```

- [ ] **Step 5: Implement `scripts/atlas/materials.mjs`** (logic ported verbatim from `app/api/atlas/materials-index/route.ts`)

```js
const UPGRADE_USES = ["skill", "appendSkill", "ascension", "costume"]

function shouldIncludeItem(item) {
  const id = Number(item.id ?? 0)
  if (!id || id === 6999) return true

  const uses = Array.isArray(item.uses) ? item.uses : []
  return uses.some((use) => UPGRADE_USES.includes(String(use)))
}

export function buildMaterialsIndex(items) {
  const seen = new Set()

  return (Array.isArray(items) ? items : [])
    .filter(shouldIncludeItem)
    .map((item) => ({
      id: Number(item.id ?? 0),
      name: String(item.name ?? "").trim(),
      icon: String(item.icon ?? "").trim(),
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

- [ ] **Step 6: Run tests — expect pass**

Run: `npm test`
Expected: 2 tests pass.

- [ ] **Step 7: Commit**

```bash
git add package.json scripts/atlas/fetch.mjs scripts/atlas/fetch.test.mjs scripts/atlas/materials.mjs scripts/atlas/materials.test.mjs
git commit -m "feat(data): add atlas pipeline fetch helpers and materials index transform"
```

---

### Task 2: Servant transforms — index + trimmed detail

**Files:**
- Create: `scripts/atlas/servants.mjs`
- Test: `scripts/atlas/servants.test.mjs`

**Interfaces:**
- Produces:
  - `buildServantsIndex(servants: AtlasServant[]) => ServantIndexEntry[]` where `ServantIndexEntry = { id, name, className, attribute, rarity, portrait, buffs: string[], debuffs: string[], traits: string[], alignments: string[], stars }` — same shape `getServantsHomePageIndex` returns today. Sorted by `id`.
  - `trimServantDetail(servant: AtlasServant) => ServantDetail` — keys: `id, name, className, rarity, attribute, traits, cards, hpMax, atkMax, skills, noblePhantasms, appendPassive, classPassive, ascensionMaterials, skillMaterials, appendSkillMaterials, costumeMaterials, extraAssets: { faces: { ascension }, charaGraph: { ascension, costume } }, portrait: string | null`.

- [ ] **Step 1: Write failing tests** — `scripts/atlas/servants.test.mjs`

```js
import { test } from "node:test"
import assert from "node:assert/strict"

import { buildServantsIndex, trimServantDetail } from "./servants.mjs"

const FACE = "https://static.atlasacademy.io/NA/Faces/f_1000000.png"

function servant(overrides = {}) {
  return {
    id: 100100,
    name: "Altria Pendragon",
    className: "saber",
    attribute: "earth",
    rarity: 5,
    lvMax: 90,
    traits: [
      { id: 1, name: "alignmentLawful" },
      { id: 2, name: "alignmentGood" },
      { id: 3, name: "dragon" },
      { id: 4, name: "classSaber" },
      { id: 5, name: "servant" },
    ],
    cards: ["1", "2", "2", "3", "3"],
    hpMax: 15150,
    atkMax: 11221,
    extraAssets: {
      faces: { ascension: { "1": FACE } },
      charaGraph: { ascension: { "1": "a1.png" }, costume: { "100130": "c.png" } },
      commands: { ascension: { "1": "cmd.png" } },
    },
    skills: [
      {
        id: 1,
        name: "Charisma B",
        functions: [
          {
            funcType: "addState",
            funcTargetType: "ptAll",
            funcTargetTeam: "playerAndEnemy",
            buffs: [{ name: "ATK Up", type: "upAtk" }],
          },
        ],
      },
    ],
    noblePhantasms: [
      {
        id: 2,
        name: "Excalibur",
        functions: [
          {
            funcType: "addState",
            funcTargetType: "enemyAll",
            funcTargetTeam: "enemy",
            buffs: [{ name: "DEF Down", type: "downDefence" }],
            funcPopupText: "DEF Down",
          },
        ],
      },
    ],
    classPassive: [],
    appendPassive: [],
    ascensionMaterials: { "0": { items: [], qp: 100000 } },
    skillMaterials: {},
    appendSkillMaterials: {},
    costumeMaterials: {},
    ...overrides,
  }
}

test("buildServantsIndex drops servants without a first-ascension face", () => {
  const noFace = servant({ id: 9, extraAssets: { faces: { ascension: {} } } })
  assert.deepEqual(buildServantsIndex([noFace]), [])
})

test("buildServantsIndex produces home page entries", () => {
  const [entry] = buildServantsIndex([servant()])

  assert.equal(entry.id, 100100)
  assert.equal(entry.className, "Saber")
  assert.equal(entry.attribute, "Earth")
  assert.equal(entry.portrait, FACE)
  assert.equal(entry.stars, "★★★★★ (5)")
  assert.deepEqual(entry.alignments, ["Lawful", "Good"])
  assert.deepEqual(entry.traits, ["Dragon"])
  assert.deepEqual(entry.buffs, ["ATK Up"])
  assert.deepEqual(entry.debuffs, ["DEF Down"])
})

test("buildServantsIndex sorts by id regardless of input order", () => {
  const ids = buildServantsIndex([servant({ id: 3 }), servant({ id: 1 }), servant({ id: 2 })]).map((s) => s.id)
  assert.deepEqual(ids, [1, 2, 3])
})

test("trimServantDetail keeps page fields and drops the rest", () => {
  const detail = trimServantDetail(servant())

  assert.equal(detail.portrait, FACE)
  assert.equal(detail.lvMax, undefined)
  assert.equal(detail.extraAssets.commands, undefined)
  assert.deepEqual(detail.extraAssets.charaGraph.costume, { "100130": "c.png" })
  assert.equal(detail.skills[0].name, "Charisma B")
  assert.deepEqual(detail.ascensionMaterials, { "0": { items: [], qp: 100000 } })
})
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../scripts/atlas/servants.mjs'`

- [ ] **Step 3: Implement `scripts/atlas/servants.mjs`**

The index logic is a type-stripped port of `transformServantsForHomePage` and its helpers in `app/services/api.tsx:1-248`. Keep it behavior-identical; the only addition is the final sort by `id`.

```js
function capitalizeFirstLetter(val) {
  return String(val).charAt(0).toUpperCase() + String(val).slice(1)
}

function normalizeEffectLabel(val) {
  return String(val ?? "")
    .toLowerCase()
    .replace(/[\[\]]/g, "")
    .trim()
}

function normalizeSourceName(val) {
  return normalizeEffectLabel(val).replace(/\s+(?:ex|[a-e](?:\+{1,3})?)$/i, "").trim()
}

function normalizePopupText(val) {
  return String(val ?? "").replace(/\s+/g, " ").trim()
}

function shouldExcludeAttackBonusLabel(val) {
  const normalized = normalizeEffectLabel(val)

  return (
    normalized.includes("bonus effect with") ||
    normalized.includes("bonus buff") ||
    normalized.includes("bonus debuff") ||
    normalized.includes("when attacking") ||
    normalized.includes("charge loss")
  )
}

const EXCLUDED_TRAITS = new Set([
  "servant",
  "canBeInBattle",
  "weakToEnumaElish",
  "standardClassServant",
  "hominidaeServant",
  "oneStarServant",
  "twoStarServant",
  "threeStarServant",
  "fourStarServant",
  "fiveStarServant",
  "unknown",
])

const STATE_FUNC_TYPES = [
  "addState",
  "addStateShort",
  "gainHp",
  "gainNp",
  "gainStar",
  "regainHp",
  "regainNp",
  "regainStar",
  "instantDeath",
  "lossHpSafe",
]

const NON_STATE_LABELS = {
  gainHp: "Heal",
  gainNp: "NP Charge",
  gainStar: "Critical Stars",
  regainHp: "HP Regen",
  regainNp: "NP Regen",
  regainStar: "Star Regen",
  instantDeath: "Death",
  lossHpSafe: "HP Loss",
}

const CARD_EFFECT_LABELS = {
  cardBuster: "Buster Up",
  cardArts: "Arts Up",
  cardQuick: "Quick Up",
  cardExtra: "Extra Attack Up",
  cardNP: "NP Damage Up",
}

const TYPE_EFFECT_LABELS = {
  gutsFunction: "Buff (Trigger Guts)",
  guts: "Guts",
  gutsRatio: "Guts",
  upAtk: "ATK Up",
  upDefence: "DEF Up",
  upTolerance: "Debuff Resist Up",
  upCriticaldamage: "Critical Up",
  upCriticalrate: "Critical Hit Rate Up",
  upCriticalpoint: "C. Star Drop Rate Up",
  avoidState: "Debuff Immune",
  avoidInstantdeath: "Immune to Death",
  regainHp: "HP Regen",
  regainNp: "NP Regen",
  regainStar: "Star Regen",
}

function toTitleCase(val) {
  return String(val ?? "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function getEffectsFromDetail(val) {
  const normalized = normalizeEffectLabel(val)
  const effects = new Set()

  if (normalized.includes("apply evade")) effects.add("Evade")
  if (normalized.includes("apply invincible")) effects.add("Invincible")
  if (normalized.includes("apply guts")) effects.add("Guts")

  return [...effects]
}

function getCanonicalBuffEffects(buff, func) {
  if (!buff || buff.type === "upDamage") return []

  const traitNames = [
    ...(buff.tvals ?? []),
    ...(buff.ckSelfIndv ?? []),
    ...(buff.ckOpIndv ?? []),
  ].map((trait) => trait?.name).filter(Boolean)

  if (buff.type === "avoidance") return ["Evade"]
  if (buff.type === "invincible") return ["Invincible"]

  if (buff.type === "selfturnendFunction" || buff.type === "commandattackAfterFunction") {
    const delayedEffects = getEffectsFromDetail(buff.detail)
    if (delayedEffects.length) return delayedEffects
  }

  if (buff.type === "upCommandall") {
    const cardTrait = traitNames.find((trait) => CARD_EFFECT_LABELS[trait])
    if (cardTrait) return [CARD_EFFECT_LABELS[cardTrait]]
  }

  if (TYPE_EFFECT_LABELS[buff.type]) return [TYPE_EFFECT_LABELS[buff.type]]

  const popupText = normalizePopupText(func?.funcPopupText)
  if (popupText && popupText.toLowerCase() !== "none") return [popupText]

  if (buff.name?.startsWith("Activate when")) return ["Buff (Trigger Guts)"]

  return []
}

function collectEffects(servant) {
  const buffSet = new Set()
  const debuffSet = new Set()
  const allSources = [...(servant.skills ?? []), ...(servant.noblePhantasms ?? [])]

  allSources.forEach((source) => {
    const sourceName = normalizeSourceName(source.name)

    source.functions?.forEach((func) => {
      if (!STATE_FUNC_TYPES.includes(func.funcType)) return

      const targetType = func.funcTargetType ?? ""
      const targetTeam = func.funcTargetTeam ?? ""
      const isAllyTargetType =
        targetType === "self" || targetType === "player" || targetType.startsWith("pt")
      const targetsAlly = isAllyTargetType || targetTeam === "player"
      const targetsEnemy =
        targetType.startsWith("enemy") || (!isAllyTargetType && targetTeam === "enemy")

      if (func.funcType !== "addState" && func.funcType !== "addStateShort") {
        const name = NON_STATE_LABELS[func.funcType]
        if (name) {
          if (targetsAlly) buffSet.add(name)
          if (targetsEnemy) debuffSet.add(name)
        }
        return
      }

      const buffs = func.buffs ?? []

      if (!buffs.length) {
        const popupText = normalizePopupText(func.funcPopupText)
        if (popupText && popupText.toLowerCase() !== "none" && !shouldExcludeAttackBonusLabel(popupText)) {
          if (targetsAlly) buffSet.add(popupText)
          if (targetsEnemy) debuffSet.add(popupText)
        }
        return
      }

      buffs.forEach((b) => {
        if (!b?.name) return

        const buffName = normalizeEffectLabel(b.name)
        const canonicalEffects = getCanonicalBuffEffects(b, func)

        if (canonicalEffects.length) {
          canonicalEffects.forEach((effect) => {
            if (shouldExcludeAttackBonusLabel(effect)) return
            if (targetsAlly) buffSet.add(effect)
            if (targetsEnemy) debuffSet.add(effect)
          })
          return
        }

        if (shouldExcludeAttackBonusLabel(b.name)) return
        if (sourceName && buffName === sourceName) return

        if (targetsAlly) buffSet.add(b.name)
        if (targetsEnemy) debuffSet.add(b.name)
      })
    })
  })

  return { buffs: [...buffSet], debuffs: [...debuffSet] }
}

export function buildServantsIndex(servants) {
  return (Array.isArray(servants) ? servants : [])
    .filter((servant) => servant.extraAssets?.faces?.ascension?.["1"])
    .map((servant) => {
      const traitNames = (servant.traits ?? [])
        .map((trait) => String(trait?.name ?? ""))
        .filter(Boolean)
      const alignments = traitNames
        .filter((trait) => trait.startsWith("alignment"))
        .map((trait) => toTitleCase(trait.replace(/^alignment/, "")))
      const traits = traitNames
        .filter((trait) =>
          !trait.startsWith("alignment") &&
          !trait.startsWith("class") &&
          !trait.startsWith("attribute") &&
          !trait.startsWith("gender") &&
          !EXCLUDED_TRAITS.has(trait)
        )
        .map((trait) => toTitleCase(trait))
      const { buffs, debuffs } = collectEffects(servant)

      return {
        id: servant.id,
        name: servant.name,
        className: capitalizeFirstLetter(servant.className),
        attribute: toTitleCase(servant.attribute),
        rarity: servant.rarity,
        portrait: servant.extraAssets.faces.ascension["1"],
        buffs,
        debuffs,
        traits,
        alignments,
        stars: `${"★".repeat(servant.rarity)} (${servant.rarity})`,
      }
    })
    .sort((a, b) => a.id - b.id)
}

const DETAIL_KEYS = [
  "id",
  "name",
  "className",
  "rarity",
  "attribute",
  "traits",
  "cards",
  "hpMax",
  "atkMax",
  "skills",
  "noblePhantasms",
  "appendPassive",
  "classPassive",
  "ascensionMaterials",
  "skillMaterials",
  "appendSkillMaterials",
  "costumeMaterials",
]

export function trimServantDetail(servant) {
  const detail = {}
  for (const key of DETAIL_KEYS) {
    if (servant[key] !== undefined) detail[key] = servant[key]
  }

  const faces = servant.extraAssets?.faces?.ascension ?? {}
  const charaGraph = servant.extraAssets?.charaGraph ?? {}
  detail.extraAssets = {
    faces: { ascension: faces },
    charaGraph: {
      ascension: charaGraph.ascension ?? {},
      costume: charaGraph.costume ?? {},
    },
  }
  detail.portrait = faces["1"] ?? faces[1] ?? null

  return detail
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test`
Expected: all tests pass (Task 1 + 4 new).

- [ ] **Step 5: Commit**

```bash
git add scripts/atlas/servants.mjs scripts/atlas/servants.test.mjs
git commit -m "feat(data): port servant index transform and detail trim to pipeline"
```

---

### Task 3: Farming transforms — quests, drops, enrichment, node selection

**Files:**
- Create: `scripts/atlas/farming.mjs`
- Test: `scripts/atlas/farming.test.mjs`

**Interfaces:**
- Produces:
  - `selectQuestPhaseJobs(wars) => { questId, phase, warName, locationName, questTitle }[]` — sorted by `questId`, then `phase`.
  - `aggregateDrops(results: { job, detail }[]) => Map<number, FarmingNode[]>` — `detail` is the `/nice/NA/quest/{id}/{phase}` payload or `null`. Output order independent of input order.
  - `buildQuestMeta(wars) => Map<number, { warName, locationName, questTitle }>`
  - `buildFarmingIndex(dropsByItemId: Map<number, FarmingNode[]>, itemIds: number[], questMetaById) => Record<string, FarmingNode[]>` — one key for every id in `itemIds` ∪ `dropsByItemId` keys; each value is the default selection (`minRuns 200`, pinned training nodes first, `max(6, pinnedCount)` entries). Item `6999` → `[]`.
  - `FarmingNode = { id, questName, apCost, dropRate, apPerDrop, runs, warName?, locationName?, questTitle? }`
  - `FARMING_LIMIT = 6` — covers both callers (tracker uses `nodes[0]`, card shows 6). Same ordering the route returns today for `limit=1` and `limit=6`.

- [ ] **Step 1: Write failing tests** — `scripts/atlas/farming.test.mjs`

```js
import { test } from "node:test"
import assert from "node:assert/strict"

import {
  aggregateDrops,
  buildFarmingIndex,
  buildQuestMeta,
  selectQuestPhaseJobs,
} from "./farming.mjs"

const WARS = [
  {
    name: "Fuyuki",
    longName: "Singularity F: Fuyuki",
    spots: [
      {
        name: "Bridge",
        quests: [
          { id: 20, type: "free", consume: 10, phases: [1, 3], name: "Giant Bridge" },
          { id: 10, type: "free", consume: 10, phases: [3], name: "Port" },
          { id: 11, type: "main", consume: 10, phases: [1], name: "Story" },
          { id: 12, type: "free", consume: 0, phases: [1], name: "Free AP" },
          { id: 13, type: "event", consume: 20, phases: [1], name: "Event" },
        ],
      },
    ],
  },
  {
    name: "Chaldea Gate",
    longName: "Chaldea Gate",
    spots: [{ name: "Gate", quests: [{ id: 30, type: "warBoard", consume: 40, phases: [1], name: "Gate Quest" }] }],
  },
]

function job(questId, phase = 1) {
  return { questId, phase, warName: "War", locationName: "Loc", questTitle: `Q${questId}` }
}

function detail(id, consume, drops) {
  return { id, consume, drops }
}

test("selectQuestPhaseJobs keeps free/daily/Chaldea Gate quests, sorted by quest then phase", () => {
  const jobs = selectQuestPhaseJobs(WARS)
  assert.deepEqual(
    jobs.map((j) => [j.questId, j.phase]),
    [[10, 3], [20, 1], [20, 3], [30, 1]]
  )
  assert.equal(jobs[0].warName, "Singularity F: Fuyuki")
  assert.equal(jobs[0].locationName, "Bridge")
})

test("aggregateDrops computes AP per drop and skips invalid rows", () => {
  const drops = aggregateDrops([
    { job: job(1), detail: detail(1, 10, [{ objectId: 6503, runs: 100, dropNum: 50 }]) },
    { job: job(2), detail: detail(2, 10, [{ objectId: 6503, runs: 0, dropNum: 5 }]) },
    { job: job(3), detail: null },
  ])

  assert.deepEqual([...drops.keys()], [6503])
  const [node] = drops.get(6503)
  assert.equal(node.apPerDrop, 20)
  assert.equal(node.dropRate, 0.5)
  assert.equal(node.questName, "Loc - Q1")
})

test("aggregateDrops output does not depend on fetch completion order", () => {
  const results = [
    { job: job(5), detail: detail(5, 10, [{ objectId: 1, runs: 100, dropNum: 50 }]) },
    { job: job(4), detail: detail(4, 10, [{ objectId: 1, runs: 100, dropNum: 50 }]) },
    { job: job(6), detail: detail(6, 10, [{ objectId: 1, runs: 100, dropNum: 25 }]) },
  ]
  const forward = JSON.stringify([...aggregateDrops(results)])
  const reversed = JSON.stringify([...aggregateDrops([...results].reverse())])

  assert.equal(forward, reversed)
  assert.deepEqual(aggregateDrops(results).get(1).map((n) => n.id), [4, 5, 6])
})

test("aggregateDrops keeps the better phase of the same quest", () => {
  const drops = aggregateDrops([
    { job: job(7, 1), detail: detail(7, 10, [{ objectId: 1, runs: 100, dropNum: 10 }]) },
    { job: job(7, 3), detail: detail(7, 10, [{ objectId: 1, runs: 100, dropNum: 50 }]) },
  ])
  assert.equal(drops.get(1).length, 1)
  assert.equal(drops.get(1)[0].apPerDrop, 20)
})

test("buildFarmingIndex pins Saber training grounds first for Gem of Saber", () => {
  const drops = new Map([
    [6001, [{ id: 99, questName: "A - B", apCost: 10, dropRate: 1, apPerDrop: 10, runs: 500 }]],
  ])
  const index = buildFarmingIndex(drops, [6001], new Map())
  const names = index["6001"].map((n) => n.questName)

  assert.equal(names.length, 5)
  assert.ok(names[0].startsWith("Saber Training Ground"))
  assert.equal(names[4], "A - B")
})

test("buildFarmingIndex filters low-sample nodes, caps at 6, emits empty lists", () => {
  const many = Array.from({ length: 10 }, (_, i) => ({
    id: 100 + i,
    questName: `Loc - Q${i}`,
    apCost: 10,
    dropRate: 1 / (i + 1),
    apPerDrop: 10 * (i + 1),
    runs: i === 0 ? 50 : 500,
  }))
  const index = buildFarmingIndex(new Map([[6503, many]]), [6503, 6999, 1234], new Map())

  assert.equal(index["6503"].length, 6)
  assert.equal(index["6503"][0].id, 101)
  assert.deepEqual(index["6999"], [])
  assert.deepEqual(index["1234"], [])
})

test("buildFarmingIndex fills missing labels from quest meta and drops dash-only labels", () => {
  const drops = new Map([
    [6503, [{ id: 20, questName: "—", apCost: 10, dropRate: 1, apPerDrop: 10, runs: 500, locationName: "—" }]],
  ])
  const [node] = buildFarmingIndex(drops, [], buildQuestMeta(WARS))["6503"]

  assert.equal(node.locationName, "Bridge")
  assert.equal(node.questTitle, "Giant Bridge")
  assert.equal(node.warName, "Fuyuki")
})
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../scripts/atlas/farming.mjs'`

- [ ] **Step 3: Implement `scripts/atlas/farming.mjs`**

Quest selection + drop math come from `scripts/build-drop-data.mjs:12-60,96-189`; enrichment + selection from `app/api/atlas/material-farming/route.ts:231-477` with `all=false, limit=6, minRuns=200`. Changes vs. originals: pure functions, sorted jobs, `apPerDrop` ties broken by `id` then `questName`.

```js
export const FARMING_LIMIT = 6
const MIN_RUNS = 200
const EXCLUDED_ITEM_IDS = new Set([6999])
const CLASS_NAMES = ["Saber", "Archer", "Lancer", "Rider", "Caster", "Assassin", "Berserker"]
const BLOCKED_QUEST_TYPES = new Set(["main", "friendship", "tutorial", "enemy", "event"])
const DIRECT_FARM_TYPES = new Set(["free", "daily"])

function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function toArray(value) {
  return Array.isArray(value) ? value : []
}

function includesChaldeaGate(value) {
  return String(value ?? "").toLowerCase().includes("chaldea gate")
}

function isFarmableQuest(war, type, consume, questId, phases) {
  if (consume <= 0 || questId <= 0 || phases.length === 0) return false
  if (DIRECT_FARM_TYPES.has(type)) return true
  if (BLOCKED_QUEST_TYPES.has(type)) return false

  // Chaldea Gate often uses non-"free" quest typing but is still repeatable.
  return includesChaldeaGate(war?.name) || includesChaldeaGate(war?.longName)
}

function compareNodes(a, b) {
  return a.apPerDrop - b.apPerDrop || a.id - b.id || a.questName.localeCompare(b.questName)
}

export function selectQuestPhaseJobs(wars) {
  const jobs = []

  for (const war of toArray(wars)) {
    for (const spot of toArray(war?.spots)) {
      for (const quest of toArray(spot?.quests)) {
        const type = String(quest?.type ?? "").toLowerCase()
        const consume = toNumber(quest?.consume)
        const questId = toNumber(quest?.id)
        const phases = toArray(quest?.phases).map(toNumber).filter((phase) => phase > 0)

        if (!isFarmableQuest(war, type, consume, questId, phases)) continue

        for (const phase of phases) {
          jobs.push({
            questId,
            phase,
            warName: String(war?.longName ?? war?.name ?? "").trim(),
            locationName: String(spot?.name ?? "").trim(),
            questTitle: String(quest?.name ?? "").trim(),
          })
        }
      }
    }
  }

  return jobs.sort((a, b) => a.questId - b.questId || a.phase - b.phase)
}

export function aggregateDrops(results) {
  const byItem = new Map()

  for (const { job, detail } of results) {
    if (!detail?.drops?.length) continue

    const apCost = toNumber(detail.consume ?? detail.ap ?? detail.apCost)
    const warName = String(job.warName || "").trim()
    const locationName = String(job.locationName || detail.spotName || "").trim()
    const questTitle = String(job.questTitle || detail.name || "").trim()
    const questName = [locationName, questTitle].filter(Boolean).join(" - ")

    for (const drop of detail.drops) {
      const itemId = toNumber(drop?.objectId ?? drop?.itemId)
      const runs = toNumber(drop?.runs ?? detail?.runs ?? detail?.sampleNum)
      const dropNum = toNumber(drop?.dropNum ?? drop?.dropCount ?? drop?.num)

      if (!itemId || runs <= 0 || dropNum <= 0 || apCost <= 0) continue

      const dropRate = dropNum / runs
      const apPerDrop = apCost / dropRate
      if (!Number.isFinite(apPerDrop) || apPerDrop <= 0) continue

      const node = {
        id: toNumber(detail.id),
        questName: questName || `Quest ${job.questId}`,
        apCost,
        dropRate,
        apPerDrop,
        runs,
        warName: warName || undefined,
        locationName: locationName || undefined,
        questTitle: questTitle || undefined,
      }

      if (!byItem.has(itemId)) byItem.set(itemId, new Map())
      const byQuest = byItem.get(itemId)
      const key = `${node.id}-${node.questName}`
      const existing = byQuest.get(key)
      if (!existing || compareNodes(node, existing) < 0) byQuest.set(key, node)
    }
  }

  const output = new Map()
  for (const itemId of [...byItem.keys()].sort((a, b) => a - b)) {
    output.set(itemId, [...byItem.get(itemId).values()].sort(compareNodes))
  }
  return output
}

function sanitizeLabel(value) {
  const normalized = String(value ?? "").trim()
  if (!normalized) return ""
  if (/^[-‐‑‒–—―ー－\s]+$/u.test(normalized)) return ""
  return normalized
}

function pickPreferredLabel(primary, fallback) {
  return sanitizeLabel(primary) || sanitizeLabel(fallback)
}

export function buildQuestMeta(wars) {
  const questMetaById = new Map()

  for (const war of toArray(wars)) {
    const warName = sanitizeLabel(war?.name) || sanitizeLabel(war?.longName)
    for (const spot of toArray(war?.spots)) {
      const locationName = sanitizeLabel(spot?.name) || sanitizeLabel(spot?.longName)
      for (const quest of toArray(spot?.quests)) {
        const questId = Number(quest?.id)
        if (!Number.isFinite(questId) || questId <= 0 || questMetaById.has(questId)) continue
        questMetaById.set(questId, { warName, locationName, questTitle: sanitizeLabel(quest?.name) })
      }
    }
  }

  return questMetaById
}

function getTrainingGroundNodes(itemId) {
  const itemGroups = [
    [6001, 6007], // Gem of <Class>
    [6101, 6107], // Magic Gem of <Class>
    [6201, 6207], // Secret Gem of <Class>
    [7001, 7007], // <Class> Piece
    [7101, 7107], // <Class> Monument
  ]

  const range = itemGroups.find(([start, end]) => itemId >= start && itemId <= end)
  if (!range) return []

  const classIndex = itemId % 10
  if (classIndex < 1 || classIndex > CLASS_NAMES.length) return []
  const className = CLASS_NAMES[classIndex - 1]

  // APD values follow the benchmark table requested for class materials.
  const templates = [
    { tier: "Intermediate", apCost: 20, apPerDrop: 30 },
    { tier: "Advanced", apCost: 30, apPerDrop: 30 },
    { tier: "Novice", apCost: 10, apPerDrop: 45 },
    { tier: "Expert", apCost: 40, apPerDrop: 55 },
  ]

  return templates.map((template, index) => ({
    id: -(classIndex * 100 + index + 1),
    questName: `${className} Training Ground - ${template.tier} (Sunday - Chaldea Gate)`,
    apCost: template.apCost,
    dropRate: template.apCost / template.apPerDrop,
    apPerDrop: template.apPerDrop,
    // synthetic rows: large runs value so they are not removed by minRuns filtering
    runs: 999999,
    warName: "Chaldea Gate",
    locationName: `Sunday ${className} Training Ground`,
    questTitle: template.tier,
  }))
}

function isPinnedTrainingNode(node) {
  return Number(node.id) < 0 || node.warName === "Chaldea Gate"
}

function normalizeNode(node) {
  const normalizedLocationName = sanitizeLabel(node.locationName)
  const normalizedQuestTitle = sanitizeLabel(node.questTitle)
  const normalizedWarName = sanitizeLabel(node.warName)

  if (normalizedLocationName && normalizedQuestTitle) return node

  const rawQuestName = String(node.questName ?? "").trim()
  const separatorIndex = rawQuestName.indexOf(" - ")
  if (separatorIndex < 0) {
    return {
      ...node,
      warName: normalizedWarName || undefined,
      questTitle: normalizedQuestTitle || sanitizeLabel(rawQuestName),
      locationName: normalizedLocationName || "",
    }
  }

  return {
    ...node,
    warName: normalizedWarName || undefined,
    locationName: normalizedLocationName || sanitizeLabel(rawQuestName.slice(0, separatorIndex)),
    questTitle: normalizedQuestTitle || sanitizeLabel(rawQuestName.slice(separatorIndex + 3)),
  }
}

function enrichWithQuestMeta(node, questMetaById) {
  const questId = Number(node.id)
  if (!Number.isFinite(questId) || questId <= 0) return node

  const metadata = questMetaById.get(questId)
  if (!metadata) return node

  return {
    ...node,
    warName: pickPreferredLabel(node.warName, metadata.warName) || undefined,
    locationName: pickPreferredLabel(node.locationName, metadata.locationName) || undefined,
    questTitle: pickPreferredLabel(node.questTitle, metadata.questTitle) || undefined,
  }
}

function selectNodes(itemId, dropNodes, questMetaById) {
  if (EXCLUDED_ITEM_IDS.has(itemId)) return []

  const rawNodes = [...dropNodes]
  for (const trainingNode of getTrainingGroundNodes(itemId)) {
    if (!rawNodes.some((node) => node.questName === trainingNode.questName)) rawNodes.push(trainingNode)
  }

  const sorted = rawNodes
    .map(normalizeNode)
    .map((node) => enrichWithQuestMeta(node, questMetaById))
    .filter((node) => Number(node.runs ?? 0) >= MIN_RUNS || Number(node.id) <= 0)
    .sort(compareNodes)

  const pinned = sorted.filter(isPinnedTrainingNode)
  const normal = sorted.filter((node) => !isPinnedTrainingNode(node))
  return [...pinned, ...normal].slice(0, Math.max(FARMING_LIMIT, pinned.length))
}

export function buildFarmingIndex(dropsByItemId, itemIds, questMetaById) {
  const allIds = [...new Set([...itemIds, ...dropsByItemId.keys()])].sort((a, b) => a - b)
  const index = {}
  for (const itemId of allIds) {
    index[String(itemId)] = selectNodes(itemId, dropsByItemId.get(itemId) ?? [], questMetaById)
  }
  return index
}
```

Note: `JSON.stringify` drops `undefined` fields, same as today's route output.

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test`
Expected: all tests pass. (Advanced `-102` sorts before Intermediate `-101` on the apPerDrop-30 tie because of the id tiebreak; the test only asserts the first node is a Saber training node.)

- [ ] **Step 5: Commit**

```bash
git add scripts/atlas/farming.mjs scripts/atlas/farming.test.mjs
git commit -m "feat(data): port farming drop aggregation and node selection to pipeline"
```

---

### Task 4: Dataset validation, atomic write, orchestrator; generate data

**Files:**
- Create: `scripts/atlas/dataset.mjs`, `scripts/atlas/build.mjs`
- Test: `scripts/atlas/dataset.test.mjs`
- Modify: `package.json`, `.gitignore`
- Delete: `scripts/build-drop-data.mjs`
- Generated: `public/data/**`

**Interfaces:**
- Consumes: `fetchJson`, `mapWithConcurrency` (Task 1); `buildMaterialsIndex` (Task 1); `buildServantsIndex`, `trimServantDetail` (Task 2); `selectQuestPhaseJobs`, `aggregateDrops`, `buildQuestMeta`, `buildFarmingIndex` (Task 3).
- Produces:
  - `Dataset = { servantsIndex, servantDetails: Map<number, ServantDetail>, materialsIndex, farming: Record<string, FarmingNode[]>, questFetch: { total: number, failed: number } }`
  - `PreviousStats = { servantCount: number, materialCount: number, farmedItemCount: number }` (`farmedItemCount` = farming files with ≥1 node)
  - `validateDataset(dataset: Dataset, previous: PreviousStats | null) => string[]` (empty = OK)
  - `writeDataset(outDir: string, dataset: Dataset) => Promise<void>`
  - `readPreviousStats(outDir: string) => Promise<PreviousStats | null>`
  - CLI: `node scripts/atlas/build.mjs` → writes `public/data/`, exits 1 on any failure.

- [ ] **Step 1: Write failing tests** — `scripts/atlas/dataset.test.mjs`

```js
import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readdir, readFile, mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { readPreviousStats, validateDataset, writeDataset } from "./dataset.mjs"

function dataset({ servants = 400, materials = 200, farmItems = 100, failed = 0 } = {}) {
  const servantsIndex = Array.from({ length: servants }, (_, i) => ({ id: i + 1 }))
  return {
    servantsIndex,
    servantDetails: new Map(servantsIndex.map((s) => [s.id, { id: s.id }])),
    materialsIndex: Array.from({ length: materials }, (_, i) => ({ id: i + 1 })),
    farming: Object.fromEntries(
      Array.from({ length: farmItems }, (_, i) => [String(i + 1), [{ id: 1 }]])
    ),
    questFetch: { total: 1000, failed },
  }
}

test("validateDataset accepts a healthy dataset", () => {
  assert.deepEqual(
    validateDataset(dataset(), { servantCount: 400, materialCount: 200, farmedItemCount: 100 }),
    []
  )
})

const PREVIOUS = { servantCount: 400, materialCount: 200, farmedItemCount: 100 }

test("validateDataset rejects too many quest-phase failures", () => {
  const errors = validateDataset(dataset({ failed: 60 }), null)
  assert.equal(errors.length, 1)
  assert.match(errors[0], /quest phase/)
})

test("validateDataset rejects a servant count drop over 5%", () => {
  const errors = validateDataset(dataset({ servants: 370 }), PREVIOUS)
  assert.match(errors.join("\n"), /servant count/)
})

test("validateDataset rejects a material or farmed-item drop over 5% vs previous run", () => {
  // Above the fixed minimums (100 / 50) but a big drop from the last run: partial outage.
  const errors = validateDataset(
    dataset({ materials: 150, farmItems: 60 }),
    { ...PREVIOUS, materialCount: 500, farmedItemCount: 600 }
  ).join("\n")
  assert.match(errors, /material count dropped/)
  assert.match(errors, /farmed item count dropped/)
})

test("validateDataset rejects index entries without detail", () => {
  const data = dataset()
  data.servantDetails.delete(5)
  assert.match(validateDataset(data, null).join("\n"), /missing detail.*5/)
})

test("writeDataset replaces the directory and removes stale files", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-data-"))
  const outDir = join(root, "data")
  await mkdir(join(outDir, "servants"), { recursive: true })
  await writeFile(join(outDir, "servants", "999.json"), "{}")

  const data = dataset({ servants: 2, materials: 1, farmItems: 1 })
  await writeDataset(outDir, data)

  assert.deepEqual((await readdir(join(outDir, "servants"))).sort(), ["1.json", "2.json"])
  assert.deepEqual(JSON.parse(await readFile(join(outDir, "farming", "1.json"), "utf8")), { nodes: [{ id: 1 }] })
  assert.equal(await readFile(join(outDir, "servants-index.json"), "utf8"), '[{"id":1},{"id":2}]\n')
  assert.deepEqual(await readPreviousStats(outDir), { servantCount: 2, materialCount: 1, farmedItemCount: 1 })
  assert.equal(await readPreviousStats(join(root, "missing")), null)
})
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../scripts/atlas/dataset.mjs'`

- [ ] **Step 3: Implement `scripts/atlas/dataset.mjs`**

```js
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"

const MIN_SERVANTS = 300
const MIN_MATERIALS = 100
const MIN_FARMED_ITEMS = 50
const MAX_QUEST_FAILURE_RATE = 0.05
const MAX_DROP_VS_PREVIOUS = 0.05

function countFarmedItems(farming) {
  return Object.values(farming).filter((nodes) => nodes.length > 0).length
}

export function validateDataset(dataset, previous) {
  const errors = []
  const current = {
    servantCount: dataset.servantsIndex.length,
    materialCount: dataset.materialsIndex.length,
    farmedItemCount: countFarmedItems(dataset.farming),
  }
  const { total, failed } = dataset.questFetch

  if (current.servantCount < MIN_SERVANTS) errors.push(`servant count ${current.servantCount} < ${MIN_SERVANTS}`)
  if (current.materialCount < MIN_MATERIALS) errors.push(`material count ${current.materialCount} < ${MIN_MATERIALS}`)
  if (current.farmedItemCount < MIN_FARMED_ITEMS) {
    errors.push(`farmed item count ${current.farmedItemCount} < ${MIN_FARMED_ITEMS}`)
  }
  if (total > 0 && failed / total > MAX_QUEST_FAILURE_RATE) {
    errors.push(`quest phase fetch failures ${failed}/${total} exceed ${MAX_QUEST_FAILURE_RATE * 100}%`)
  }

  // Fixed minimums miss partial outages (e.g. 600 → 60 farmed items), so also compare to the last run.
  const labels = { servantCount: "servant count", materialCount: "material count", farmedItemCount: "farmed item count" }
  for (const [key, label] of Object.entries(labels)) {
    if (previous && current[key] < previous[key] * (1 - MAX_DROP_VS_PREVIOUS)) {
      errors.push(`${label} dropped from ${previous[key]} to ${current[key]}`)
    }
  }

  const missing = dataset.servantsIndex.filter((s) => !dataset.servantDetails.has(s.id)).map((s) => s.id)
  if (missing.length) errors.push(`missing detail for servants: ${missing.join(", ")}`)

  return errors
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value)}\n`)
}

export async function writeDataset(outDir, dataset) {
  const tmpDir = `${outDir}.tmp`
  await rm(tmpDir, { recursive: true, force: true })
  await mkdir(join(tmpDir, "servants"), { recursive: true })
  await mkdir(join(tmpDir, "farming"), { recursive: true })

  await writeJson(join(tmpDir, "servants-index.json"), dataset.servantsIndex)
  await writeJson(join(tmpDir, "materials-index.json"), dataset.materialsIndex)
  for (const [id, detail] of dataset.servantDetails) {
    await writeJson(join(tmpDir, "servants", `${id}.json`), detail)
  }
  for (const [itemId, nodes] of Object.entries(dataset.farming)) {
    await writeJson(join(tmpDir, "farming", `${itemId}.json`), { nodes })
  }

  await rm(outDir, { recursive: true, force: true })
  await rename(tmpDir, outDir)
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"))
}

export async function readPreviousStats(outDir) {
  try {
    const servants = await readJson(join(outDir, "servants-index.json"))
    const materials = await readJson(join(outDir, "materials-index.json"))
    const farming = {}
    for (const file of await readdir(join(outDir, "farming"))) {
      farming[file] = (await readJson(join(outDir, "farming", file))).nodes ?? []
    }

    return {
      servantCount: servants.length,
      materialCount: materials.length,
      farmedItemCount: countFarmedItems(farming),
    }
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Implement `scripts/atlas/build.mjs`**

```js
import { join } from "node:path"

import { readPreviousStats, validateDataset, writeDataset } from "./dataset.mjs"
import { aggregateDrops, buildFarmingIndex, buildQuestMeta, selectQuestPhaseJobs } from "./farming.mjs"
import { fetchJson, mapWithConcurrency } from "./fetch.mjs"
import { buildMaterialsIndex } from "./materials.mjs"
import { buildServantsIndex, trimServantDetail } from "./servants.mjs"

const REGION = "NA"
const BASE_URL = "https://api.atlasacademy.io"
const EXPORT_URL = (name) => `${BASE_URL}/export/${REGION}/${name}.json`
const QUEST_PHASE_URL = (questId, phase) => `${BASE_URL}/nice/${REGION}/quest/${questId}/${phase}`
const QUEST_CONCURRENCY = 8
const OUT_DIR = join(process.cwd(), "public", "data")

async function run() {
  console.log("Fetching exports...")
  const [servants, items, wars] = await Promise.all([
    fetchJson(EXPORT_URL("nice_servant"), { timeoutMs: 120000 }),
    fetchJson(EXPORT_URL("nice_item"), { timeoutMs: 60000 }),
    fetchJson(EXPORT_URL("nice_war"), { timeoutMs: 120000 }),
  ])

  const jobs = selectQuestPhaseJobs(wars)
  console.log(`Fetching ${jobs.length} quest phases (concurrency ${QUEST_CONCURRENCY})...`)
  let failed = 0
  let completed = 0
  const questResults = await mapWithConcurrency(jobs, QUEST_CONCURRENCY, async (job) => {
    const detail = await fetchJson(QUEST_PHASE_URL(job.questId, job.phase), { timeoutMs: 12000 }).catch(() => {
      failed += 1
      return null
    })
    completed += 1
    if (completed % 200 === 0) console.log(`  ${completed}/${jobs.length}`)
    return { job, detail }
  })

  const servantsIndex = buildServantsIndex(servants)
  const indexedIds = new Set(servantsIndex.map((s) => s.id))
  const servantDetails = new Map(
    servants
      .filter((servant) => indexedIds.has(servant.id))
      .sort((a, b) => a.id - b.id)
      .map((servant) => [servant.id, trimServantDetail(servant)])
  )
  const materialsIndex = buildMaterialsIndex(items)
  const farming = buildFarmingIndex(
    aggregateDrops(questResults),
    materialsIndex.map((m) => m.id),
    buildQuestMeta(wars)
  )

  const dataset = {
    servantsIndex,
    servantDetails,
    materialsIndex,
    farming,
    questFetch: { total: jobs.length, failed },
  }

  const errors = validateDataset(dataset, await readPreviousStats(OUT_DIR))
  if (errors.length) {
    throw new Error(`Dataset validation failed:\n  - ${errors.join("\n  - ")}`)
  }

  await writeDataset(OUT_DIR, dataset)
  console.log(
    `Wrote ${servantsIndex.length} servants, ${materialsIndex.length} materials, ` +
      `${Object.keys(farming).length} farming files (quest failures ${failed}/${jobs.length}) to ${OUT_DIR}`
  )
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
```

- [ ] **Step 6: Update `package.json` scripts and `.gitignore`**

Replace the `build:drops` and `prebuild` entries with `data:refresh` so Vercel builds never call Atlas. Final `scripts` block:

```json
"scripts": {
  "data:refresh": "node scripts/atlas/build.mjs",
  "test": "node --test \"scripts/atlas/*.test.mjs\"",
  "dev": "next dev",
  "build": "next build --webpack",
  "start": "next start",
  "lint": "eslint"
},
```

Append to `.gitignore`:

```
# atlas pipeline scratch
/public/data.tmp/
```

- [ ] **Step 7: Delete the old script**

```bash
git rm scripts/build-drop-data.mjs
```

(`data/drop-data.json` stays until Task 6, because the `material-farming` route still imports it.)

- [ ] **Step 8: Run the pipeline for real**

Run: `npm run data:refresh`
Expected: exit 0, final line like `Wrote 419 servants, ~5xx materials, ~6xx farming files (quest failures 0/NNNN) to .../public/data`. Takes several minutes.

Then verify determinism — run it a second time and check git sees no change between runs:

```bash
git add -A public/data && npm run data:refresh && git diff --stat -- public/data
```

Expected: no output from `git diff` (second run byte-identical to the staged first run). If files differ, diff one and fix the ordering source before continuing.

Check size: `du -sh public/data` — expect roughly 25–35 MB.

- [ ] **Step 9: Commit**

```bash
git add package.json .gitignore scripts/atlas/dataset.mjs scripts/atlas/dataset.test.mjs scripts/atlas/build.mjs public/data
git commit -m "feat(data): add atlas pipeline orchestrator and generate static data"
```

---

### Task 5: Server pages read static data

**Files:**
- Create: `lib/atlas-types.ts`, `lib/atlas-data.ts`
- Modify: `app/page.tsx`, `app/favorites/page.tsx`, `app/filter/[filterType]/[filterValue]/page.tsx`, `app/servantpage/[id]/page.tsx`

**Interfaces:**
- Consumes: `public/data/servants-index.json`, `public/data/servants/{id}.json` (Task 4).
- Produces:
  - `lib/atlas-types.ts`: `interface ServantIndexEntry { id: number; name: string; className: string; attribute: string; rarity: number; portrait: string; buffs: string[]; debuffs: string[]; traits: string[]; alignments: string[]; stars: string }` — no runtime imports, safe for client components.
  - `lib/atlas-data.ts` (server only, imports `node:fs`): `getServantsIndex(): ServantIndexEntry[]`, `getServantDetail(id: number): Promise<{ id, name, className, rarity, portrait: string | null, raw: any }>` — same shape as the old `getServantData`.

- [ ] **Step 1: Create `lib/atlas-types.ts`**

```ts
// Types only. Client components import from here, never from lib/atlas-data.ts (node:fs).
export interface ServantIndexEntry {
  id: number
  name: string
  className: string
  attribute: string
  rarity: number
  portrait: string
  buffs: string[]
  debuffs: string[]
  traits: string[]
  alignments: string[]
  stars: string
}
```

- [ ] **Step 2: Create `lib/atlas-data.ts`**

```ts
// Server only: uses node:fs. Client components must import types from lib/atlas-types.ts.
import { readFile } from "node:fs/promises"
import { join } from "node:path"

import type { ServantIndexEntry } from "@/lib/atlas-types"
import servantsIndex from "@/public/data/servants-index.json"

const SERVANTS_DIR = join(process.cwd(), "public", "data", "servants")

export function getServantsIndex(): ServantIndexEntry[] {
  return servantsIndex as ServantIndexEntry[]
}

// Only called at build time: servant pages are fully prerendered (dynamicParams = false).
export async function getServantDetail(id: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: any = JSON.parse(await readFile(join(SERVANTS_DIR, `${id}.json`), "utf8"))

  return {
    id: Number(raw.id),
    name: String(raw.name),
    className: String(raw.className),
    rarity: Number(raw.rarity),
    portrait: (raw.portrait as string | null) ?? null,
    raw,
  }
}
```

- [ ] **Step 3: Swap index consumers**

`app/page.tsx` — replace the import and call:

```tsx
import { getServantsIndex } from "@/lib/atlas-data"
import { ServantProvider } from "./contexts/HomePageContext"
import Homepage from "./pages/Home"
import { NavBar } from "@/components/NavBar"

export default function Home() {
  const servants = getServantsIndex()
```

(rest of file unchanged)

`app/favorites/page.tsx`:

```tsx
import { getServantsIndex } from "@/lib/atlas-data"
import { FavoriteServantsTablePage } from "@/components/ServantTable/FavoriteServantsTablePage"

export default function FavoritesPage() {
  const servants = getServantsIndex()

  return <FavoriteServantsTablePage data={servants} />
}
```

`app/filter/[filterType]/[filterValue]/page.tsx` — change line 3 to `import { getServantsIndex } from "@/lib/atlas-data"` and line 30 to `const servants = getServantsIndex()`.

- [ ] **Step 4: Swap servant detail page**

In `app/servantpage/[id]/page.tsx`:
- Replace `import { getServantData } from "@/app/services/api"` with `import { getServantDetail, getServantsIndex } from "@/lib/atlas-data"`.
- Replace `const servant = await getServantData(Number(id))` with `const servant = await getServantDetail(Number(id))`.
- Add below the `ServantPageProps` interface:

```tsx
export const dynamicParams = false

export function generateStaticParams() {
  return getServantsIndex().map((servant) => ({ id: String(servant.id) }))
}
```

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed; build output lists `/servantpage/[id]` as SSG (●) with ~419 paths, and `/`, `/favorites` as static (○).

If `ServantProvider`/table components complain the `initialServants` type is narrower/wider than before, check their prop types — the old function returned an untyped (`any`-derived) array. Loosen the prop type to `ServantIndexEntry[]` in that component rather than casting at the call site, importing it with `import type { ServantIndexEntry } from "@/lib/atlas-types"` (these are client components; never import `@/lib/atlas-data` there).

- [ ] **Step 6: Manual check (Review Focus 1 & 5)**

```bash
npm run start &
sleep 5
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/servantpage/100100
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/servantpage/999
curl -s http://localhost:3000/ | grep -c "Altria"
kill %1
```

Expected: `200`, `404`, count ≥ 1.

- [ ] **Step 7: Commit**

```bash
git add lib/atlas-types.ts lib/atlas-data.ts app/page.tsx app/favorites/page.tsx "app/filter/[filterType]/[filterValue]/page.tsx" "app/servantpage/[id]/page.tsx"
git commit -m "feat(app): render servant pages from static atlas data"
```

---

### Task 6: Client fetches static JSON; remove runtime Atlas code

**Files:**
- Modify: `app/track-materials/page.tsx:242-249,324,347-349`, `components/materials/MaterialFarmingCard.tsx:175-186`
- Delete: `app/api/atlas/` (4 routes), `app/services/api.tsx`, `data/drop-data.json`
- Test: `scripts/atlas/no-runtime-atlas.test.mjs`

**Interfaces:**
- Consumes: `/data/servants-index.json` (array), `/data/materials-index.json` (array), `/data/servants/{id}.json` (`ServantDetail`), `/data/farming/{itemId}.json` (`{ nodes }`).

- [ ] **Step 1: Write the guard test** — `scripts/atlas/no-runtime-atlas.test.mjs`

```js
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
```

- [ ] **Step 2: Run — expect failure**

Run: `npm test`
Expected: FAIL listing `app/services/api.tsx`, `app/api/atlas/...`, `app/track-materials/page.tsx`, `components/materials/MaterialFarmingCard.tsx`.

- [ ] **Step 3: Update tracker page fetches** — `app/track-materials/page.tsx`

Index fetches (around line 242):

```tsx
    fetch("/data/servants-index.json", { cache: "force-cache" })
      .then((r) => r.json())
      .then((p) => setServantIndex(Array.isArray(p) ? p : []))
      .catch(() => setServantIndex([]))
    fetch("/data/materials-index.json", { cache: "force-cache" })
      .then((r) => r.json())
      .then((p) => setMaterialIndex(Array.isArray(p) ? p : []))
      .catch(() => setMaterialIndex([]))
```

Farming efficiency (around line 324):

```tsx
          const r = await fetch(`/data/farming/${material.id}.json`, { cache: "force-cache" })
```

Add servant (around line 347):

```tsx
      const r = await fetch(`/data/servants/${servant.id}.json`, { cache: "force-cache" })
      if (!r.ok) throw new Error("Failed to load servant")
      const payload = await r.json()
```

(delete the old `if (!r.ok) throw new Error(payload?.error || ...)` line; the detail file has the same `id/name/className/rarity/portrait/ascensionMaterials/skillMaterials/appendSkillMaterials` keys the route returned.)

- [ ] **Step 4: Update farming card** — `components/materials/MaterialFarmingCard.tsx:175-186`

```tsx
    fetch(`/data/farming/${itemId}.json`, {
      cache: "force-cache",
    })
      .then(async (response) => {
        // Items with no known farming nodes may have no file; treat as empty.
        if (response.status === 404) return { nodes: [] } as MaterialFarmingResponse
        if (!response.ok) throw new Error("Failed to fetch farming data")

        return (await response.json()) as MaterialFarmingResponse
      })
```

- [ ] **Step 5: Delete runtime Atlas code and old data**

```bash
git rm -r app/api/atlas app/services/api.tsx data/drop-data.json
```

- [ ] **Step 6: Run tests, typecheck, build**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: all pass; build route table shows no `/api/atlas/*` entries.

- [ ] **Step 7: Manual check (Review Focus 4)**

```bash
npm run start &
sleep 5
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/data/servants-index.json
curl -s http://localhost:3000/data/farming/6503.json | head -c 200; echo
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/data/farming/424242.json
kill %1
```

Expected: `200`; JSON beginning `{"nodes":[{...`; `404`. Then `npm run dev`, open `/track-materials`, add a servant, open Farming tab, open a material page for a lore item (e.g. Crystallized Lore) — card shows empty state, no error text.

- [ ] **Step 8: Commit**

```bash
git add -A app components scripts/atlas/no-runtime-atlas.test.mjs
git commit -m "feat(app): fetch static atlas JSON on client and remove runtime atlas routes"
```

---

### Task 7: Daily GitHub Action + docs

**Files:**
- Create: `.github/workflows/refresh-atlas-data.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: `npm test`, `npm run data:refresh` (Tasks 1–6).

- [ ] **Step 1: Create `.github/workflows/refresh-atlas-data.yml`**

```yaml
name: Refresh Atlas data

on:
  schedule:
    - cron: "17 4 * * *" # daily, 04:17 UTC
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: refresh-atlas-data
  cancel-in-progress: false

jobs:
  refresh:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 24

      - name: Test pipeline
        run: npm test

      - name: Build static data
        run: npm run data:refresh

      - name: Commit if changed
        run: |
          git add -A public/data
          if git diff --cached --quiet; then
            echo "Atlas data unchanged."
            exit 0
          fi
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git commit -m "chore(data): refresh Atlas data"
          # main may have moved while the pipeline ran; replay our data commit on top.
          git pull --rebase origin main
          git push
```

No `npm ci` needed — pipeline and tests use only Node built-ins. The push to `main` triggers Vercel's Git integration (Vercel's GitHub app webhook, unaffected by the `GITHUB_TOKEN` no-retrigger rule).

Commits are authored by `github-actions[bot]`. That's fine because the repo is **public** (verified 2026-09-24). On Vercel Hobby with a **private** repo, Vercel blocks deploys whose commit author isn't the account owner. If the repo ever goes private, either set `user.name`/`user.email` to the owner's GitHub identity, or add a `VERCEL_DEPLOY_HOOK_URL` repo secret and `curl -fsS -X POST "$VERCEL_DEPLOY_HOOK_URL"` after the push. If `main` gets branch protection, switch to a PR-based flow or a deploy key.

- [ ] **Step 2: Validate the workflow file**

Run: `node -e "const y=require('fs').readFileSync('.github/workflows/refresh-atlas-data.yml','utf8'); if(!/cron:/.test(y)||!/data:refresh/.test(y)) process.exit(1); console.log('ok')"`
Expected: `ok`. (After push, trigger once via GitHub → Actions → "Refresh Atlas data" → Run workflow; expect green run and either "Atlas data unchanged." or a `chore(data)` commit.)

- [ ] **Step 3: Update `README.md`**

Replace the "Project Structure" `api/atlas/` line and the `scripts/`+`data/` block with:

```text
scripts/
  atlas/                      # daily Atlas → static JSON pipeline (Node built-ins only)
public/
  data/                       # generated, committed static JSON served from CDN
```

Replace the "Scripts" list with:

```markdown
- `npm run dev` – run local dev server
- `npm run data:refresh` – fetch Atlas exports and regenerate `public/data/`
- `npm test` – pipeline tests (`node --test`)
- `npm run build` – production build (`next build --webpack`), no Atlas calls
- `npm run start` – run production server
- `npm run lint` – lint
```

Replace the "Data & Build Notes" section body with:

```markdown
All game data is prebuilt into `public/data/` by `scripts/atlas/build.mjs`:

- `servants-index.json` – home/filter/favorites table rows
- `servants/{id}.json` – trimmed servant detail (skills, NPs, materials, art)
- `materials-index.json` – tracker inventory list
- `farming/{itemId}.json` – best farming nodes per material

`.github/workflows/refresh-atlas-data.yml` runs the pipeline daily and commits only when the output changes; the commit triggers a Vercel deploy. The pipeline aborts without writing if Atlas looks unhealthy (more than 5% of quest fetches fail, or servant/material/farmed-item counts drop more than 5% from the last run). Requests are limited to 8 at a time and send a `User-Agent` identifying this repo.

The deployed app makes zero runtime calls to `api.atlasacademy.io`. Images still come from `static.atlasacademy.io` via `next/image` (Vercel image optimization).
```

Replace the "Deployment" bullet `API routes and pages are resilient to temporary Atlas fetch failures (degrade gracefully).` with `Builds use committed data only; Atlas outages cannot break a deploy.`

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/refresh-atlas-data.yml README.md
git commit -m "ci: refresh Atlas static data daily via GitHub Action"
```

---

## Self-Review Notes

- **Spec coverage:** Action cron daily → Task 7. Fetch exports → Task 4 `build.mjs`. Trim/transform → Tasks 1–3. Commit (chosen over deploy hook) → Task 7. Static JSON from CDN → `public/data` (Tasks 4–6). Zero runtime Atlas calls → Task 6 guard test. Images from static.atlasacademy.io → unchanged (already true; optimizer kept on purpose). Mirror → out of scope (section missing from sketch).
- **Output location:** sketch says `data/*.json`; plan uses `public/data/` so the same files serve both build-time server reads and client CDN fetches without an API layer.
- **Behavior change to flag:** `limit` / `all` / `minRuns` query params on the farming route disappear; only the default selection (`minRuns=200`, 6 nodes) ships, which is all current callers use.
- **Review round 1 (applied):** bot author OK because the repo is public (deploy-hook fallback documented in Task 7); `git pull --rebase` before push; previous-run checks for material + farmed-item counts; quest concurrency 20 → 8 plus `User-Agent`; `images.unoptimized` dropped; types split into `lib/atlas-types.ts`.
- **Deferred:** re-fetching quest phases weekly instead of daily. That needs raw drop data cached between runs; revisit if Atlas load or run time becomes a problem.
