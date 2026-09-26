"use client"

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { Dialog } from "radix-ui"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import { getSupabase } from "@/lib/supabase/browser"
import { safeReturnPath } from "@/lib/auth-redirect"
import { activateTracker, readGuestProgress, setGuestKeyResolver, type TrackedMaterialsState } from "@/lib/material-tracker"
import { emptyDocument, hasProgress, hydrateDocument, toDocument, validateDocument, type CloudSnapshot, type PendingSave, type PrivateProfile, type ProgressDocument } from "@/lib/cloud-progress"
import { CloudSync, type SyncStorage, type SyncTransport } from "@/lib/cloud-sync"
import {
  ProfileError,
  createProfile as addProfileToList,
  deleteProfile as removeProfileFromList,
  describeProfileError,
  guestProgressKey,
  loadGuestProfiles,
  normalizeProfileName,
  planImport,
  renameProfile as renameProfileInList,
  saveGuestProfiles,
  type ProfileMeta,
} from "@/lib/profiles"

const browserStore = { get: (key: string) => localStorage.getItem(key), set: (key: string, value: string) => localStorage.setItem(key, value) }
const newId = () => crypto.randomUUID()
// Tracker reads before the provider mounts (and guest writes) go to the active device profile.
setGuestKeyResolver(() => guestProgressKey(loadGuestProfiles(browserStore, newId).active))

const accountKey = (userId: string) => `chaldea:account:${userId}`
const profileCacheKey = (userId: string, profileId: string) => `${accountKey(userId)}:profile:${profileId}`
const activeProfileKey = (userId: string) => `${accountKey(userId)}:active`
const profileListKey = (userId: string) => `${accountKey(userId)}:profiles`
const importSeenKey = (userId: string) => `${accountKey(userId)}:import-seen`

const readCache = (key: string): PendingSave | null => {
  const raw = localStorage.getItem(key)
  if (!raw) return null
  const saved = JSON.parse(raw) as PendingSave
  validateDocument(saved.document)
  if (!Number.isInteger(saved.revision) || saved.revision < 0 || typeof saved.dirty !== "boolean" || !saved.profile || typeof saved.profile.displayName !== "string" || !["dark", "light"].includes(saved.profile.theme)) throw new Error("The device save could not be read. It has not been replaced.")
  return saved
}
const guestTheme = (): "dark" | "light" => localStorage.getItem("theme") === "light" ? "light" : "dark"
const applyTheme = (theme: "dark" | "light") => document.documentElement.classList.toggle("dark", theme === "dark")
const blankState = (): TrackedMaterialsState => ({ version: 1, servants: [], ownedByMaterialId: {}, qp: 0 })

export interface ImportCandidate extends ProfileMeta {
  document: ProgressDocument
  hasProgress: boolean
}
const readImportCandidates = (): ImportCandidate[] =>
  loadGuestProfiles(browserStore, newId).profiles.map((meta) => {
    const document = toDocument(readGuestProgress(guestProgressKey(meta.id)))
    return { ...meta, document, hasProgress: hasProgress(document) }
  })

interface CloudProfileRow extends ProfileMeta {
  document: unknown
  revision: number
}
interface CloudState {
  settings: PrivateProfile | null
  profiles: CloudProfileRow[]
}

// Thin wrapper over the profile RPCs; every call carries the current session's token.
function cloudApi(client: SupabaseClient, token: () => Promise<string>) {
  const rpc = async <T,>(name: string, args?: Record<string, unknown>): Promise<T> => {
    const { data, error } = await client.rpc(name, args).setHeader("Authorization", `Bearer ${await token()}`)
    if (error) throw error
    return data as T
  }
  return {
    readAll: async (): Promise<CloudState> => {
      const data = await rpc<{ settings: { display_name: string; theme: "dark" | "light" } | null; profiles: CloudProfileRow[] }>("read_progress_profiles")
      return {
        settings: data.settings ? { displayName: data.settings.display_name, theme: data.settings.theme } : null,
        profiles: data.profiles.map((row) => ({ id: row.id, name: row.name, document: row.document, revision: row.revision })),
      }
    },
    create: (name: string, document: ProgressDocument) => rpc<{ id: string; name: string; revision: number }>("create_progress_profile", { profile_name: name, progress_document: document }),
    save: async (id: string, revision: number, document: ProgressDocument) => Number(await rpc("save_progress_profile", { profile_id: id, expected_revision: revision, progress_document: document })),
    rename: (id: string, name: string) => rpc<void>("rename_progress_profile", { profile_id: id, profile_name: name }),
    remove: (id: string) => rpc<void>("delete_progress_profile", { profile_id: id }),
    saveSettings: (settings: PrivateProfile) => rpc<void>("save_account_settings", { display_name: settings.displayName, theme: settings.theme }),
  }
}

/** What the active session (guest or account) can do with game profiles. */
interface ProfileSession {
  switchTo(id: string): Promise<void>
  create(name: string): Promise<void>
  rename(id: string, name: string): Promise<void>
  remove(id: string): Promise<void>
}

interface AccountContextValue {
  user: User | null
  settings: PrivateProfile
  status: string
  error: string
  notice: string
  ready: boolean
  configured: boolean
  sync: CloudSync | null
  profiles: ProfileMeta[]
  activeProfile: ProfileMeta | null
  switchProfile: (id: string) => Promise<void>
  createProfile: (name: string) => Promise<void>
  renameProfile: (id: string, name: string) => Promise<void>
  deleteProfile: (id: string) => Promise<void>
  importOffered: boolean
  importCandidates: ImportCandidate[]
  signIn: (next?: string) => Promise<void>
  signOut: () => Promise<void>
  retry: () => void
  dismissNotice: () => void
  editSettings: (settings: PrivateProfile) => void
  showImport: () => void
  importGuest: () => Promise<void>
  dismissImport: () => void
}
const AccountContext = createContext<AccountContextValue | null>(null)
export function useAccount() {
  const value = useContext(AccountContext)
  if (!value) throw new Error("AccountProvider is missing")
  return value
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const client = getSupabase()
  const passwordPage = usePathname() === "/account/password"
  const [user, setUser] = useState<User | null>(null)
  const [settings, setSettings] = useState<PrivateProfile>({ displayName: "", theme: "dark" })
  // Guests are ready immediately; only a signed-in account waits for its save.
  const [ready, setReady] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [profiles, setProfiles] = useState<ProfileMeta[]>([])
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  const [importOffered, setImportOffered] = useState(false)
  const [importCandidates, setImportCandidates] = useState<ImportCandidate[]>([])
  const [, render] = useState(0)
  const engine = useRef<CloudSync | null>(null)
  const session = useRef<ProfileSession | null>(null)
  const api = useRef<ReturnType<typeof cloudApi> | null>(null)
  const settingsRef = useRef(settings)
  const profilesRef = useRef<ProfileMeta[]>([])
  const sessionEpoch = useRef(0)
  const activeUser = useRef<string | null | undefined>(undefined)
  const reload = useRef<() => void>(() => {})

  const showProfiles = (list: ProfileMeta[], active: string) => {
    profilesRef.current = list
    setProfiles(list)
    setActiveProfileId(active)
  }
  const showSettings = (next: PrivateProfile) => {
    settingsRef.current = next
    setSettings(next)
    applyTheme(next.theme)
  }

  useEffect(() => {
    let alive = true
    const update = () => { if (alive) render(v => v + 1) }

    // ── Guest: profiles live in this browser ──────────────────────────────
    const startGuest = (): ProfileSession => {
      let data = loadGuestProfiles(browserStore, newId)
      const commit = (next: typeof data) => {
        saveGuestProfiles(browserStore, next)
        data = next
        showProfiles(next.profiles, next.active)
      }
      const open = (id: string) => {
        commit({ ...data, active: id })
        activateTracker(readGuestProgress(guestProgressKey(id)), null)
      }
      open(data.active)
      return {
        switchTo: async (id) => open(id),
        create: async (name) => {
          const id = newId()
          commit({ ...data, profiles: addProfileToList(data.profiles, name, id) })
          open(id)
        },
        rename: async (id, name) => commit({ ...data, profiles: renameProfileInList(data.profiles, id, name) }),
        remove: async (id) => {
          const { profiles: remaining, nextActive } = removeProfileFromList(data.profiles, id)
          const wasActive = data.active === id
          commit({ ...data, profiles: remaining, active: wasActive ? nextActive : data.active })
          localStorage.removeItem(guestProgressKey(id))
          if (wasActive) open(nextActive)
        },
      }
    }

    // ── Signed in: one cloud row per profile; CloudSync runs for the active one ──
    const startAccount = async (nextUser: User, valid: () => boolean): Promise<ProfileSession | null> => {
      const sessionToken = async () => {
        const { data, error } = await client!.auth.getSession()
        if (error || !valid() || data.session?.user.id !== nextUser.id) throw new Error("Your session changed. Sign in again to sync this account.")
        return data.session.access_token
      }
      const cloud = cloudApi(client!, sessionToken)
      api.current = cloud
      const fallbackSettings: PrivateProfile = { displayName: String(nextUser.user_metadata.full_name ?? "").slice(0, 80), theme: guestTheme() }
      let activeId = ""
      let switching: Promise<void> | null = null

      const storageFor = (id: string): SyncStorage => ({
        write: (saved) => { localStorage.setItem(profileCacheKey(nextUser.id, id), JSON.stringify(saved)) },
        backup: (saved) => { localStorage.setItem(`${accountKey(nextUser.id)}:recovery:${Date.now()}:${crypto.randomUUID()}`, JSON.stringify(saved)) },
      })
      const transportFor = (id: string): SyncTransport => ({
        read: async () => {
          const state = await cloud.readAll()
          applyCloudState(state)
          const row = state.profiles.find((profile) => profile.id === id)
          if (!row) throw new Error("This profile was deleted on another device.")
          return { document: validateDocument(row.document), revision: row.revision, profile: settingsRef.current }
        },
        save: async (snapshot) => {
          try {
            return await cloud.save(id, snapshot.revision, snapshot.document)
          } catch (error) {
            if ((error as { code?: string })?.code === "P0002") void refreshList()
            throw error
          }
        },
      })

      const applyCloudState = (state: CloudState) => {
        if (!valid()) return
        showSettings(state.settings ?? settingsRef.current)
        const list = state.profiles.map(({ id, name }) => ({ id, name }))
        localStorage.setItem(profileListKey(nextUser.id), JSON.stringify({ settings: state.settings, profiles: list }))
        const lost = activeId && !list.some((profile) => profile.id === activeId)
          ? profilesRef.current.find((profile) => profile.id === activeId)
          : null
        showProfiles(list, lost ? list[0]?.id ?? "" : activeId)
        if (lost && list[0]) {
          setNotice(`“${lost.name}” was deleted on another device.`)
          void openProfile(list[0].id)
        }
      }
      const refreshList = async () => {
        try { applyCloudState(await cloud.readAll()) } catch { /* the save error already shows */ }
      }

      const openProfile = async (id: string) => {
        engine.current?.dispose(); engine.current = null
        activeId = id
        localStorage.setItem(activeProfileKey(nextUser.id), id)
        setActiveProfileId(id)
        activateTracker(blankState(), () => {})
        setReady(false); setError("")
        let initial: PendingSave | null
        try {
          initial = readCache(profileCacheKey(nextUser.id, id))
        } catch {
          // Leave the unreadable copy untouched; Retry tries again.
          const message = "This profile's device copy couldn't be read. It has not been replaced."
          setError(message)
          throw new ProfileError(message)
        }
        const current = () => valid() && engine.current === sync
        const persist = (state: TrackedMaterialsState) => {
          if (current() && sync.current) sync.edit(toDocument(state), settingsRef.current)
        }
        const apply = async (snapshot: CloudSnapshot, stillCurrent: () => boolean) => {
          const state = await hydrateDocument(snapshot.document)
          if (!current() || !stillCurrent()) return
          activateTracker(state, persist)
          setReady(true)
        }
        const sync: CloudSync = new CloudSync(transportFor(id), storageFor(id), initial, apply, update)
        engine.current = sync
        if (initial) await apply(initial, current)
        if (!current()) return
        await sync.refresh()
      }

      // Send changes left unsynced in other profiles (e.g. a failed save before switching).
      const flushOtherProfiles = (list: ProfileMeta[]) => {
        for (const profile of list) {
          if (profile.id === activeId) continue
          let cached: PendingSave | null = null
          try { cached = readCache(profileCacheKey(nextUser.id, profile.id)) } catch { continue }
          if (!cached?.dirty) continue
          const background = new CloudSync(transportFor(profile.id), storageFor(profile.id), cached, async () => {}, () => {})
          void background.flush().finally(() => background.dispose())
        }
      }

      // Load the profile list: cloud first, then the last list seen on this device when offline.
      let state: CloudState
      try {
        state = await cloud.readAll()
        if (!state.profiles.length) {
          try { await cloud.create("Main", emptyDocument()) } catch (error) { if ((error as { code?: string }).code !== "23505") throw error }
          state = await cloud.readAll()
        }
      } catch (error) {
        const cached = JSON.parse(localStorage.getItem(profileListKey(nextUser.id)) ?? "null") as { settings: PrivateProfile | null; profiles: ProfileMeta[] } | null
        if (!cached?.profiles?.length) {
          const sessionChanged = error instanceof Error && error.message.startsWith("Your session")
          throw new Error(sessionChanged ? error.message : "Cloud saves are unavailable. Check the database migration and your connection, then retry.")
        }
        // Offline: open this device's copies; the active profile's sync shows "Not synced" until reconnected.
        state = { settings: cached.settings, profiles: cached.profiles.map((profile) => ({ ...profile, document: null, revision: 0 })) }
      }
      if (!valid()) return null

      // The pre-profiles device cache belongs to the backfilled "Main".
      const main = state.profiles.find((profile) => profile.name === "Main")
      const legacyCache = localStorage.getItem(accountKey(nextUser.id))
      if (main && legacyCache && !localStorage.getItem(profileCacheKey(nextUser.id, main.id))) {
        localStorage.setItem(profileCacheKey(nextUser.id, main.id), legacyCache)
      }

      showSettings(state.settings ?? fallbackSettings)
      const list = state.profiles.map(({ id, name }) => ({ id, name }))
      const remembered = localStorage.getItem(activeProfileKey(nextUser.id))
      activeId = list.some((profile) => profile.id === remembered) ? remembered! : list[0].id
      showProfiles(list, activeId)
      localStorage.setItem(profileListKey(nextUser.id), JSON.stringify({ settings: state.settings, profiles: list }))
      await openProfile(activeId)
      if (!valid()) return null
      flushOtherProfiles(list)

      const candidates = readImportCandidates()
      setImportCandidates(candidates)
      if (candidates.some((candidate) => candidate.hasProgress) && !localStorage.getItem(importSeenKey(nextUser.id))) setImportOffered(true)

      const run = async (task: () => Promise<void>) => {
        if (switching) await switching
        switching = task().finally(() => { switching = null })
        return switching
      }
      return {
        switchTo: (id) => run(async () => {
          const sync = engine.current
          if (sync?.busy) throw new ProfileError("Wait for the current save, then switch profiles.")
          // Unsaved changes are sent first; if that fails they stay in this profile's device copy.
          if (sync?.current?.dirty && !sync.conflict) await sync.flush()
          await openProfile(id)
        }),
        create: (name) => run(async () => {
          const clean = normalizeProfileName(name)
          addProfileToList(profilesRef.current, clean, "pending")
          const created = await cloud.create(clean, emptyDocument()).catch((error) => { throw new ProfileError(describeProfileError(error, clean)) })
          const nextList = [...profilesRef.current, { id: created.id, name: created.name }]
          showProfiles(nextList, activeId)
          const sync = engine.current
          if (sync?.current?.dirty && !sync.conflict) await sync.flush()
          await openProfile(created.id)
        }),
        rename: (id, name) => run(async () => {
          const nextList = renameProfileInList(profilesRef.current, id, name)
          const clean = nextList.find((profile) => profile.id === id)!.name
          await cloud.rename(id, clean).catch((error) => { throw new ProfileError(describeProfileError(error, clean)) })
          showProfiles(nextList, activeId)
        }),
        remove: (id) => run(async () => {
          const { profiles: remaining, nextActive } = removeProfileFromList(profilesRef.current, id)
          await cloud.remove(id).catch((error) => { throw new ProfileError(describeProfileError(error)) })
          localStorage.removeItem(profileCacheKey(nextUser.id, id))
          const wasActive = activeId === id
          showProfiles(remaining, wasActive ? nextActive : activeId)
          if (wasActive) await openProfile(nextActive)
        }),
      }
    }

    const activate = async (nextUser: User | null, force = false) => {
      if (!alive) return
      if (!force && activeUser.current === (nextUser?.id ?? null)) { if (nextUser) void engine.current?.refresh(); return }
      activeUser.current = nextUser?.id ?? null
      const epoch = ++sessionEpoch.current
      const valid = () => alive && epoch === sessionEpoch.current
      engine.current?.dispose(); engine.current = null
      session.current = null; api.current = null
      // Hide the previous store while an account loads; guests switch straight to device progress.
      if (nextUser) activateTracker(blankState(), () => {})
      setUser(nextUser); setReady(!nextUser); setError(""); setNotice(""); setImportOffered(false)
      try {
        if (!nextUser || !client) {
          session.current = startGuest()
          showSettings({ displayName: "", theme: guestTheme() })
          setReady(true)
          return
        }
        const started = await startAccount(nextUser, valid)
        if (valid()) session.current = started
      } catch (e) { if (valid()) setError(e instanceof Error ? e.message : "Could not load your saved progress.") }
    }
    reload.current = () => {
      if (engine.current?.current) { void engine.current.refresh(); return }
      if (client) void client.auth.getUser().then(({ data, error }) => {
        if (!alive) return
        if (error) setError("Unable to check your session. Reconnect and retry.")
        else void activate(data.user, true)
      })
      else void activate(null, true)
    }
    if (!client) void activate(null)
    else void client.auth.getSession().then(({ data, error }) => {
      if (!alive) return
      if (error) setError("Unable to restore your session. Reconnect and retry.")
      else void activate(data.session?.user ?? null)
    })
    const subscription = client?.auth.onAuthStateChange((_event, authSession) => {
      // Defer network work outside the auth callback's session lock.
      setTimeout(() => { if (alive) void activate(authSession?.user ?? null) }, 0)
    }).data.subscription
    // Reading the active profile also refreshes the list, so new or deleted profiles show up.
    const refresh = () => { if (document.visibilityState === "visible") void engine.current?.refresh() }
    window.addEventListener("online", refresh); window.addEventListener("focus", refresh)
    return () => { alive = false; sessionEpoch.current++; activeUser.current = undefined; engine.current?.dispose(); subscription?.unsubscribe(); window.removeEventListener("online", refresh); window.removeEventListener("focus", refresh) }
  }, [client])

  const sync = engine.current
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) ?? null
  const status = !user ? "Guest · saved on this device" : sync?.conflict ? "Save conflict" : error || sync?.error ? "Not synced" : !ready ? "Loading" : sync?.busy || sync?.current?.dirty ? "Saving" : "Saved"
  const withSession = async (action: (current: ProfileSession) => Promise<void>) => {
    const current = session.current
    if (!current) throw new ProfileError("Your profiles are still loading.")
    try {
      await action(current)
    } catch (error) {
      throw error instanceof ProfileError ? error : new ProfileError(describeProfileError(error))
    }
  }
  const value: AccountContextValue = {
    user, settings, status, ready, notice, error: error || sync?.error || "", configured: Boolean(client), sync,
    profiles, activeProfile,
    switchProfile: (id) => id === activeProfileId ? Promise.resolve() : withSession((current) => current.switchTo(id)),
    createProfile: (name) => withSession((current) => current.create(name)),
    renameProfile: (id, name) => withSession((current) => current.rename(id, name)),
    deleteProfile: (id) => withSession((current) => current.remove(id)),
    importOffered: importOffered && ready, importCandidates,
    signIn: async (next) => {
      if (!client) return
      setError("")
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! } })
        if (!response.ok) throw new Error("Authentication is unavailable. Reconnect and try again.")
        const authSettings = await response.json()
        if (!authSettings.external?.google) throw new Error("Google sign-in is not enabled yet. Enable the Google provider in Supabase to connect your account.")
        const path = safeReturnPath(next ?? location.pathname + location.search)
        const callback = new URL("/auth/callback", location.origin)
        callback.searchParams.set("next", path)
        const { error } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback.toString() } })
        if (error) throw new Error("Google sign-in is unavailable. Check the provider configuration and try again.")
      } catch (error) { setError(error instanceof Error ? error.message : "Sign-in failed. Please try again.") }
    },
    signOut: async () => {
      if (!client) return
      if (sync?.busy) { setError("Wait for the current save, then sign out."); return }
      const epoch = sessionEpoch.current
      if (sync?.current?.dirty) await sync.flush()
      if (epoch !== sessionEpoch.current) return
      const { error } = await client.auth.signOut({ scope: "local" })
      if (error) setError("Could not sign out. Please retry.")
    },
    retry: () => { setError(""); reload.current() },
    dismissNotice: () => setNotice(""),
    editSettings: (next) => {
      const normalized = { ...next, displayName: next.displayName.trim().slice(0, 80) }
      showSettings(normalized)
      if (user && api.current) void api.current.saveSettings(normalized).catch(() => setError("Couldn't save your name and theme. Retry when connected."))
      else localStorage.setItem("theme", next.theme)
    },
    showImport: () => { setImportCandidates(readImportCandidates()); setImportOffered(true) },
    dismissImport: () => { if (user) localStorage.setItem(importSeenKey(user.id), "true"); setImportOffered(false) },
    importGuest: async () => {
      const cloud = api.current
      if (!user || !cloud) return
      const plan = planImport(importCandidates, profilesRef.current)
      const byId = new Map(importCandidates.map((candidate) => [candidate.id, candidate]))
      const failed: string[] = []
      for (const profile of plan.add) {
        try { await cloud.create(profile.name, byId.get(profile.id)!.document) } catch { failed.push(profile.name) }
      }
      localStorage.setItem(importSeenKey(user.id), "true")
      setImportOffered(false)
      const added = plan.add.length - failed.length
      const parts = [`Added ${added} profile${added === 1 ? "" : "s"} from this device.`]
      if (plan.skippedOverCap.length) parts.push(`Not added (10-profile limit): ${plan.skippedOverCap.map((p) => p.name).join(", ")}.`)
      if (failed.length) parts.push(`Couldn't add: ${failed.join(", ")}. Try again from Account.`)
      setNotice(parts.join(" "))
      void engine.current?.refresh()
    },
  }
  return <AccountContext.Provider value={value}>
    {value.error && <div role="alert" className="border-b border-amber-500/40 bg-amber-500/10 p-3 text-center text-sm">{value.error} <button className="cursor-pointer underline" onClick={value.retry}>Retry</button></div>}
    {value.notice && <div role="status" className="border-b border-border bg-muted/40 p-3 text-center text-sm">{value.notice} <button className="cursor-pointer underline" onClick={value.dismissNotice}>Dismiss</button></div>}
    {!ready && <div className="p-4 text-center" role="status">{value.error ? "Your progress could not be loaded." : "Loading your progress…"}{user && <button className="ml-3 cursor-pointer underline" onClick={() => void value.signOut()}>Sign out</button>}</div>}
    {/* Tracker readers subscribe to store swaps, so the page never needs a remount. */}
    <div inert={!ready && !passwordPage} aria-busy={!ready && !passwordPage} className={!ready && !passwordPage ? "opacity-50" : undefined}>{children}</div>
    {!passwordPage && <SaveChoice />}
  </AccountContext.Provider>
}

const countMaterials = (d: ProgressDocument) => Object.values(d.ownedByMaterialId).reduce((sum, n) => sum + n, 0)
function SaveSummary({ title, document: d }: { title: string; document: ProgressDocument }) {
  return <div className="rounded-lg border border-border bg-background p-4"><p className="font-semibold">{title}</p><p className="mt-2 text-sm text-muted-foreground">{d.servants.length} servants · {countMaterials(d).toLocaleString()} materials · {d.qp.toLocaleString()} QP</p></div>
}
const DIALOG_BUTTON = "cursor-pointer rounded-md px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
function SaveChoice() {
  const a = useAccount()
  const conflict = a.sync?.conflict
  const [busy, setBusy] = useState(false)
  if (!a.ready || (!conflict && !a.importOffered)) return null
  const importable = a.importCandidates.filter((candidate) => candidate.hasProgress)
  return <Dialog.Root open>
    <Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70" />
    <Dialog.Content onEscapeKeyDown={e => e.preventDefault()} onPointerDownOutside={e => e.preventDefault()} className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 space-y-4 overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl">
      {conflict ? <>
        <Dialog.Title className="text-xl font-semibold">Choose which “{a.activeProfile?.name ?? "profile"}” progress to keep</Dialog.Title>
        <Dialog.Description className="text-sm text-muted-foreground">Another tab or device saved different progress for this profile. Both versions will be backed up on this device before replacement.</Dialog.Description>
        <SaveSummary title="This device" document={a.sync!.current!.document} />
        <SaveSummary title="Cloud" document={conflict.document} />
      </> : <>
        <Dialog.Title className="text-xl font-semibold">Add your {importable.length} device profile{importable.length === 1 ? "" : "s"} to your account?</Dialog.Title>
        <Dialog.Description className="text-sm text-muted-foreground">Each one becomes a new profile next to your existing ones. Nothing in your account is replaced, and the device copies stay on this device.</Dialog.Description>
        {importable.map((candidate) => <SaveSummary key={candidate.id} title={candidate.name} document={candidate.document} />)}
      </>}
      {a.error && <p role="alert" className="text-sm text-amber-300">{a.error}</p>}
      <div className="flex flex-wrap gap-3">
        <button autoFocus disabled={a.sync?.busy || busy} className={`${DIALOG_BUTTON} bg-primary text-primary-foreground`} onClick={() => conflict ? void a.sync?.resolve(false) : a.dismissImport()}>{conflict ? "Use cloud progress" : "Not now"}</button>
        <button disabled={a.sync?.busy || busy} className={`${DIALOG_BUTTON} border border-border`} onClick={() => {
          if (conflict) { void a.sync?.resolve(true); return }
          setBusy(true)
          void a.importGuest().finally(() => setBusy(false))
        }}>{conflict ? "Use this device’s progress" : busy ? "Adding…" : `Add ${importable.length} profile${importable.length === 1 ? "" : "s"}`}</button>
      </div>
    </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}
