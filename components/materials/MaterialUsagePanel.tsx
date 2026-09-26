"use client"

import Image from "next/image"
import { RegionLink as Link } from "@/components/RegionLink"
import { ListChecks } from "lucide-react"
import { useMemo, useState } from "react"

import { useServants } from "@/app/contexts/HomePageContext"
import type { ItemUsageEntry } from "@/lib/atlas-types"
import { filterUsage, formatUsageBreakdown, type UsageFilter } from "@/lib/item-usage"
import { useCollectionIds } from "@/lib/use-collection-ids"
import { cn } from "@/lib/utils"

const FILTERS: { id: UsageFilter; label: string; icon?: React.ReactNode }[] = [
  { id: "all", label: "All" },
  { id: "tracked", label: "Tracked", icon: <ListChecks className="size-4" aria-hidden="true" /> },
]

const EMPTY_MESSAGE: Record<UsageFilter, string> = {
  all: "Not used for servant upgrades",
  tracked: "None of your tracked servants use this",
}

interface MaterialUsagePanelProps {
  usage: ItemUsageEntry[]
  status: "loading" | "ready" | "error"
  onRetry: () => void
}

export function MaterialUsagePanel({ usage, status, onRetry }: MaterialUsagePanelProps) {
  const { servants, servantsStatus } = useServants()
  const { trackedIds } = useCollectionIds()
  const [filter, setFilter] = useState<UsageFilter>("all")

  const servantById = useMemo(() => new Map(servants.map((servant) => [servant.id, servant])), [servants])
  // A Map key iterator is single-use, so each filterUsage call gets a fresh one.
  const byFilter = Object.fromEntries(
    FILTERS.map(({ id }) => [
      id,
      filterUsage(usage, id, { trackedIds, knownServantIds: servantById.keys() }),
    ])
  ) as Record<UsageFilter, ItemUsageEntry[]>
  const visible = byFilter[filter]

  if (status === "loading" || servantsStatus === "loading") return <div className="h-40 animate-pulse rounded-lg bg-card/60" />
  if (status === "error") {
    return (
      <p className="text-sm text-rose-300">
        Couldn&apos;t load item data.{" "}
        <button type="button" onClick={onRetry} className="underline underline-offset-4">
          Retry
        </button>
      </p>
    )
  }

  return (
    <div className="space-y-4 rounded-lg bg-card/60 p-4">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter servants">
        {FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={filter === option.id}
            onClick={() => setFilter(option.id)}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors",
              filter === option.id ? "bg-foreground text-background" : "bg-muted text-foreground/80 hover:bg-muted/70"
            )}
          >
            {option.icon}
            {option.label}
            <span className="tabular-nums opacity-70">{byFilter[option.id].length}</span>
          </button>
        ))}
      </div>

      {visible.length ? (
        <>
          <p className="text-sm text-muted-foreground">
            Used by {visible.length} servant{visible.length === 1 ? "" : "s"}
          </p>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-3">
            {visible.map((entry) => {
              const servant = servantById.get(entry.servantId)
              if (!servant) return null
              const label = `${servant.name}: ${formatUsageBreakdown(entry)}`
              return (
                <li key={entry.servantId}>
                  <Link
                    href={`/servantpage/${entry.servantId}#materials`}
                    title={label}
                    aria-label={label}
                    className="group relative block aspect-square overflow-hidden rounded-full border-2 border-transparent bg-muted transition hover:border-foreground/60"
                  >
                    {servant.portrait ? (
                      <Image src={servant.portrait} alt="" fill sizes="80px" className="object-cover" />
                    ) : null}
                    <span className="absolute inset-x-0 bottom-0 bg-background/80 py-0.5 text-center text-xs font-semibold tabular-nums">
                      ×{entry.total.toLocaleString("en-US")}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">{EMPTY_MESSAGE[filter]}</p>
      )}
    </div>
  )
}
