# FGO Database

A Next.js app for browsing **Fate/Grand Order** servants, filtering by gameplay tags, viewing servant details, and tracking upgrade materials.

## Features

- Servant index with advanced filters:
  - Class
  - Buff/debuff effects
  - Traits
  - Alignments
  - Rarity stars
- Servant detail page:
  - Ascension/costume art switching
  - Stats, deck, traits, alignment, attribute
  - Skill / NP cards with per-level value tables
  - Materials sections (ascension, skills, append, costume)
- Material tracker:
  - Track multiple servants
  - Per-servant target levels
  - Progress + total materials needed
  - Farming summary
  - Inventory editor modal
- Material detail page with farming card
- Dark theme support
- Vercel Analytics integration

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- shadcn/ui primitives
- Atlas Academy API (servants + game data)

## Project Structure

```text
app/
  servantpage/[id]/           # servant details
  track-materials/            # tracker pages
  material/[itemId]/          # material detail
components/
  servantPage/                # servant detail UI sections
  materials/                  # farming card UI
  tracker/                    # tracker-specific UI
lib/
  material-tracker.ts         # tracker state + calculations
  material-tracker.worker.ts  # web worker math offload
scripts/
  atlas/                      # daily Atlas → static JSON pipeline (Node built-ins only)
public/
  data/                       # generated, committed static JSON served from CDN
```

## Getting Started

### 1. Install

```bash
npm install
```

### 2. Run dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` – run local dev server
- `npm run data:refresh` – fetch NA Atlas exports and regenerate `public/data/`
- `npm run data:refresh:jp` – fetch JP Atlas exports (English names) and regenerate `public/data-jp/`
- `npm test` – pipeline tests + guard that app code never calls the Atlas API (`node --test`)
- `npm run build` – production build (`next build --webpack`), no Atlas calls
- `npm run start` – run production server
- `npm run lint` – lint

## Data & Build Notes

All game data is prebuilt into `public/data/` by `scripts/atlas/build.mjs`:

- `servants-index.json` – servant browser and filter rows
- `servants/{id}.json` – trimmed servant detail (skills, NPs, materials, art)
- `materials-index.json` – tracker inventory list
- `items/{itemId}.json` – farming nodes and servant usage per material
- `quests-index.json` – free quests by quest ID and phase, with location and availability
- `quests/{questId}/{phase}.json` – free-quest waves, enemy HP/attack/level/class/traits, and rewards

Free-quest stage data comes from `/nice/NA/quest/{questId}/{phase}` during
`npm run data:refresh`, reusing the requests made for farming drops. Each phase
is stored separately because first-clear and repeatable battles can differ.
`status: "unavailable"` means Atlas returned 404; `enemyDataAvailable: false`
means no enemy lineups were supplied. Unknown stats remain `null`, not zero.
Enemy deck/position and the selected `enemyHash` are retained; Atlas can have
multiple recorded enemy variants, and these files contain the default variant.
The Free Quests browser at `/free-quests` shows only the last phase of quests
marked `repeatLast`. Search and chapter filters persist while choosing quests.
Detail pages at `/free-quests/{questId}` show drops per run, AP per item, sample
counts, and enemy waves with expandable traits. Drop rates include stack size
(`dropCount / runs × num`); they are averages, not probabilities. All pages use
local data, with no runtime Atlas API calls.

`.github/workflows/refresh-atlas-data.yml` runs the pipeline daily and commits only when the output changes; the commit triggers a Vercel deploy. The pipeline aborts without writing if Atlas looks unhealthy (any quest fetch still fails after retries, the free-quest index or a phase file is missing, or servant/material/farmed-item counts drop more than 5% from the last run). Requests are limited to 8 at a time and send a `User-Agent` identifying this repo.

The deployed app makes zero runtime calls to `api.atlasacademy.io`. Images still come from `static.atlasacademy.io` via `next/image` (Vercel image optimization).

## Deployment

Recommended on Vercel.

- Root layout includes Vercel Analytics.
- Build uses webpack for stability.
- Builds use committed data only; Atlas outages cannot break a deploy.

## API Sources

- Atlas Academy API:
  - `https://api.atlasacademy.io/export/{region}/...`
  - `https://api.atlasacademy.io/nice/{region}/...`

This app primarily targets `NA` data by default.

## Contributing

1. Create a feature branch
2. Make changes with TypeScript checks passing
3. Open a PR with a clear summary and screenshots for UI changes

## Accounts and cloud saves

Google and email/password sign-in with private cloud saves are optional. See [Supabase setup](docs/supabase-setup.md) for migrations, provider setup, environment variables, and validation. Guest progress remains available without an account.

### JP data

The JP command uses the same servant, material, upgrade requirement, farming, and free-quest pipeline as NA. It reads Atlas's English JP exports, so names are in English, and keeps the Japanese name as `originalName`. You can also pass `--region NA` or `--region JP` directly to `scripts/atlas/build.mjs`; other values are rejected before fetching. JP output goes to `public/data-jp/` and is validated against its own previous output. Fetch or validation failures preserve existing datasets. The `/jp/...` pages and JP game profiles use it. The scheduled refresh updates NA, then JP.
