import { NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase/server"
import { safeReturnPath } from "@/lib/auth-redirect"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const tokenHash = url.searchParams.get("token_hash")
  const type = url.searchParams.get("type")
  if ((code || (tokenHash && (type === "email" || type === "recovery"))) && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    try {
      const supabase = await getServerSupabase()
      const { error } = tokenHash && (type === "email" || type === "recovery")
        ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
        : await supabase.auth.exchangeCodeForSession(code!)
      if (!error) return NextResponse.redirect(new URL(type === "recovery" ? "/account/password" : safeReturnPath(url.searchParams.get("next")), url.origin))
    } catch { /* Show a recoverable, non-sensitive error below. */ }
  }
  return NextResponse.redirect(new URL("/account?error=sign-in", url.origin))
}
