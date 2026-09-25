"use client"

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export interface ChipOption<T> {
  value: T
  label: ReactNode
}

interface ChipGroupProps<T> {
  title: string
  options: ChipOption<T>[]
  selected: T[]
  onToggle: (value: T) => void
}

export function ChipGroup<T extends string | number>({
  title,
  options,
  selected,
  onToggle,
}: ChipGroupProps<T>) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const isSelected = selected.includes(option.value)
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onToggle(option.value)}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors",
                isSelected
                  ? "border-cyan-300/60 bg-cyan-400/15 text-foreground"
                  : "border-transparent bg-muted text-foreground/80 hover:bg-muted/70 hover:text-foreground"
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </section>
  )
}
