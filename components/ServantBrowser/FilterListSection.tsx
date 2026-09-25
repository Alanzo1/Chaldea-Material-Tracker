"use client"

import Image from "next/image"
import { ChevronDown } from "lucide-react"
import { useState } from "react"

import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

// Searchable checkbox list for large option sets (skill effects, debuffs, traits).
// Restored from the pre-d67cbbd NavBar filter popover, now collapsible.
export function FilterListSection({
  title,
  options,
  selected,
  onChange,
  icons,
}: {
  title: string
  options: string[]
  selected: string[]
  onChange: (value: string, checked: boolean) => void
  /** Optional option → image URL, shown before the label (e.g. drop item icons). */
  icons?: Record<string, string | null>
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const visibleOptions = options.filter((option) =>
    option.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <section className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex items-center justify-between rounded-md text-left"
      >
        <span className="flex items-center gap-2 text-base font-semibold text-foreground">
          {title}
          {selected.length > 0 && (
            <span className="rounded-full bg-cyan-400/15 px-2 py-px text-xs font-semibold text-cyan-200">
              {selected.length}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {open && (
        <>
          <Input
            className="h-8 text-xs"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${title.toLowerCase()}...`}
          />
          <ScrollArea className="h-52 rounded-md border border-border bg-background">
            <div className="space-y-px p-2">
              {visibleOptions.map((option) => (
                <label
                  key={option}
                  className="group flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
                >
                  <Checkbox
                    checked={selected.includes(option)}
                    onCheckedChange={(checked) => onChange(option, checked === true)}
                    className="size-3.5 rounded-sm"
                  />
                  {icons?.[option] ? (
                    <Image src={icons[option]!} alt="" width={28} height={28} className="size-7 shrink-0 object-contain" />
                  ) : null}
                  <span className="text-xs leading-none text-foreground/80 transition-colors group-hover:text-foreground">
                    {option}
                  </span>
                </label>
              ))}
              {!visibleOptions.length && (
                <p className="px-2 py-3 text-center text-xs text-muted-foreground">No matches</p>
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </section>
  )
}
