"use client"

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { Dialog } from "radix-ui"
import type { User } from "@supabase/supabase-js"
import { getSupabase } from "@/lib/supabase/browser"
import { safeReturnPath } from "@/lib/auth-redirect"
import { activateTracker, readGuestProgress, type TrackedMaterialsState } from "@/lib/material-tracker"
import { emptyDocument, hasProgress, hydrateDocument, toDocument, validateDocument, type CloudSnapshot, type PendingSave, type PrivateProfile } from "@/lib/cloud-progress"
import { CloudSync } from "@/lib/cloud-sync"

const cacheKey = (id: string) => `chaldea:account:${id}`
const readCache = (id: string): PendingSave | null => {
  const raw = localStorage.getItem(cacheKey(id))
  if (!raw) return null
  const saved = JSON.parse(raw) as PendingSave
  validateDocument(saved.document)
  if (!Number.isInteger(saved.revision) || saved.revision < 0 || typeof saved.dirty !== "boolean" || !saved.profile || typeof saved.profile.displayName !== "string" || !["dark", "light"].includes(saved.profile.theme)) throw new Error("The device save could not be read. It has not been replaced.")
  return saved
}
const guestTheme = (): "dark" | "light" => localStorage.getItem("theme") === "light" ? "light" : "dark"
const applyTheme = (theme: "dark" | "light") => document.documentElement.classList.toggle("dark", theme === "dark")

interface AccountContextValue {
  user: User | null
  profile: PrivateProfile
  status: string
  error: string
  ready: boolean
  configured: boolean
  sync: CloudSync | null
  importOffered: boolean
  guest: ReturnType<typeof toDocument> | null
  signIn: (next?: string) => Promise<void>
  signOut: () => Promise<void>
  retry: () => void
  editProfile: (profile: PrivateProfile) => void
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
  const [profile, setProfile] = useState<PrivateProfile>({ displayName: "", theme: "dark" })
  const [ready, setReady] = useState(false)
  const [error, setError] = useState("")
  const [importOffered, setImportOffered] = useState(false)
  const [guest, setGuest] = useState<ReturnType<typeof toDocument> | null>(null)
  const [viewKey, setViewKey] = useState(0)
  const [, render] = useState(0)
  const engine = useRef<CloudSync | null>(null)
  const sessionEpoch = useRef(0)
  const activeUser = useRef<string | null | undefined>(undefined)
  const reload = useRef<() => void>(() => {})

  useEffect(() => {
    let alive = true
    const update = () => { if (alive) render(v => v + 1) }
    const activate = async (nextUser: User | null, force = false) => {
      if (!alive) return
      if (!force && activeUser.current === (nextUser?.id ?? null)) { if (nextUser) void engine.current?.refresh(); return }
      activeUser.current = nextUser?.id ?? null
      const epoch = ++sessionEpoch.current
      const valid = () => alive && epoch === sessionEpoch.current
      engine.current?.dispose(); engine.current = null
      activateTracker({ version: 1, servants: [], ownedByMaterialId: {}, qp: 0 }, () => {})
      setUser(nextUser); setReady(false); setError(""); setImportOffered(false)
      try {
        const guestState = readGuestProgress()
        const guestDocument = toDocument(guestState)
        setGuest(guestDocument)
        if (!nextUser || !client) {
          activateTracker(guestState, null)
          const theme = guestTheme()
          setProfile({ displayName: "", theme }); applyTheme(theme)
          setViewKey(v => v + 1); setReady(true)
          return
        }
        const initial = readCache(nextUser.id)
        const persist = (state: TrackedMaterialsState) => {
          const sync = engine.current
          if (valid() && sync?.current) sync.edit(toDocument(state), sync.current.profile)
        }
        const apply = async (snapshot: CloudSnapshot, stillCurrent: () => boolean) => {
          const state = await hydrateDocument(snapshot.document)
          if (!valid() || !stillCurrent()) return
          activateTracker(state, persist)
          setProfile(snapshot.profile); applyTheme(snapshot.profile.theme)
          setViewKey(v => v + 1); setReady(true)
        }
        const sessionToken = async () => {
          const { data, error } = await client.auth.getSession()
          if (error || !valid() || data.session?.user.id !== nextUser.id) throw new Error("Your session changed. Sign in again to sync this account.")
          return data.session.access_token
        }
        const sync = new CloudSync({
          read: async () => {
            // One read joins the profile to the same committed progress revision.
            const token = await sessionToken()
            const { data, error } = await client.rpc("read_user_save").setHeader("Authorization", `Bearer ${token}`)
            if (error) throw new Error("Cloud saves are unavailable. Check the database migration and your connection, then retry.")
            if (!data) return { document: emptyDocument(), revision: 0, profile: { displayName: String(nextUser.user_metadata.full_name ?? "").slice(0, 80), theme: guestTheme() } }
            return { document: validateDocument(data.document), revision: data.revision, profile: { displayName: data.display_name, theme: data.theme } }
          },
          save: async (snapshot) => {
            const token = await sessionToken()
            const { data, error } = await client.rpc("save_user_progress", { expected_revision: snapshot.revision, progress_document: snapshot.document, profile_name: snapshot.profile.displayName, profile_theme: snapshot.profile.theme }).setHeader("Authorization", `Bearer ${token}`)
            if (error) throw error
            return Number(data)
          },
        }, {
          write: (saved) => { localStorage.setItem(cacheKey(nextUser.id), JSON.stringify(saved)) },
          backup: (saved) => { localStorage.setItem(`${cacheKey(nextUser.id)}:recovery:${Date.now()}:${crypto.randomUUID()}`, JSON.stringify(saved)) },
        }, initial, apply, update)
        engine.current = sync
        if (initial) await apply(initial, valid)
        if (!valid()) { sync.dispose(); return }
        await sync.refresh()
        if (!valid()) return
        if (hasProgress(guestDocument) && !localStorage.getItem(`${cacheKey(nextUser.id)}:import-seen`)) setImportOffered(true)
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
    const subscription = client?.auth.onAuthStateChange((_event, session) => {
      // Defer network work outside the auth callback's session lock.
      setTimeout(() => { if (alive) void activate(session?.user ?? null) }, 0)
    }).data.subscription
    const refresh = () => { if (document.visibilityState === "visible") void engine.current?.refresh() }
    window.addEventListener("online", refresh); window.addEventListener("focus", refresh)
    return () => { alive = false; sessionEpoch.current++; activeUser.current = undefined; engine.current?.dispose(); subscription?.unsubscribe(); window.removeEventListener("online", refresh); window.removeEventListener("focus", refresh) }
  }, [client])

  const sync = engine.current
  const status = !user ? "Guest · saved on this device" : sync?.conflict ? "Save conflict" : error || sync?.error ? "Not synced" : !ready ? "Loading" : sync?.busy || sync?.current?.dirty ? "Saving" : "Saved"
  const value: AccountContextValue = {
    user, profile, status, ready, error: error || sync?.error || "", configured: Boolean(client), sync,
    importOffered: importOffered && ready, guest,
    signIn: async (next) => {
      if (!client) return
      setError("")
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! } })
        if (!response.ok) throw new Error("Authentication is unavailable. Reconnect and try again.")
        const settings = await response.json()
        if (!settings.external?.google) throw new Error("Google sign-in is not enabled yet. Enable the Google provider in Supabase to connect your account.")
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
    editProfile: (next) => {
      const normalized = { ...next, displayName: next.displayName.trim().slice(0, 80) }
      setProfile(normalized); applyTheme(next.theme)
      if (user && sync?.current) sync.edit(sync.current.document, normalized)
      else localStorage.setItem("theme", next.theme)
    },
    showImport: () => { setGuest(toDocument(readGuestProgress())); setImportOffered(true) },
    dismissImport: () => { if (user) localStorage.setItem(`${cacheKey(user.id)}:import-seen`, "true"); setImportOffered(false) },
    importGuest: async () => {
      if (!user || !sync?.current || sync.busy || sync.conflict) return
      try {
        const state = readGuestProgress()
        localStorage.setItem(`${cacheKey(user.id)}:recovery:${Date.now()}`, JSON.stringify(sync.current))
        activateTracker(state, (state) => sync.edit(toDocument(state), sync.current!.profile))
        sync.edit(toDocument(state), profile)
        localStorage.setItem(`${cacheKey(user.id)}:import-seen`, "true")
        setImportOffered(false); setViewKey(v => v + 1)
      } catch { setError("Could not preserve the existing save. Free device storage and retry.") }
    },
  }
  return <AccountContext.Provider value={value}>
    {value.error && <div role="alert" className="border-b border-amber-500/40 bg-amber-500/10 p-3 text-center text-sm">{value.error} <button className="underline" onClick={value.retry}>Retry</button></div>}
    {!ready && <div className="p-4 text-center" role="status">{value.error ? "Your progress could not be loaded." : "Loading your progress…"}{user && <button className="ml-3 underline" onClick={() => void value.signOut()}>Sign out</button>}</div>}
    <div key={`${user?.id ?? "guest"}:${passwordPage ? "password" : viewKey}`} inert={!ready && !passwordPage} aria-busy={!ready && !passwordPage} className={!ready && !passwordPage ? "opacity-50" : undefined}>{children}</div>
    {!passwordPage && <SaveChoice />}
  </AccountContext.Provider>
}

function SaveSummary({ title, document: d, profile }: { title: string; document: ReturnType<typeof toDocument>; profile?: PrivateProfile }) {
  return <div className="rounded-lg border border-border bg-background p-4"><p className="font-semibold">{title}</p><p className="mt-2 text-sm text-muted-foreground">{d.servants.length} servants · {Object.values(d.ownedByMaterialId).reduce((sum, n) => sum + n, 0).toLocaleString()} materials · {d.qp.toLocaleString()} QP</p>{profile && <p className="mt-1 text-sm text-muted-foreground">{profile.displayName || "Unnamed profile"} · {profile.theme} theme</p>}</div>
}
function SaveChoice() {
  const a = useAccount()
  const conflict = a.sync?.conflict
  if (!a.ready || (!conflict && !a.importOffered)) return null
  return <Dialog.Root open>
    <Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70" />
    <Dialog.Content onEscapeKeyDown={e => e.preventDefault()} onPointerDownOutside={e => e.preventDefault()} className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 space-y-4 overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl">
      <Dialog.Title className="text-xl font-semibold">{conflict ? "Choose which progress to keep" : "Import progress from this device?"}</Dialog.Title>
      <Dialog.Description className="text-sm text-muted-foreground">{conflict ? "Another tab or device saved different progress. Both versions will be backed up on this device before replacement." : "Importing replaces your cloud progress. Your guest progress and a recovery copy of the cloud save will stay on this device."}</Dialog.Description>
      <SaveSummary title={conflict ? "This device" : "Guest progress"} document={conflict ? a.sync!.current!.document : a.guest ?? emptyDocument()} profile={conflict ? a.sync!.current!.profile : undefined} />
      <SaveSummary title="Cloud progress" document={conflict?.document ?? a.sync?.current?.document ?? emptyDocument()} profile={conflict?.profile ?? a.sync?.current?.profile} />
      {a.error && <p role="alert" className="text-sm text-amber-300">{a.error}</p>}
      <div className="flex flex-wrap gap-3">
        <button autoFocus disabled={a.sync?.busy} className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50" onClick={() => conflict ? void a.sync?.resolve(false) : a.dismissImport()}>{conflict ? "Use cloud progress" : "Keep cloud progress"}</button>
        <button disabled={a.sync?.busy} className="rounded-md border border-border px-4 py-2 disabled:opacity-50" onClick={() => conflict ? void a.sync?.resolve(true) : void a.importGuest()}>{conflict ? "Use this device’s progress" : "Import guest progress"}</button>
      </div>
    </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}
