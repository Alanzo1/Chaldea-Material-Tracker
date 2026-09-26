import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function proxy(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return NextResponse.next()
  let response = NextResponse.next({ request })
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (entries) => {
        entries.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        entries.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })
  try { await supabase.auth.getClaims() } catch { /* Public pages remain usable during an Auth outage. */ }
  return response
}
export const config = { matcher: ["/((?!_next|data/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"] }
