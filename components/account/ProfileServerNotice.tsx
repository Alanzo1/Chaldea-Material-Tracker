"use client"

import { useState } from "react"

import { useAccount } from "@/components/account/AccountProvider"
import { useDataRegion } from "@/lib/data-region"
import { describeProfileError } from "@/lib/profiles"
import type { Region } from "@/lib/region"
import { cn } from "@/lib/utils"

const BUTTON = "h-9 cursor-pointer rounded-lg border border-border bg-muted/40 px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"

/** Tracker edits only apply when the page's region matches the active profile's server. */
export function useProfileMatchesRegion() {
  const { region } = useDataRegion()
  const { activeProfile } = useAccount()
  return { matches: !activeProfile || activeProfile.server === region, region, profile: activeProfile }
}

// Switches to the last used profile on `server`, or creates one named after the server.
export function useOpenServerProfile() {
  const account = useAccount()
  return async (server: Region) => {
    if (await account.switchToServer(server)) return
    const taken = new Set(account.profiles.map((profile) => profile.name.toLowerCase()))
    let name: string = server
    for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${server} ${n}`
    await account.createProfile(name, server)
  }
}

export function ProfileServerNotice({ className }: { className?: string }) {
  const account = useAccount()
  const { region, profile } = useProfileMatchesRegion()
  const openServerProfile = useOpenServerProfile()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const hasProfile = account.profiles.some((candidate) => candidate.server === region)

  const open = async () => {
    setBusy(true)
    setError("")
    try {
      await openServerProfile(region)
    } catch (caught) {
      setError(describeProfileError(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div role="status" className={cn("space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-sm", className)}>
      <p>
        “{profile?.name}” is an {profile?.server} profile. {region} progress goes in a {region} profile.
      </p>
      <button type="button" disabled={busy} onClick={() => void open()} className={BUTTON}>
        {busy ? "Switching…" : hasProfile ? `Switch to a ${region} profile` : `Create a ${region} profile`}
      </button>
      {error ? <p role="alert" className="text-xs text-amber-500">{error}</p> : null}
    </div>
  )
}
