"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, type ReactNode } from "react"

import { useAccount } from "@/components/account/AccountProvider"
import { LoadingState } from "@/components/ui/spinner"
import { useDataRegion } from "@/lib/data-region"
import { switchRegionPath } from "@/lib/region"

// Planning always shows the active game profile: a JP profile opened on /track-materials
// moves to /jp/track-materials, and the other way round.
export function PlanningRegionGuard({ children }: { children: ReactNode }) {
  const { region } = useDataRegion()
  const { activeProfile, ready } = useAccount()
  const pathname = usePathname() ?? "/"
  const router = useRouter()
  const server = activeProfile?.server
  const mismatch = Boolean(ready && server && server !== region)

  useEffect(() => {
    if (mismatch && server) router.replace(switchRegionPath(pathname, server, () => false))
  }, [mismatch, server, pathname, router])

  if (mismatch) return <LoadingState label={`Opening ${server} Planning…`} className="min-h-[50vh]" />
  return children
}
