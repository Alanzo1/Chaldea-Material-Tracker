import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function getServerSupabase() {
  const cookieStore = await cookies()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (entries) => { entries.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) },
    },
  })
}
