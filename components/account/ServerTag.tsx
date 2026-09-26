import type { ReactNode } from "react"

import { REGIONS, type Region } from "@/lib/region"
import { cn } from "@/lib/utils"

export function ServerTag({ server }: { server: Region }) {
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide", server === "JP" ? "bg-rose-500/15 text-rose-600 dark:text-rose-300" : "bg-sky-500/15 text-sky-700 dark:text-sky-300")}>
      {server}
    </span>
  )
}

// NA / JP choice for a game profile.
export function ServerPicker({ value, onChange, disabled, label }: { value: Region; onChange: (server: Region) => void; disabled?: boolean; label: ReactNode }) {
  return (
    <div role="radiogroup" aria-label={typeof label === "string" ? label : "Game server"} className="flex h-9 shrink-0 items-center rounded-md border border-border p-0.5">
      {REGIONS.map((server) => (
        <button
          key={server}
          type="button"
          role="radio"
          aria-checked={value === server}
          disabled={disabled}
          onClick={() => onChange(server)}
          className={cn(
            "h-full cursor-pointer rounded px-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50",
            value === server ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
          )}
        >
          {server}
        </button>
      ))}
    </div>
  )
}
