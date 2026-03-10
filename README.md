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
- Favorites page (localStorage-backed)
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
  api/atlas/                  # server API routes/proxies
  servantpage/[id]/           # servant details
  track-materials/            # tracker pages
  material/[itemId]/          # material detail
  favorites/                  # favorites table
components/
  servantPage/                # servant detail UI sections
  materials/                  # farming card UI
  tracker/                    # tracker-specific UI
lib/
  material-tracker.ts         # tracker state + calculations
  material-tracker.worker.ts  # web worker math offload
scripts/
  build-drop-data.mjs         # prebuild drop dataset generation
data/
  drop-data.json              # generated farming data
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
- `npm run build:drops` – build `data/drop-data.json`
- `npm run build` – production build (`next build --webpack`)
- `npm run start` – run production server
- `npm run lint` – lint

## Data & Build Notes

The project prebuilds farming drop data via:

- `scripts/build-drop-data.mjs`

If Atlas endpoints are unavailable, the script falls back without blocking build.

You can also skip drop-data generation entirely:

```bash
SKIP_DROP_BUILD=1 npm run build
```

## Deployment

Recommended on Vercel.

- Root layout includes Vercel Analytics.
- Build uses webpack for stability.
- API routes and pages are resilient to temporary Atlas fetch failures (degrade gracefully).

## API Sources

- Atlas Academy API:
  - `https://api.atlasacademy.io/export/{region}/...`
  - `https://api.atlasacademy.io/nice/{region}/...`

This app primarily targets `NA` data by default.

## Contributing

1. Create a feature branch
2. Make changes with TypeScript checks passing
3. Open a PR with a clear summary and screenshots for UI changes

