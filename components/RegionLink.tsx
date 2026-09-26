"use client"

import Link from "next/link"
import type { ComponentProps } from "react"

import { useDataRegion } from "@/lib/data-region"

type RegionLinkProps = Omit<ComponentProps<typeof Link>, "href"> & { href: string }

// next/link that maps NA routes to the current region's (/servantpage/1 → /jp/servants/1 on JP pages).
// Links outside the regional sections (e.g. /account) pass through unchanged.
export function RegionLink({ href, ...props }: RegionLinkProps) {
  const { href: toRegion } = useDataRegion()
  return <Link href={toRegion(href)} {...props} />
}
