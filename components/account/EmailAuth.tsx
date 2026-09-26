"use client"

import { useState, type FormEvent } from "react"
import { getSupabase } from "@/lib/supabase/browser"
import { safeReturnPath } from "@/lib/auth-redirect"
import { Eye, EyeOff } from "lucide-react"
import { useAccount } from "@/components/account/AccountProvider"

type Mode = "signin" | "signup" | "reset"
export function EmailAuth() {
  const account = useAccount()
  const client = getSupabase()
  const [mode, setMode] = useState<Mode>("signup")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [canResend, setCanResend] = useState(false)
  const changeMode = (next: Mode) => { setMode(next); setError(""); setMessage(""); setPassword(""); setShowPassword(false); setCanResend(false) }
  const callback = () => {
    const url = new URL("/auth/callback", location.origin)
    url.searchParams.set("next", mode === "reset" ? "/account/password" : safeReturnPath(new URLSearchParams(location.search).get("next") ?? "/account"))
    return url.toString()
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!client || busy) return
    setError(""); setMessage("")
    setBusy(true)
    try {
      const address = email.trim()
      if (mode === "reset") {
        const { error } = await client.auth.resetPasswordForEmail(address, { redirectTo: callback() })
        if (error) throw error
        setMessage("If an account exists for this email, you’ll receive a password reset link.")
      } else if (mode === "signup") {
        const { data, error } = await client.auth.signUp({ email: address, password, options: { emailRedirectTo: callback() } })
        if (error) throw error
        setPassword(""); setShowPassword(false)
        if (data.session) location.assign(safeReturnPath(new URLSearchParams(location.search).get("next") ?? "/account"))
        else { setMessage("Check your email to confirm your account. If you already have an account, sign in or reset your password."); setCanResend(true) }
      } else {
        const { error } = await client.auth.signInWithPassword({ email: address, password })
        if (error) throw error
        setPassword("")
        location.assign(safeReturnPath(new URLSearchParams(location.search).get("next") ?? "/account"))
      }
    } catch (error) {
      const code = (error as { code?: string }).code
      if (code === "email_not_confirmed") { setError("Confirm your email before signing in."); setCanResend(true) }
      else if (code === "invalid_credentials") setError("Email or password is incorrect.")
      else if (code === "weak_password") setError("Choose a stronger password with at least 8 characters.")
      else if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit") setError("Too many attempts. Please wait a few minutes and try again.")
      else setError("Could not complete this request. Check your connection and try again. Email delivery may need to be configured.")
    } finally { setBusy(false) }
  }
  async function resend() {
    if (!client || busy) return
    setBusy(true); setError("")
    try {
      const { error } = await client.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: callback() } })
      if (error) throw error
      setMessage("If confirmation is needed, a new email is on its way. Check your inbox and spam folder.")
    } catch { setError("Could not resend confirmation. Wait a few minutes and try again.") }
    finally { setBusy(false) }
  }
  return <section className="mx-auto w-full max-w-[480px]">
    <header className="mb-9 space-y-3">
      <h1 className="text-4xl font-medium tracking-tight sm:text-5xl">{mode === "signup" ? "Get started" : mode === "signin" ? "Welcome back" : "Reset password"}</h1>
      <p className="text-lg text-muted-foreground">{mode === "signup" ? "Create a new account" : mode === "signin" ? "Sign in to your account" : "We’ll email you a reset link"}</p>
    </header>
    {mode !== "reset" && <>
      <button type="button" disabled={busy || !client} onClick={() => void account.signIn(new URLSearchParams(location.search).get("next") ?? "/account")} className="flex h-14 w-full items-center justify-center gap-3 rounded-xl border border-border bg-muted/40 px-4 text-base font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:h-16 sm:text-lg">
        <svg aria-hidden="true" viewBox="0 0 48 48" className="size-6 shrink-0">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.02 46.98 31.86 46.98 24.55Z" />
          <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.78-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
        </svg>
        Continue with Google
      </button>
      <div className="my-7 flex items-center gap-5 text-sm text-muted-foreground"><span className="h-px flex-1 bg-border" /><span>or</span><span className="h-px flex-1 bg-border" /></div>
    </>}
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-2.5">
        <label className="block text-base" htmlFor="auth-email">Email</label>
        <input id="auth-email" type="email" autoComplete="email" placeholder="you@example.com" required value={email} onChange={e => { setEmail(e.target.value); setCanResend(false) }} disabled={busy} className="h-14 w-full rounded-xl border border-border bg-background/60 px-4 text-base outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-50 sm:h-16" />
      </div>
      {mode !== "reset" && <div className="space-y-2.5">
        <label className="block text-base" htmlFor="auth-password">Password</label>
        <div className="relative">
          <input id="auth-password" type={showPassword ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder="••••••••" minLength={mode === "signup" ? 8 : undefined} aria-describedby={mode === "signup" ? "password-hint" : undefined} required value={password} onChange={e => setPassword(e.target.value)} disabled={busy} className="h-14 w-full rounded-xl border border-border bg-background/60 py-3 pl-4 pr-14 text-base outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-50 sm:h-16" />
          <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)} className="absolute inset-y-0 right-0 flex w-14 items-center justify-center rounded-r-xl text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}</button>
        </div>
        {mode === "signup" && <p id="password-hint" className="text-xs text-muted-foreground">At least 8 characters</p>}
        {mode === "signin" && <button type="button" disabled={busy} onClick={() => changeMode("reset")} className="block text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">Forgot password?</button>}
      </div>}
      {error && <p role="alert" className="text-sm text-amber-500">{error}</p>}
      {message && <p role="status" className="text-sm text-emerald-500">{message}</p>}
      <button type="submit" disabled={busy || !client} className="h-14 w-full rounded-xl bg-gradient-to-b from-fuchsia-300 to-fuchsia-400 px-4 text-lg font-semibold text-zinc-950 shadow-sm transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50">{busy ? "Please wait…" : mode === "signup" ? "Sign up" : mode === "reset" ? "Send reset link" : "Sign in"}</button>
    </form>
    {canResend && <button disabled={busy} onClick={() => void resend()} className="mt-4 text-sm text-muted-foreground underline underline-offset-4">Resend confirmation email</button>}
    <p className="mt-6 text-center text-sm text-muted-foreground">{mode === "signup" ? "Already have an account? " : mode === "signin" ? "Don’t have an account? " : "Remember your password? "}<button type="button" disabled={busy} onClick={() => changeMode(mode === "signin" ? "signup" : "signin")} className="font-medium text-foreground underline underline-offset-4">{mode === "signin" ? "Sign up" : "Sign in"}</button></p>
    {!client && <p className="mt-4 text-sm text-muted-foreground">Accounts are not configured on this deployment.</p>}
  </section>
}
