"use client"

import { useEffect, useState } from "react"
import { Cloud, LogOut, UserRound } from "lucide-react"
import { EmailAuth } from "@/components/account/EmailAuth"
import { useAccount } from "@/components/account/AccountProvider"
import { ProfilesManager } from "@/components/account/ProfilesManager"
import { Button } from "@/components/ui/button"

export default function AccountPage() {
  const account = useAccount()
  const [name, setName] = useState(account.settings.displayName)
  const [callbackFailed, setCallbackFailed] = useState(false)
  useEffect(() => { setName(account.settings.displayName) }, [account.settings.displayName])
  useEffect(() => { setCallbackFailed(new URLSearchParams(location.search).has("error")) }, [])
  if (!account.user) return <main className="min-h-[calc(100dvh-4rem)] bg-card/50 px-6 py-10 sm:py-16">
    {callbackFailed && <p role="alert" className="mx-auto mb-6 max-w-[480px] rounded-lg border border-amber-400/30 bg-amber-400/10 p-4 text-sm">Sign-in was canceled or could not be completed. Email links may have expired; request a new one.</p>}
    <EmailAuth />
    <div className="mx-auto mt-12 w-full max-w-[480px]"><ProfilesManager /></div>
  </main>
  const hasDeviceProgress = account.importCandidates.some((candidate) => candidate.hasProgress)
  return <main className="mx-auto max-w-2xl space-y-6 px-4 py-10 sm:px-6">
    <div className="flex items-center gap-3"><UserRound className="size-7 text-cyan-400" /><h1 className="text-3xl font-semibold">Your account</h1></div>
    <p className="text-muted-foreground">Save your servants, inventory, and planning progress across devices. Your account and progress are private.</p>
      <section className="space-y-5 rounded-xl border border-border bg-card p-6">
        <p className="break-all text-sm text-muted-foreground">Signed in as {account.user.email}</p>
        <form className="space-y-3" onSubmit={e => { e.preventDefault(); account.editSettings({ ...account.settings, displayName: name }) }}>
          <label htmlFor="display-name" className="block font-medium">Display name</label>
          <input id="display-name" maxLength={80} value={name} onChange={e => setName(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2" />
          <Button type="submit" className="cursor-pointer" disabled={name.trim() === account.settings.displayName}>Save name</Button>
        </form>
        <label className="flex items-center justify-between gap-4">Theme<select className="cursor-pointer rounded-md border border-border bg-background p-2" value={account.settings.theme} onChange={e => account.editSettings({ ...account.settings, theme: e.target.value as "dark" | "light" })}><option value="dark">Dark</option><option value="light">Light</option></select></label>
      </section>
      <ProfilesManager />
      <section className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2"><Cloud className="size-5" /><h2 className="font-semibold">Cloud progress</h2><span className="ml-auto text-sm" role="status">{account.status}</span></div>
        <p className="text-sm text-muted-foreground">Changes to the active profile save automatically. Unsynced changes stay on this device and are kept separate from guest progress.</p>
        <div className="flex flex-wrap gap-3"><Button variant="outline" className="cursor-pointer" disabled={account.sync?.busy} onClick={account.retry}>Sync now</Button><Button variant="outline" className="cursor-pointer" disabled={!hasDeviceProgress} onClick={account.showImport}>Add device profiles</Button></div>
      </section>
      <Button variant="outline" className="cursor-pointer" disabled={account.sync?.busy} onClick={() => void account.signOut()}><LogOut className="size-4" />Sign out</Button>
  </main>
}
