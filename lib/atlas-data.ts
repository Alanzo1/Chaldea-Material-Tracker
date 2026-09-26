// Server only: uses node:fs. Client components must import types from lib/atlas-types.ts.
import { readFile } from "node:fs/promises"
import { join } from "node:path"

import type { MaterialIndexEntry, ServantIndexEntry } from "@/lib/atlas-types"
import { normalizeServantDetail } from "@/lib/servant-detail"
import materialsIndex from "@/public/data/materials-index.json"
import servantsIndex from "@/public/data/servants-index.json"

const SERVANTS_DIR = join(process.cwd(), "public", "data", "servants")

export function getServantsIndex(): ServantIndexEntry[] {
  return servantsIndex as ServantIndexEntry[]
}

export function getMaterialsIndex(): MaterialIndexEntry[] {
  return materialsIndex as MaterialIndexEntry[]
}

export function getMaterial(id: number): MaterialIndexEntry | undefined {
  return getMaterialsIndex().find((material) => material.id === id)
}

// Only called at build time: servant pages are fully prerendered (dynamicParams = false).
export async function getServantDetail(id: number) {
  return normalizeServantDetail(JSON.parse(await readFile(join(SERVANTS_DIR, `${id}.json`), "utf8")))
}
