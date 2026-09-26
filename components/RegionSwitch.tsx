"use client"

import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"

import { useAccount } from "@/components/account/AccountProvider"
import { useOpenServerProfile } from "@/components/account/ProfileServerNotice"
import { describeProfileError } from "@/lib/profiles"

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
  const [offer, setOffer] = useState<Region | null>(null)
  const [error, setError] = useState("")
  const account = useAccount()
  const openServerProfile = useOpenServerProfile()

  const go = async (target: Region) => {
    if (target === region || busy) return
    const path = pathname + window.location.search
    const { section, id } = parseSitePath(pathname)
    setError("")
    // Planning follows the active profile: switch to a profile on that server instead of just the URL.
    if (section === "track-materials") {
      setBusy(true)
      try {
        if (!(await account.switchToServer(target))) setOffer(target)
      } catch (caught) {
        setError(describeProfileError(caught))
      } finally {
        setBusy(false)
      }
      return
    }
    setBusy(true)
    try {
      const found = section && id ? await existsIn(target, section, id).catch(() => false) : false
      router.push(switchRegionPath(path, target, () => found))
    } finally {
      setBusy(false)
    }
  }

  const create = async (server: Region) => {
    setBusy(true)
    setError("")
    try {
      await openServerProfile(server)
      setOffer(null)
    } catch (caught) {
      setError(describeProfileError(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative">
    <div role="group" aria-label="Game region" className="flex h-11 shrink-0 items-center rounded-md border border-border p-1" aria-busy={busy || undefined}>
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
    {offer || error ? (
      <div role="dialog" aria-label="Game region" className="absolute right-0 top-full z-30 mt-2 w-64 space-y-2 rounded-lg border border-border bg-card p-3 text-sm shadow-xl">
        {offer ? <p>You don’t have a {offer} profile yet. Planning uses one profile per game server.</p> : null}
        {error ? <p role="alert" className="text-amber-500">{error}</p> : null}
        <div className="flex gap-2">
          {offer ? (
            <button type="button" disabled={busy} onClick={() => void create(offer)} className="h-9 cursor-pointer rounded-lg bg-foreground px-3 font-medium text-background disabled:opacity-50">
              {busy ? "Creating…" : `Create ${offer} profile`}
            </button>
          ) : null}
          <button type="button" onClick={() => { setOffer(null); setError("") }} className="h-9 cursor-pointer rounded-lg border border-border px-3">
            {offer ? "Cancel" : "Close"}
          </button>
        </div>
      </div>
    ) : null}
    </div>
  )
}
