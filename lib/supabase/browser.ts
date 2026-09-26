import { createBrowserClient } from "@supabase/ssr"

export const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
const makeClient = () => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!)
let client: ReturnType<typeof makeClient> | undefined
export function getSupabase() {
  if (!supabaseConfigured) return null
  return client ??= makeClient()
}
