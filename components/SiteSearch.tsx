"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { Map as MapIcon, Search } from "lucide-react"
import { useId, useMemo, useRef, useState, type ReactNode } from "react"

import { useServants } from "@/app/contexts/HomePageContext"
import { Input } from "@/components/ui/input"
import type { MaterialIndexEntry } from "@/lib/atlas-types"
import { flattenSearchResults, searchAll } from "@/lib/global-search"
import { useFreeQuests } from "@/lib/use-free-quests"
import { useDataRegion } from "@/lib/data-region"
import { useStaticJson } from "@/lib/use-static-json"
import { cn } from "@/lib/utils"

interface SiteSearchProps {
  autoFocus?: boolean
  /** Render results in the normal flow (inside the mobile popover) instead of a dropdown. */
  inlineResults?: boolean
  onNavigate?: () => void
}

const NO_MATERIALS: MaterialIndexEntry[] = []
const GROUP_LABELS = { servant: "Servants", material: "Materials", quest: "Free Quests" } as const

// Navbar quick search across servants → materials → free quests (in that priority order),
// independent of the page filters.
export function SiteSearch({ autoFocus, inlineResults = false, onNavigate }: SiteSearchProps) {
  const router = useRouter()
  const { servants } = useServants()
  const { base, href } = useDataRegion()
  const { data: materials } = useStaticJson(`${base}/materials-index.json`, NO_MATERIALS)
  const { quests } = useFreeQuests()
  const listId = useId()
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const results = useMemo(
    () => flattenSearchResults(searchAll({ servants, materials, quests }, query)),
    [servants, materials, quests, query]
  )
  const showResults = (open || inlineResults) && query.trim().length > 0
  const optionId = (index: number) => `${listId}-${results[index].kind}-${results[index].key}`

  const hrefOf = (result: (typeof results)[number]) =>
    href(
      result.kind === "servant"
        ? `/servantpage/${result.key}`
        : result.kind === "material"
          ? `/material/${result.key}`
          : `/free-quests/${result.key}`
    )

  const goTo = (index: number) => {
    const result = results[index]
    if (!result) return
    setQuery("")
    setOpen(false)
    onNavigate?.()
    router.push(hrefOf(result))
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && results.length) {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((index) => (index + 1) % results.length)
    } else if (event.key === "ArrowUp" && results.length) {
      event.preventDefault()
      setActiveIndex((index) => (index - 1 + results.length) % results.length)
    } else if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault()
      goTo(activeIndex)
    } else if (event.key === "Escape") {
      setOpen(false)
    }
  }

  const renderRow = (index: number, icon: ReactNode, title: string, subtitle: ReactNode) => (
    <li
      key={optionId(index)}
      id={optionId(index)}
      role="option"
      aria-selected={index === activeIndex}
      onMouseEnter={() => setActiveIndex(index)}
      onClick={() => goTo(index)}
      className={cn("flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5", index === activeIndex && "bg-muted")}
    >
      <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-md bg-muted">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
      </span>
    </li>
  )

  return (
    <div className="relative w-full">
      <label className="relative block">
        <span className="sr-only">Search servants, materials and free quests</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus={autoFocus}
          role="combobox"
          aria-expanded={showResults}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showResults && results[activeIndex] ? optionId(activeIndex) : undefined}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActiveIndex(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          // Delay so a click on a result lands before the list unmounts.
          onBlur={() => {
            blurTimer.current = setTimeout(() => setOpen(false), 150)
          }}
          onKeyDown={onKeyDown}
          placeholder="Search servants, items, quests..."
          className="h-11 rounded-md pl-9"
        />
      </label>

      {showResults ? (
        <div
          className={cn(
            "overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground",
            inlineResults ? "mt-2 max-h-[60vh]" : "absolute right-0 top-full z-30 mt-2 max-h-[70vh] w-full min-w-80 shadow-xl"
          )}
          onMouseDown={() => {
            if (blurTimer.current) clearTimeout(blurTimer.current)
          }}
        >
          <ul id={listId} role="listbox" aria-label="Search results">
            {results.map((result, index) => {
              const header =
                index === 0 || results[index - 1].kind !== result.kind ? (
                  <li
                    key={`${result.kind}-header`}
                    role="presentation"
                    className="px-2 pb-1 pt-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground"
                  >
                    {GROUP_LABELS[result.kind]}
                  </li>
                ) : null

              let row: ReactNode
              if (result.kind === "servant") {
                const servant = result.item
                row = renderRow(
                  index,
                  servant.portrait ? <Image src={servant.portrait} alt="" fill sizes="40px" className="object-cover" /> : null,
                  servant.name,
                  <>
                    {servant.className} · <span className="text-yellow-500">{"★".repeat(servant.rarity)}</span>
                  </>
                )
              } else if (result.kind === "material") {
                const material = result.item
                row = renderRow(
                  index,
                  <Image src={material.icon} alt="" width={36} height={36} className="object-contain" />,
                  material.name,
                  material.category
                )
              } else {
                const quest = result.item
                row = renderRow(
                  index,
                  quest.spotImage ? (
                    <Image src={quest.spotImage} alt="" fill sizes="40px" className="object-contain object-bottom" />
                  ) : (
                    <MapIcon className="size-5 text-cyan-200" aria-hidden="true" />
                  ),
                  `${quest.spotName} · ${quest.name}`,
                  `${quest.apCost ?? "—"} AP · ${quest.warName.replace(/\s+/g, " ").trim()}`
                )
              }
              return [header, row]
            })}
            {!results.length && (
              <li className="px-3 py-4 text-center text-sm text-muted-foreground">No servants, materials or quests found</li>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
