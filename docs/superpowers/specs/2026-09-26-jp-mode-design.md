# JP Mode — Design

**Status:** approved in chat 2026-09-26
**Branch:** `feat/jp-mode`

## Goal

A full JP side of the site: browse JP servants, items and free quests, and plan JP game accounts, alongside
the existing NA site. A navbar **NA | JP** switch moves between them.

## Decisions

| Topic | Decision |
|---|---|
| Scope | Browse + planning (full JP mode) |
| Entry | `/jp/...` routes, NA \| JP switch in the navbar, game profiles marked NA or JP |
| Names | English (Atlas `*_lang_en` exports / `?lang=en`), Japanese `originalName` as a second line on detail pages |
| Hosting | `public/data-jp` deployed; JP pages load data client-side (not prerendered) |
| Refresh | Daily Action refreshes NA then JP; each region validated against its own previous output |

## Phase A — JP data and pages

### Data

- `createRegionConfig` gains `lang`: JP uses `nice_servant_lore_lang_en`, `nice_item_lang_en`,
  `nice_war_lang_en`, and `?lang=en` on quest phases; NA is unchanged. JP output returns to
  `public/data-jp/` (committed, deployed).
- Servant detail, servants index, materials index and quests index gain optional `originalName`
  (JP only; NA files are byte-identical to before).
- The refresh workflow runs `data:refresh:jp` after NA and commits `public/data-jp`. A JP failure
  does not block the NA commit.

### Region in the app

- `lib/region.ts` (pure, tested): `Region = "NA" | "JP"`, `dataBase(region)`, `regionFromPath(path)`,
  `regionHref(region, path)` (maps NA paths to JP paths), and `switchRegionPath(path, target, exists)`.
- `DataRegionProvider` in the root layout derives the region from the URL (`/jp` prefix).
  `useDataRegion()` gives `{ region, base, href }`.
- Every client data load uses `base` instead of `/data`: `useStaticJson` callers, `ServantProvider`,
  `useFreeQuests`, `useItemFile`, search, Planning fetches.

### Routes

| NA | JP |
|---|---|
| `/servants`, `/servantpage/[id]` | `/jp/servants`, `/jp/servants/[id]` |
| `/items`, `/material/[id]` | `/jp/items`, `/jp/items/[id]` |
| `/free-quests`, `/free-quests/[id]` | `/jp/free-quests`, `/jp/free-quests/[id]` |
| `/track-materials`, `/track-materials/[id]` | `/jp/track-materials`, `/jp/track-materials/[id]` |

`/jp` redirects to `/jp/servants`. NA detail pages stay prerendered. JP detail pages are rendered on
demand as shells that fetch `/data-jp/...` client-side with a spinner.

The servant page body moves into a shared `ServantPageView`; NA feeds it server-loaded data, JP a
client-loaded file. Item and quest browsers are reused with region-aware data and links. Detail pages
show `originalName` under the title when present.

### Navbar switch

An NA | JP segmented control. Switching maps the current page to the other region's equivalent. For a
servant/item/quest page, it loads the other region's index on click; if the id is missing there, it goes
to that section's list. Other pages go to `/jp/servants` or `/`. Nav links and search follow the region.

## Phase B — JP planning

- `progress_profiles.server text not null default 'NA' check (server in ('NA','JP'))`
  (migration `202609270001_profile_server.sql`). `create_progress_profile` gains an optional
  `profile_server` (the two-argument call keeps working); new `set_progress_profile_server(id, server)`;
  `read_progress_profiles` returns `server`.
- Guest profile list entries gain `server` (missing = NA).
- New profiles pick NA/JP (defaulting to the current region). Changing server on `/account`: NA → JP
  always; JP → NA refused when the profile tracks servants missing from NA, naming them.
- Planning follows the active profile: opening NA Planning with a JP profile redirects to JP Planning
  and vice versa. On Planning, the NA | JP switch changes to the most recently used profile of that
  server (remembered per device), or offers to create one.
- A profile's servant data hydrates from its own server's data.
- Add to Planning and Quantity owned only edit when the page region matches the active profile's server;
  otherwise they offer to switch to (or create) a profile for that server.
- The profile menu tags each profile NA or JP.

## Testing

- Pipeline: region config (lang URLs, JP output dir), `originalName` passthrough.
- `lib/region.test.mjs`: path mapping both ways, unknown paths, missing ids.
- `lib/profiles.test.mjs`: server default and JP→NA check helper.
- SQL: server column, default, create with/without server, set server, isolation.
- Browser: NA/JP switch on each page type, JP servant/item/quest pages load with Japanese second line,
  JP planning with a JP profile, gating on mismatched region.

## Out of scope

"New in JP" badges, prerendering JP pages, CN/TW/KR.
