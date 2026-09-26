"use client"

import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"

import { useDataRegion } from "@/lib/data-region"
import { dataBase, parseSitePath, REGIONS, switchRegionPath, type Region, type SiteSection } from "@/lib/region"
import { loadStaticJson } from "@/lib/use-static-json"
import { cn } from "@/lib/utils"

const INDEX_FILE: Record<SiteSection, string> = {
  servants: "servants-index.json",
  "track-materials": "servants-index.json",
  items: "materials-index.json",
  "free-quests": "quests-index.json",
}

// Does the other region have this servant / item / quest? Loads that region's index on click.
async function existsIn(region: Region, section: SiteSection, id: string) {
  const index = (await loadStaticJson(`${dataBase(region)}/${INDEX_FILE[section]}`)) as { id?: number; questId?: number }[]
  return index.some((entry) => String(entry.questId ?? entry.id) === id)
}

// Navbar NA | JP switch: moves to the same page on the other side of the site.
export function RegionSwitch() {
  const { region } = useDataRegion()
  const pathname = usePathname() ?? "/"
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const go = async (target: Region) => {
    if (target === region || busy) return
    const path = pathname + window.location.search
    const { section, id } = parseSitePath(pathname)
    setBusy(true)
    try {
      const found = section && id ? await existsIn(target, section, id).catch(() => false) : false
      router.push(switchRegionPath(path, target, () => found))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div role="group" aria-label="Game region" className="flex h-11 shrink-0 items-center rounded-md border border-border p-1" aria-busy={busy}>
      {REGIONS.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === region}
          disabled={busy}
          onClick={() => void go(option)}
          className={cn(
            "h-full cursor-pointer rounded px-2.5 text-xs font-bold tracking-wide transition-colors disabled:cursor-wait",
            option === region ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {option}
        </button>
      ))}
    </div>
  )
}
