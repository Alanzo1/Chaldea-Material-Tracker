"use client"

import { useMemo, useState } from "react"

import { useServants } from "@/app/contexts/HomePageContext"
import { HEADER_ACTION_BUTTON_CLASS, HeaderActionLink } from "@/components/HeaderActionLink"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"

type FilterKey = "classes" | "buffs" | "debuffs" | "traits" | "alignments" | "stars"

function formatLabel(value: string) {
  return value
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function FilterSection({
  title,
  options,
  selected,
  formatOptions = false,
  onToggle,
}: {
  title: string
  options: string[]
  selected: string[]
  formatOptions?: boolean
  onToggle: (value: string, checked: boolean) => void
}) {
  const [query, setQuery] = useState("")
  const visibleOptions = options.filter((option) =>
    option.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border bg-card/60 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
          {title}
        </h3>
        {selected.length > 0 && (
          <span className="rounded-full bg-muted px-1.5 py-px text-[10px] font-semibold text-foreground">
            {selected.length}
          </span>
        )}
      </div>
      <Input
        className="h-8 text-xs"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={`Search...`}
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
                onCheckedChange={(checked) => onToggle(option, checked === true)}
                className="size-3.5 rounded-sm"
              />
              <span className="text-xs leading-none text-foreground/80 group-hover:text-foreground transition-colors">
                {formatOptions ? formatLabel(option) : option}
              </span>
            </label>
          ))}
          {!visibleOptions.length && (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">No matches</p>
          )}
        </div>
      </ScrollArea>
    </section>
  )
}

export function NavBar() {
  const { servants, filters, setFilters } = useServants()

  const classOptions = useMemo<string[]>(
    () => {
      const values: string[] = servants.map((servant: any) =>
        String(servant.className).toLowerCase()
      )
      return [...new Set(values)].sort()
    },
    [servants]
  )

  const buffOptions = useMemo<string[]>(
    () => {
      const values: string[] = servants.flatMap((servant: any) =>
        (servant.buffs ?? []).map((buff: string) => String(buff))
      )
      return [...new Set(values)].sort()
    },
    [servants]
  )

  const debuffOptions = useMemo<string[]>(
    () => {
      const values: string[] = servants.flatMap((servant: any) =>
        (servant.debuffs ?? []).map((debuff: string) => String(debuff))
      )
      return [...new Set(values)].sort()
    },
    [servants]
  )

  const traitOptions = useMemo<string[]>(
    () => {
      const values: string[] = servants.flatMap((servant: any) =>
        (servant.traits ?? []).map((trait: string) => String(trait))
      )
      return [...new Set(values)].sort()
    },
    [servants]
  )

  const alignmentOptions = useMemo<string[]>(
    () => {
      const values: string[] = servants.flatMap((servant: any) =>
        (servant.alignments ?? []).map((alignment: string) => String(alignment))
      )
      return [...new Set(values)].sort()
    },
    [servants]
  )

  const starOptions = useMemo<string[]>(
    () => {
      const values: string[] = servants.map((servant: any) => String(servant.stars))
      return [...new Set(values)].sort(
        (left, right) =>
          Number(right.match(/\((\d+)\)/)?.[1] ?? 0) -
          Number(left.match(/\((\d+)\)/)?.[1] ?? 0)
      )
    },
    [servants]
  )

  const activeFilters = [
    ...filters.classes.map((value: string) => ({ key: "classes" as FilterKey, value, label: `Class: ${formatLabel(value)}` })),
    ...filters.buffs.map((value: string) => ({ key: "buffs" as FilterKey, value, label: `Skill: ${value}` })),
    ...filters.debuffs.map((value: string) => ({ key: "debuffs" as FilterKey, value, label: `Debuff: ${value}` })),
    ...filters.traits.map((value: string) => ({ key: "traits" as FilterKey, value, label: `Trait: ${value}` })),
    ...filters.alignments.map((value: string) => ({ key: "alignments" as FilterKey, value, label: `Alignment: ${value}` })),
    ...filters.stars.map((value: string) => ({ key: "stars" as FilterKey, value, label: `Stars: ${value}` })),
  ]
  const activeFilterCount = activeFilters.length

  const handleToggle = (key: FilterKey, value: string, checked: boolean) => {
    setFilters((current: any) => ({
      ...current,
      [key]: checked
        ? [...current[key], value]
        : current[key].filter((entry: string) => entry !== value),
    }))
  }

  const clearFilters = () => {
    setFilters({ classes: [], buffs: [], debuffs: [], traits: [], alignments: [], stars: [] })
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/90">
      <div className="mx-auto flex w-full max-w-[1600px] items-center gap-4 px-5 py-4 md:px-8">

        {/* Brand */}
        <div className="flex-shrink-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-muted-foreground">
            Fate / Grand Order
          </p>
          <h1 className="mt-0.5 font-serif text-2xl font-bold leading-none tracking-tight text-foreground">
            Servant Database
          </h1>
        </div>

        {/* Divider */}
        <div className="mx-2 hidden h-8 w-px bg-border md:block" />

        {/* Controls */}
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {/* Filter popover */}
            <Popover>
              <PopoverTrigger asChild>
                <button className={`${HEADER_ACTION_BUTTON_CLASS} group relative gap-2`}>
                  <svg className="size-3.5 opacity-60 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2 4h12M4 8h8M6 12h4" />
                </svg>
                Filters
                {activeFilterCount > 0 && (
                  <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </PopoverTrigger>

            <PopoverContent
              align="start"
              sideOffset={8}
              className="w-[min(96vw,80rem)] rounded-xl border border-border bg-popover p-5 shadow-2xl"
            >
              {/* Filter grid */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <FilterSection title="Classes" options={classOptions} selected={filters.classes} formatOptions onToggle={(v, c) => handleToggle("classes", v, c)} />
                <FilterSection title="Skill Effects" options={buffOptions} selected={filters.buffs} onToggle={(v, c) => handleToggle("buffs", v, c)} />
                <FilterSection title="Debuffs" options={debuffOptions} selected={filters.debuffs} onToggle={(v, c) => handleToggle("debuffs", v, c)} />
                <FilterSection title="Traits" options={traitOptions} selected={filters.traits} onToggle={(v, c) => handleToggle("traits", v, c)} />
                <FilterSection title="Alignments" options={alignmentOptions} selected={filters.alignments} onToggle={(v, c) => handleToggle("alignments", v, c)} />
                <FilterSection title="Stars" options={starOptions} selected={filters.stars} onToggle={(v, c) => handleToggle("stars", v, c)} />
              </div>

              {/* Active filters strip */}
              {activeFilterCount > 0 && (
                <div className="mt-4 border-t border-border pt-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Active
                    </span>
                    {activeFilters.map((filter) => (
                      <button
                        key={`${filter.key}-${filter.value}`}
                        onClick={() => handleToggle(filter.key, filter.value, false)}
                        className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-medium text-foreground/80 transition-all hover:bg-muted/70 hover:text-foreground"
                      >
                        {filter.label}
                        <svg className="size-2.5 opacity-60" viewBox="0 0 8 8" fill="currentColor">
                          <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
                        </svg>
                      </button>
                    ))}
                    <button
                      onClick={clearFilters}
                      className="ml-1 text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline transition-colors"
                    >
                      Clear all
                    </button>
                  </div>
                </div>
              )}
            </PopoverContent>
          </Popover>

          {/* Nav links */}
          <HeaderActionLink
            href="/favorites"
            label="Favorites"
            icon={
              <svg className="size-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 13.5s-6-3.5-6-7.5a3 3 0 016 0 3 3 0 016 0c0 4-6 7.5-6 7.5z" />
              </svg>
            }
          />

          <HeaderActionLink
            href="/track-materials"
            label="Tracker"
            icon={
              <svg className="size-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h10v10H3zM6 6h4M6 9h4M6 12h2" />
              </svg>
            }
          />
        </div>

        {/* Status pill — far right */}
        <div className="hidden flex-shrink-0 md:block">
          <span className={`text-[11px] font-medium ${activeFilterCount ? "text-foreground/80" : "text-muted-foreground"}`}>
            {activeFilterCount
              ? `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} active`
              : "All servants"}
          </span>
        </div>
      </div>
    </header>
  )
}
