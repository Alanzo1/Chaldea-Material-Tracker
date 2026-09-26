// NA and JP sides of the site: data locations and route mapping. Pure; no React, no @/ imports.

export type Region = "NA" | "JP"
export type SiteSection = "servants" | "items" | "free-quests" | "track-materials"

export const REGIONS: Region[] = ["NA", "JP"]

export function dataBase(region: Region) {
  return region === "JP" ? "/data-jp" : "/data"
}

export function regionFromPath(pathname: string): Region {
  return pathname === "/jp" || pathname.startsWith("/jp/") ? "JP" : "NA"
}

// NA and JP use different URL words for the same page; the section key is shared.
const NA_ROUTES: Record<SiteSection, { list: string; detail: string }> = {
  servants: { list: "/servants", detail: "/servantpage" },
  items: { list: "/items", detail: "/material" },
  "free-quests": { list: "/free-quests", detail: "/free-quests" },
  "track-materials": { list: "/track-materials", detail: "/track-materials" },
}
const JP_SEGMENT: Record<SiteSection, string> = {
  servants: "servants",
  items: "items",
  "free-quests": "free-quests",
  "track-materials": "track-materials",
}

function splitSuffix(path: string) {
  const index = path.search(/[?#]/)
  return index === -1 ? { pathname: path, suffix: "" } : { pathname: path.slice(0, index), suffix: path.slice(index) }
}

export function parseSitePath(path: string): { region: Region; section: SiteSection | null; id: string | null } {
  const { pathname } = splitSuffix(path)
  const region = regionFromPath(pathname)
  const parts = pathname.split("/").filter(Boolean)

  if (region === "JP") {
    const section = (Object.keys(JP_SEGMENT) as SiteSection[]).find((key) => JP_SEGMENT[key] === parts[1]) ?? null
    return { region, section, id: section ? parts[2] ?? null : null }
  }

  for (const section of Object.keys(NA_ROUTES) as SiteSection[]) {
    const { list, detail } = NA_ROUTES[section]
    if (`/${parts[0]}` === detail && parts[1]) return { region, section, id: parts[1] }
    if (`/${parts[0]}` === list && !parts[1]) return { region, section, id: null }
  }
  return { region, section: null, id: null }
}

function pathFor(region: Region, section: SiteSection, id: string | null) {
  if (region === "JP") return `/jp/${JP_SEGMENT[section]}${id ? `/${id}` : ""}`
  return id ? `${NA_ROUTES[section].detail}/${id}` : NA_ROUTES[section].list
}

/** Maps an NA link (as written in shared components) to the given region's route. */
export function regionHref(region: Region, naPath: string) {
  if (region === "NA") return naPath
  // Servant lists by trait / alignment / attribute.
  if (naPath.startsWith("/filter/")) return `/jp${naPath}`
  const { pathname, suffix } = splitSuffix(naPath)
  const { section, id } = parseSitePath(pathname)
  return section ? pathFor("JP", section, id) + suffix : naPath
}

/**
 * The same page in the other region. When the servant/item/quest doesn't exist there (per `exists`),
 * falls back to that section's list; pages without a section go to the region's front page.
 */
export function switchRegionPath(
  path: string,
  target: Region,
  exists: (section: SiteSection, id: string) => boolean
) {
  const { region, section, id } = parseSitePath(path)
  if (region === target) return path
  if (!section) return target === "JP" ? "/jp/servants" : "/"
  // Planning pages are per tracked servant; the list is the right landing when switching profile region.
  const keepId = id && section !== "track-materials" && exists(section, id) ? id : null
  return pathFor(target, section, keepId)
}
