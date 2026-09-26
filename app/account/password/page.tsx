"use client"
import { useState, type FormEvent } from "react"
import Link from "next/link"
import { getSupabase } from "@/lib/supabase/browser"
import { useAccount } from "@/components/account/AccountProvider"
import { Button } from "@/components/ui/button"

export default function PasswordPage() {
  const { user } = useAccount()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    const client = getSupabase()
    if (!client || !user || busy) return
    setError("")
    if (password !== confirm) { setError("Passwords do not match."); return }
    setBusy(true)
    try {
      const { error } = await client.auth.updateUser({ password })
      if (error) throw error
      setPassword(""); setConfirm(""); setDone(true)
    } catch { setError("Could not update your password. Try a different password or request a fresh reset link.") }
    finally { setBusy(false) }
  }
  return <main className="mx-auto max-w-lg space-y-5 px-4 py-10">
    <h1 className="text-3xl font-semibold">Set a new password</h1>
    {done ? <p role="status">Your password has been updated.</p> : !user ? <p>Open the reset link from your email, or sign in before changing your password.</p> : <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-card p-6">
      <label htmlFor="new-password" className="block text-sm">New password</label><input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-md border border-border bg-background p-2" />
      <label htmlFor="confirm-password" className="block text-sm">Confirm new password</label><input id="confirm-password" type="password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} className="w-full rounded-md border border-border bg-background p-2" />
      {error && <p role="alert" className="text-sm text-amber-400">{error}</p>}
      <Button disabled={busy} type="submit">{busy ? "Updating…" : "Update password"}</Button>
    </form>}
    <Link className="block text-cyan-500 underline" href="/account">Back to account</Link>
  </main>
}
