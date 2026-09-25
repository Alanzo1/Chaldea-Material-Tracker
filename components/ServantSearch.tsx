"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { useId, useMemo, useRef, useState } from "react"

import { useServants } from "@/app/contexts/HomePageContext"
import { Input } from "@/components/ui/input"
import { searchServants } from "@/lib/servant-filters"
import { cn } from "@/lib/utils"

interface ServantSearchProps {
  autoFocus?: boolean
  /** Render results in the normal flow (inside the mobile popover) instead of a dropdown. */
  inlineResults?: boolean
  onNavigate?: () => void
}

// Navbar quick search: its own query and results popup, independent of the home grid filters.
export function ServantSearch({ autoFocus, inlineResults = false, onNavigate }: ServantSearchProps) {
  const router = useRouter()
  const { servants } = useServants()
  const listId = useId()
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const results = useMemo(() => searchServants(servants, query), [servants, query])
  const showResults = (open || inlineResults) && query.trim().length > 0

  const goTo = (servantId: number) => {
    setQuery("")
    setOpen(false)
    onNavigate?.()
    router.push(`/servantpage/${servantId}`)
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
      goTo(results[activeIndex].id)
    } else if (event.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div className="relative w-full">
      <label className="relative block">
        <span className="sr-only">Search servants</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus={autoFocus}
          role="combobox"
          aria-expanded={showResults}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showResults && results[activeIndex] ? `${listId}-${results[activeIndex].id}` : undefined}
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
          placeholder="Search servants..."
          className="h-11 rounded-md pl-9"
        />
      </label>

      {showResults ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Servant results"
          className={cn(
            "overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground",
            inlineResults
              ? "mt-2 max-h-[60vh]"
              : "absolute right-0 top-full z-30 mt-2 max-h-[70vh] w-full min-w-80 shadow-xl"
          )}
          onMouseDown={() => {
            if (blurTimer.current) clearTimeout(blurTimer.current)
          }}
        >
          {results.length ? (
            results.map((servant, index) => (
              <li
                key={servant.id}
                id={`${listId}-${servant.id}`}
                role="option"
                aria-selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => goTo(servant.id)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5",
                  index === activeIndex && "bg-muted"
                )}
              >
                <span className="relative size-10 shrink-0 overflow-hidden rounded-md bg-muted">
                  {servant.portrait ? (
                    <Image src={servant.portrait} alt="" fill sizes="40px" className="object-cover" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{servant.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {servant.className} · <span className="text-yellow-500">{"★".repeat(servant.rarity)}</span>
                  </span>
                </span>
              </li>
            ))
          ) : (
            <li className="px-3 py-4 text-center text-sm text-muted-foreground">No servants found</li>
          )}
        </ul>
      ) : null}
    </div>
  )
}
