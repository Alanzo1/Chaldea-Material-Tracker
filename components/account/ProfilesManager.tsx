"use client"

import { Check, Pencil, Plus, Trash2, Users, X } from "lucide-react"
import { useState, type FormEvent } from "react"

import { useAccount } from "@/components/account/AccountProvider"
import { readTrackedMaterialsState } from "@/lib/material-tracker"
import { describeProfileError, MAX_PROFILE_NAME, MAX_PROFILES } from "@/lib/profiles"
import { cn } from "@/lib/utils"

const BUTTON = "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
const INPUT = "h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-ring"

type Editing = { kind: "rename"; id: string } | { kind: "delete"; id: string } | { kind: "create" } | null

// /account → Profiles: one per FGO game account. Works for guests (device) and signed-in users (cloud).
export function ProfilesManager() {
  const account = useAccount()
  const [editing, setEditing] = useState<Editing>(null)
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const close = () => { setEditing(null); setName(""); setError("") }
  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError("")
    try {
      await action()
      close()
    } catch (caught) {
      setError(describeProfileError(caught, name.trim()))
    } finally {
      setBusy(false)
    }
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (editing?.kind === "rename") void run(() => account.renameProfile(editing.id, name))
    if (editing?.kind === "create") void run(() => account.createProfile(name))
  }

  const onlyOne = account.profiles.length <= 1
  const atCap = account.profiles.length >= MAX_PROFILES
  // Servant count is only known for the loaded (active) profile.
  const activeServants = account.ready ? readTrackedMaterialsState().servants.length : null

  return (
    <section id="profiles" className="space-y-4 rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <Users className="size-5" aria-hidden="true" />
        <h2 className="font-semibold">Profiles</h2>
        <span className="ml-auto text-sm text-muted-foreground">{account.profiles.length} / {MAX_PROFILES}</span>
      </div>
      <p className="text-sm text-muted-foreground">
        Keep separate servants, materials and QP for each FGO account.{" "}
        {account.user ? "Profiles sync to your account." : "Guest profiles are saved on this device."}
      </p>

      <ul className="divide-y divide-border rounded-lg border border-border">
        {account.profiles.map((profile) => {
          const active = profile.id === account.activeProfile?.id
          const renaming = editing?.kind === "rename" && editing.id === profile.id
          const deleting = editing?.kind === "delete" && editing.id === profile.id
          return (
            <li key={profile.id} className="space-y-2 p-3">
              {renaming ? (
                <form onSubmit={submit} className="flex gap-2">
                  <input autoFocus aria-label={`Rename ${profile.name}`} maxLength={MAX_PROFILE_NAME} value={name} onChange={(event) => setName(event.target.value)} disabled={busy} className={INPUT} />
                  <button type="submit" disabled={busy || !name.trim()} className={BUTTON}><Check className="size-4" aria-hidden="true" />Save</button>
                  <button type="button" onClick={close} disabled={busy} className={BUTTON} aria-label="Cancel"><X className="size-4" aria-hidden="true" /></button>
                </form>
              ) : (
                <div className="flex items-center gap-2">
                  <span className={cn("min-w-0 flex-1 truncate text-sm", active && "font-semibold")}>{profile.name}</span>
                  {active ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Active</span>
                  ) : (
                    <button type="button" disabled={busy || !account.ready} onClick={() => void run(() => account.switchProfile(profile.id))} className={BUTTON}>Switch</button>
                  )}
                  <button type="button" disabled={busy} onClick={() => { setEditing({ kind: "rename", id: profile.id }); setName(profile.name); setError("") }} className={BUTTON} aria-label={`Rename ${profile.name}`}>
                    <Pencil className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={busy || onlyOne}
                    title={onlyOne ? "You can't delete your last profile." : undefined}
                    onClick={() => { setEditing({ kind: "delete", id: profile.id }); setError("") }}
                    className={BUTTON}
                    aria-label={`Delete ${profile.name}`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              )}
              {deleting ? (
                <div role="alertdialog" aria-label={`Delete ${profile.name}?`} className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  <p>
                    Delete “{profile.name}”
                    {active && activeServants !== null ? ` and its ${activeServants} tracked servant${activeServants === 1 ? "" : "s"}` : " and all of its progress"}
                    ? This can’t be undone.
                  </p>
                  <div className="flex gap-2">
                    <button type="button" disabled={busy} onClick={() => void run(() => account.deleteProfile(profile.id))} className={cn(BUTTON, "border-amber-500/50")}>
                      {busy ? "Deleting…" : "Delete profile"}
                    </button>
                    <button type="button" disabled={busy} onClick={close} className={BUTTON}>Cancel</button>
                  </div>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>

      {editing?.kind === "create" ? (
        <form onSubmit={submit} className="flex gap-2">
          <input autoFocus aria-label="New profile name" placeholder="e.g. JP alt" maxLength={MAX_PROFILE_NAME} value={name} onChange={(event) => setName(event.target.value)} disabled={busy} className={INPUT} />
          <button type="submit" disabled={busy || !name.trim()} className={BUTTON}>{busy ? "Adding…" : "Add"}</button>
          <button type="button" onClick={close} disabled={busy} className={BUTTON} aria-label="Cancel"><X className="size-4" aria-hidden="true" /></button>
        </form>
      ) : (
        <button type="button" disabled={busy || atCap || !account.ready} onClick={() => { setEditing({ kind: "create" }); setName(""); setError("") }} className={BUTTON}>
          <Plus className="size-4" aria-hidden="true" />
          New profile
        </button>
      )}
      {error ? <p role="alert" className="text-sm text-amber-500">{error}</p> : null}
    </section>
  )
}
