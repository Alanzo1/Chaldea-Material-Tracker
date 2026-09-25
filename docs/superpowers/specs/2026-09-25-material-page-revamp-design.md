# Material Page Revamp — Design

Date: 2026-09-25
Status: approved in chat, awaiting spec review

## Goal

Rework `/material/[itemId]` to follow the reference layout (Blue Archive DB item page):
an item browser grid on the left and the selected item's details on the right, with
**Usage** and **Sources** tabs, and let the user set how many of the item they own.

## Agreed decisions

| Question | Decision |
|---|---|
| Layout | Grid + detail. `/items` and `/material/[id]` become one browser: left = searchable item grid, right = selected item. |
| Tabs | Usage, Sources (in that order). |
| Quantity | The existing **owned** count in the material tracker (`ownedByMaterialId`), shared with the Planning page. No separate inventory. |
| Usage data source | Built by the data pipeline into one file per item (Approach A below). |

## Current state

- `/material/[itemId]` is dynamic. Name, icon, and description arrive via query params (`?name=&icon=&detail=&returnTo=`); the page renders a Back link and `MaterialFarmingCard`.
- `MaterialFarmingCard` fetches `/data/farming/{id}.json` (`{ nodes: FarmingNode[] }`), shows an owned-quantity number input (persisted with `setOwnedMaterialQuantity`), "Total needed"/"Remaining" from tracked servants, and the farming node list.
- `/items` is a static grid of `materials-index.json` (`{ id, name, icon }[]`) linking to `/material/{id}?name=…&icon=…&returnTo=/items`.
- Query-string material links are built in three places: `app/items/page.tsx`, `app/track-materials/page.tsx`, and `getMaterialHref` in `components/servantPage/MaterialsSection.tsx`.
- `app/track-materials/page.tsx` also fetches `/data/farming/{id}.json` for its farming-efficiency view.
- There is no item → servants mapping anywhere.

## Approaches considered for Usage data

- **A. Per-item file with sources + usage (chosen).** Pipeline writes `items/{itemId}.json = { nodes, usage }`, replacing `farming/{itemId}.json`. The page loads one small file. File count unchanged (~170).
- B. Usage embedded in `materials-index.json`. Rejected: the index is loaded for the grid on every item page; usage for every item would add hundreds of KB.
- C. Aggregate in the browser from `servants/*.json`. Rejected: ~28 MB of downloads.

## Data pipeline changes

### `materials-index.json`

Each entry gains three fields (all from Atlas `nice_item`):

```ts
interface MaterialIndexEntry {
  id: number
  name: string
  icon: string
  detail: string       // description, whitespace-normalized
  type: string         // Atlas item type, e.g. "skillLvUp", "gemSkill"
  background: string   // "bronze" | "silver" | "gold" | "zero" | ...
}
```

`buildMaterialsIndex` keeps its current filtering, dedupe, and sort. The page maps `type` to a display label via a small lookup in `lib/`; the lookup covers every `type` value actually present in the generated index (listed during implementation from the real data), and any unknown type falls back to "Material".

### `items/{itemId}.json` (replaces `farming/{itemId}.json`)

```ts
interface ItemFile {
  nodes: FarmingNode[]          // unchanged farming output
  usage: ItemUsageEntry[]       // sorted by total desc, then servantId asc
}

interface ItemUsageEntry {
  servantId: number
  ascension: number
  skill: number                 // per-level cost × active skill slot count
  append: number                // per-level cost × append slot count
  costume: number
  total: number                 // sum of the four
}
```

- New pure function `buildItemUsage(servantDetails)` in `scripts/atlas/usage.mjs` returns `Record<itemId, ItemUsageEntry[]>`.
- Slot multipliers match the servant page's Mat Summary: skill slots = number of distinct `skills[].num` (min 1); append slots = `appendPassive.length` (min 1). Ascension and costume count once.
- Only servants in the servant index are counted. Items with no users get `usage: []`.
- Every item in `materials-index.json` gets an `items/{id}.json`, even with `nodes: []` and `usage: []`.
- `writeDataset` writes `items/` instead of `farming/`; `readPreviousStats` reads `items/` (first run after the change finds no `items/` dir and skips the vs-previous comparison, as it does on a fresh checkout).
- Validation adds: every materials-index item has an item file; at least `MIN_USED_ITEMS` (50) items have non-empty usage; used-item count must not drop >5% vs previous.
- Output stays byte-deterministic (sorted keys/arrays, no timestamps).

### Consumers updated

- `MaterialFarmingCard` / new components: fetch `/data/items/{id}.json`.
- `app/track-materials/page.tsx`: fetch `/data/items/{id}.json` and read `.nodes`.

## Page design

### Routes

- `/material/[itemId]`: statically generated for every materials-index item (`generateStaticParams`, `dynamicParams = false`). Unknown id → 404. No query params.
- `/items`: same two-panel browser with no item selected; the right panel shows a "Pick an item" placeholder.
- Material links everywhere become plain `/material/{id}`. The servant page Materials tab links to `/material/{id}#usage`. `returnTo` is removed: the item grid provides navigation.

### Layout

Two columns on desktop (`lg`), stacked on mobile:

**Left — `ItemGrid` (sticky, scrolls independently)**
- Search input ("Search items…") filtering by name.
- Tiles: icon on a background tinted by `background` rarity (bronze/silver/gold), name below (2-line clamp).
- Selected item gets a highlight ring. Tiles are links to `/material/{id}`.
- Mobile: grid collapses behind an "Items" toggle above the detail, like the home page filter toggle.

**Right — item detail**
1. Name in the servant page's large italic serif; below it the category label and a rarity badge.
2. Card: large icon + description (`detail`).
3. `OwnedQuantityControl`: `−` / number input / `+`. Click steps by 1; press-and-hold repeats and after ~1 s steps by 10. Clamped at 0. Persists via `setOwnedMaterialQuantity`; value read from tracker state on mount. Next to it: "Needed by tracked servants" and "Remaining" (existing calculation from `MaterialFarmingCard`).
4. Tabs via `ServantTabs` (hash-driven): **Usage** (`#usage`, default) · **Sources** (`#sources`).

### Usage tab — `MaterialUsagePanel`

- Filter chips: **All · Tracked · Favorites** (tracked = servants in tracker state; favorites from `lib/favorites`). Counts shown on each chip.
- Line: "Used by N servants".
- Face grid: servant portrait (from `servants-index.json`) with a `×{total}` badge. Tooltip / accessible label: `"{name}: Ascension 15 · Skill 48 · Append 12"` (zero categories omitted). Each face links to `/servantpage/{id}#materials`.
- Empty states: "Not used for servant upgrades" (no usage) and "None of your tracked/favorite servants use this" (filter empty).

### Sources tab — `MaterialSourcesList`

The existing farming node list from `MaterialFarmingCard`, unchanged in behavior (AP/drop coloring, drop rate, location lines). Empty state: "No known farming locations".

### Component changes

- `MaterialFarmingCard` is split into `OwnedQuantityControl` and `MaterialSourcesList`; the item file fetch moves to one `useItemFile(itemId)` hook returning `{ nodes, usage, loading, error }`.
- New: `ItemGrid`, `MaterialUsagePanel`, `MaterialDetail` (right panel composition).
- `ServantTabs` reused as-is.
- `MaterialIndexEntry` in `lib/atlas-types.ts` gains the new fields; `lib/atlas-data.ts` gains `getMaterial(id)`.

## Error handling

- Item file fetch fails → Usage and Sources show an inline error ("Couldn't load item data") with a Retry button; quantity control still works (it is localStorage-backed).
- Servant in usage missing from the servant index (shouldn't happen; validated) → skipped.
- localStorage unavailable → quantity control renders with 0 and does not throw (tracker helpers already guard).

## Testing

- `node --test`:
  - `buildItemUsage`: skill/append multipliers, costume counted once, servants outside the index ignored, sort order, items with no users.
  - `buildMaterialsIndex`: new fields present and normalized.
  - `validateDataset`: missing item file and used-item count drop both fail.
  - Guard test still passes (no runtime Atlas calls).
- `npx tsc --noEmit`, `npm run build` (item pages listed as SSG).
- Browser, desktop and 375px: grid search and selection; stepper click, hold-to-accelerate, persistence across reload, and matching value on Planning; Usage filters and counts; face → servant `#materials`; `#sources` deep link; servant page material link lands on `#usage`; `/items` placeholder; unknown id 404.

## Rollout note

The branch regenerates `public/data` because the file layout changes (`farming/` → `items/`). The daily refresh Action also commits `public/data` to `main`, so if it runs before this merges, resolve by merging `main` and re-running `npm run data:refresh` (as done for PR #5). Merge soon after review to avoid that.

## Out of scope

- Per-item goals/targets independent of tracked servants.
- Material rarity/type filter chips in the item grid (search only for now).
- Event items and items outside the current materials-index filter.
