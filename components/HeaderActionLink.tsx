import Link from "next/link"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export const HEADER_ACTION_BUTTON_CLASS =
  "flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3.5 text-sm font-medium text-foreground/80 transition-all hover:bg-muted hover:text-foreground"

interface HeaderActionLinkProps {
  href: string
  label: string
  icon?: ReactNode
  className?: string
}

export function HeaderActionLink({
  href,
  label,
  icon,
  className,
}: HeaderActionLinkProps) {
  return (
    <Link href={href} className={cn(HEADER_ACTION_BUTTON_CLASS, className)}>
      {icon}
      {label}
    </Link>
  )
}

