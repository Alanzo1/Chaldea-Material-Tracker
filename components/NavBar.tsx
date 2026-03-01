"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { useServants } from "@/app/contexts/HomePageContext"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"

type FilterKey = "classes" | "buffs" | "debuffs"

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
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={`Search ${title.toLowerCase()}...`}
      />
      <ScrollArea className="h-64 rounded-md border p-3">
        <div className="space-y-2">
          {visibleOptions.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-2 text-sm"
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
    </div>
  )
}

export function NavBar() {
  const router = useRouter()
  const { servants, filters, setFilters } = useServants()

  const classOptions = Array.from(
    new Set(servants.map((servant: any) => String(servant.className).toLowerCase()))
  ).sort()

  const buffOptions = Array.from(
    new Set(
      servants.flatMap((servant: any) =>
        (servant.buffs ?? []).map((buff: string) => String(buff))
      )
    )
  ).sort()

  const debuffOptions = Array.from(
    new Set(
      servants.flatMap((servant: any) =>
        (servant.debuffs ?? []).map((debuff: string) => String(debuff))
      )
    )
  ).sort()

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
  ]

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
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-4 py-4">
      <h3 className="bg-primary px-3 py-2 text-primary-foreground">FGO Database</h3>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline">Advanced Filter</Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(92vw,72rem)] space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
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
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Active Filters</h3>
            <ScrollArea className="h-48 rounded-md border p-3">
              <div className="space-y-2">
                {activeFilters.map((filter) => (
                  <label
                    key={`${filter.key}-${filter.value}`}
                    className="flex cursor-pointer items-center gap-2 text-sm"
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
                  <p className="text-sm text-muted-foreground">
                    No active filters.
                  </p>
                ) : null}
              </div>
            </ScrollArea>
          </div>
          <Button variant="ghost" onClick={clearFilters}>
            Clear filters
          </Button>
        </PopoverContent>
      </Popover>

      <Button variant="ghost" onClick={() => router.push("/pages/about")}>
        Go to Test
      </Button>
    </div>
  )
}
