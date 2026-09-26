"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Check, Plus, Settings2, UserRound } from "lucide-react"
import { useState, type FormEvent } from "react"

import { useAccount } from "@/components/account/AccountProvider"
import { ServerPicker, ServerTag } from "@/components/account/ServerTag"
import { useDataRegion } from "@/lib/data-region"
import type { Region } from "@/lib/region"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { describeProfileError, MAX_PROFILE_NAME, MAX_PROFILES } from "@/lib/profiles"
import { cn } from "@/lib/utils"

const ROW = "flex h-10 w-full cursor-pointer items-center gap-2 rounded-md px-3 text-left text-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"

// Navbar account button: shows the active game profile and switches between them.
export function ProfileMenu() {
  const account = useAccount()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const { region } = useDataRegion()
  const [server, setServer] = useState<Region>(region)

  const run = async (action: () => Promise<void>, after?: () => void) => {
    setBusy(true)
    setError("")
    try {
      await action()
      after?.()
    } catch (caught) {
      setError(describeProfileError(caught, name.trim()))
    } finally {
      setBusy(false)
    }
  }

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) { setCreating(false); setName(""); setError("") }
    else setServer(region)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    void run(() => account.createProfile(name, server), () => onOpenChange(false))
  }

  const label = account.activeProfile?.name ?? (account.user ? "Account" : "Profile")
  const atCap = account.profiles.length >= MAX_PROFILES

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Profile: ${label}`}
          title={account.status}
          className="flex h-11 max-w-44 shrink-0 cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-sm transition-colors hover:bg-muted"
        >
          <UserRound className="size-4 shrink-0" aria-hidden="true" />
          <span className="hidden truncate xl:block">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-72 p-2">
        <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Profiles</p>
        <ul aria-label="Profiles">
          {account.profiles.map((profile) => {
            const active = profile.id === account.activeProfile?.id
            return (
              <li key={profile.id}>
                <button
                  type="button"
                  disabled={busy || !account.ready}
                  aria-current={active ? "true" : undefined}
                  onClick={() => void run(() => account.switchProfile(profile.id), () => onOpenChange(false))}
                  className={cn(ROW, active && "font-medium")}
                >
                  <Check className={cn("size-4 shrink-0", active ? "text-foreground" : "invisible")} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{profile.name}</span>
                  <ServerTag server={profile.server} />
                </button>
              </li>
            )
          })}
        </ul>

        {creating ? (
          <form onSubmit={submit} className="mt-1 flex flex-wrap gap-2 px-1">
            <input
              autoFocus
              aria-label="New profile name"
              placeholder="e.g. JP alt"
              maxLength={MAX_PROFILE_NAME}
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={busy}
              className="h-10 min-w-0 flex-1 basis-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-ring"
            />
            <ServerPicker value={server} onChange={setServer} disabled={busy} label="New profile server" />
            <span className="flex-1" />
            <button type="submit" disabled={busy || !name.trim()} className="h-10 cursor-pointer rounded-md bg-foreground px-3 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-50">
              {busy ? "…" : "Add"}
            </button>
          </form>
        ) : (
          <button
            type="button"
            disabled={busy || atCap || !account.ready}
            title={atCap ? `You can have up to ${MAX_PROFILES} profiles.` : undefined}
            onClick={() => setCreating(true)}
            className={ROW}
          >
            <Plus className="size-4" aria-hidden="true" />
            New profile
          </button>
        )}
        {error ? <p role="alert" className="px-3 pt-1 text-xs text-amber-500">{error}</p> : null}

        <div className="my-2 h-px bg-border" />
        <Link href="/account#profiles" onClick={() => onOpenChange(false)} className={ROW}>
          <Settings2 className="size-4" aria-hidden="true" />
          Manage profiles
        </Link>
        <Link href={`/account?next=${encodeURIComponent(pathname)}`} onClick={() => onOpenChange(false)} className={ROW}>
          <UserRound className="size-4" aria-hidden="true" />
          <span className="flex-1">{account.user ? account.settings.displayName || "Account" : "Sign in"}</span>
          <span className="text-xs text-muted-foreground">{account.user ? account.status : "Guest"}</span>
        </Link>
      </PopoverContent>
    </Popover>
  )
}
