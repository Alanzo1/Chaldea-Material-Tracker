import { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  subtitle?: string
  eyebrow?: string
  actions?: ReactNode
  className?: string
  sticky?: boolean
}

export function PageHeader({
  title,
  subtitle,
  eyebrow = "Fate / Grand Order",
  actions,
  className,
  sticky = true,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        sticky
          ? "sticky top-0 z-20 border-b border-border bg-background/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/90"
          : "border-b border-border bg-background/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/90",
        className
      )}
    >
      <div className="mx-auto flex w-full max-w-[1600px] items-center gap-4 px-5 py-4 md:px-8">
        <div className="flex-shrink-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-muted-foreground">
            {eyebrow}
          </p>
          <h1 className="mt-0.5 font-serif text-2xl font-bold leading-none tracking-tight text-foreground">
            {title}
          </h1>
        </div>

        <div className="mx-2 hidden h-8 w-px bg-border md:block" />

        <div className="flex flex-1 flex-wrap items-center gap-2">
          {actions}
        </div>

        {subtitle ? (
          <div className="hidden flex-shrink-0 md:block">
            <span className="text-[11px] font-medium text-muted-foreground">
              {subtitle}
            </span>
          </div>
        ) : null}
      </div>
      {subtitle ? (
        <div className="mx-auto w-full max-w-[1600px] px-5 pb-3 md:hidden md:px-8">
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
      ) : null}
    </header>
  )
}
