"use client"

import { useMemo, useState } from "react"
import Link from "next/link"

import { useServants } from "@/app/contexts/HomePageContext"
import { Button } from "@/components/ui/button"
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
    <section className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <Input
        className="h-8"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={`Search ${title.toLowerCase()}...`}
      />
      <ScrollArea className="h-56 rounded-md border border-border/60 bg-background/70 p-3">
        <div className="space-y-2">
          {visibleOptions.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-0.5 text-sm hover:bg-muted/40"
            >
              <Checkbox
                checked={selected.includes(option)}
                onCheckedChange={(checked) => onToggle(option, checked === true)}
              />
              <span>{formatOptions ? formatLabel(option) : option}</span>
            </label>
          ))}
          {!visibleOptions.length ? (
            <p className="text-sm text-muted-foreground">No matches.</p>
          ) : null}
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
    ...filters.classes.map((value: string) => ({
      key: "classes" as FilterKey,
      value,
      label: `Class: ${formatLabel(value)}`,
    })),
    ...filters.buffs.map((value: string) => ({
      key: "buffs" as FilterKey,
      value,
      label: `Skill Effect: ${value}`,
    })),
    ...filters.debuffs.map((value: string) => ({
      key: "debuffs" as FilterKey,
      value,
      label: `Debuff Effect: ${value}`,
    })),
    ...filters.traits.map((value: string) => ({
      key: "traits" as FilterKey,
      value,
      label: `Trait: ${value}`,
    })),
    ...filters.alignments.map((value: string) => ({
      key: "alignments" as FilterKey,
      value,
      label: `Alignment: ${value}`,
    })),
    ...filters.stars.map((value: string) => ({
      key: "stars" as FilterKey,
      value,
      label: `Stars: ${value}`,
    })),
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
    setFilters({
      classes: [],
      buffs: [],
      debuffs: [],
      traits: [],
      alignments: [],
      stars: [],
    })
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Fate/Grand Order
            </p>
            <h1 className="text-xl font-semibold leading-none">Servant Database</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button className="h-9 rounded-full px-4" variant="secondary">
                  Advanced Filter
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(96vw,96rem)] space-y-4 rounded-2xl border border-border/70 bg-card/95 p-4 shadow-xl">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                  <FilterSection
                    title="Classes"
                    options={classOptions}
                    selected={filters.classes}
                    formatOptions
                    onToggle={(value, checked) => handleToggle("classes", value, checked)}
                  />
                  <FilterSection
                    title="Skill Effects"
                    options={buffOptions}
                    selected={filters.buffs}
                    onToggle={(value, checked) => handleToggle("buffs", value, checked)}
                  />
                  <FilterSection
                    title="Debuff Effects"
                    options={debuffOptions}
                    selected={filters.debuffs}
                    onToggle={(value, checked) => handleToggle("debuffs", value, checked)}
                  />
                  <FilterSection
                    title="Traits"
                    options={traitOptions}
                    selected={filters.traits}
                    onToggle={(value, checked) => handleToggle("traits", value, checked)}
                  />
                  <FilterSection
                    title="Alignments"
                    options={alignmentOptions}
                    selected={filters.alignments}
                    onToggle={(value, checked) => handleToggle("alignments", value, checked)}
                  />
                  <FilterSection
                    title="Stars"
                    options={starOptions}
                    selected={filters.stars}
                    onToggle={(value, checked) => handleToggle("stars", value, checked)}
                  />
                </div>
                <section className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Active Filters
                  </h3>
                  <ScrollArea className="h-44 rounded-md border border-border/60 bg-background/70 p-3">
                    <div className="space-y-2">
                      {activeFilters.map((filter) => (
                        <label
                          key={`${filter.key}-${filter.value}`}
                          className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-0.5 text-sm hover:bg-muted/40"
                        >
                          <Checkbox
                            checked
                            onCheckedChange={(checked) =>
                              handleToggle(filter.key, filter.value, checked === true)
                            }
                          />
                          <span>{filter.label}</span>
                        </label>
                      ))}
                      {!activeFilters.length ? (
                        <p className="text-sm text-muted-foreground">No active filters.</p>
                      ) : null}
                    </div>
                  </ScrollArea>
                </section>
                <Button variant="ghost" onClick={clearFilters}>
                  Clear filters
                </Button>
              </PopoverContent>
            </Popover>

            <Button asChild className="h-9 rounded-full px-4" variant="outline">
              <Link href="/favorites">Favorites</Link>
            </Button>
            <Button asChild className="h-9 rounded-full px-4" variant="outline">
              <Link href="/track-materials">Tracker</Link>
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {activeFilterCount
            ? `${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"} applied`
            : "No filters applied"}
        </p>
      </div>
    </header>
  )
}
