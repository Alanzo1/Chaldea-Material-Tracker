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
- `npm run data:refresh` – fetch Atlas exports and regenerate `public/data/`
- `npm test` – pipeline tests (`node --test`)
- `npm run build` – production build (`next build --webpack`), no Atlas calls
- `npm run start` – run production server
- `npm run lint` – lint

## Data & Build Notes

All game data is prebuilt into `public/data/` by `scripts/atlas/build.mjs`:

- `servants-index.json` – home/filter/favorites table rows
- `servants/{id}.json` – trimmed servant detail (skills, NPs, materials, art)
- `materials-index.json` – tracker inventory list
- `farming/{itemId}.json` – best farming nodes per material

`.github/workflows/refresh-atlas-data.yml` runs the pipeline daily and commits only when the output changes; the commit triggers a Vercel deploy. The pipeline aborts without writing if Atlas looks unhealthy (more than 5% of quest fetches fail, or servant/material/farmed-item counts drop more than 5% from the last run). Requests are limited to 8 at a time and send a `User-Agent` identifying this repo.

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

