"use client"

import type { FarmingNode } from "@/lib/atlas-types"
import { useItemFile } from "@/lib/use-item-file"

const LORE_ID = 6999

function getApPerDropColor(value: number) {
  if (value < 40) return "text-emerald-400"
  if (value <= 70) return "text-amber-300"
  return "text-rose-400"
}

function formatPercent(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "--"
  return `${(value * 100).toFixed(1)}%`
}

function formatApPerDrop(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "--"
  return `${value.toFixed(1)} AP/drop`
}

function sanitizeLabel(value: unknown) {
  const normalized = String(value ?? "").trim()
  if (!normalized) return ""
  if (/^[-‐‑‒–—―ー－\s]+$/u.test(normalized)) return ""
  return normalized
}

function getDisplayParts(node: FarmingNode) {
  const warName = sanitizeLabel(node.warName)
  const locationName = sanitizeLabel(node.locationName)
  const questTitle = sanitizeLabel(node.questTitle)

  if (questTitle || locationName || warName) {
    return { questTitle: questTitle || node.questName, locationName, warName }
  }

  const raw = String(node.questName ?? "").trim()
  const separatorIndex = raw.indexOf(" - ")
  if (separatorIndex < 0) return { questTitle: raw, locationName: "", warName: "" }

  return {
    locationName: sanitizeLabel(raw.slice(0, separatorIndex)),
    questTitle: sanitizeLabel(raw.slice(separatorIndex + 3)),
    warName: "",
  }
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={`sources-skeleton-${index}`} className="space-y-2">
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-3 w-full animate-pulse rounded bg-muted/70" />
        </div>
      ))}
    </div>
  )
}

interface MaterialSourcesListProps {
  itemId: number
  nodes: FarmingNode[]
  status: "loading" | "ready" | "error"
  onRetry: () => void
}

export function MaterialSourcesList({ itemId, nodes, status, onRetry }: MaterialSourcesListProps) {
  if (itemId === LORE_ID) {
    return (
      <p className="text-sm text-muted-foreground">
        Crystallized Lore is primarily obtained through Rare Prism exchange and Rank Up Quests.
      </p>
    )
  }
  if (status === "loading") return <LoadingSkeleton />
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
  if (!nodes.length) return <p className="text-sm text-muted-foreground">No known farming locations</p>

  return (
    <div className="space-y-4 rounded-lg bg-card/60 p-4">
      {nodes.map((node, index) => {
        const display = getDisplayParts(node)
        const locationLine = [display.locationName, display.warName].filter(Boolean).join(" - ")
        return (
          <div key={`${node.id}-${index}`} className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">{display.questTitle}</p>
                {locationLine ? <p className="text-xs text-muted-foreground">{locationLine}</p> : null}
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p>AP {node.apCost}</p>
                <p>{formatPercent(node.dropRate)}</p>
                <p className={getApPerDropColor(node.apPerDrop)}>{formatApPerDrop(node.apPerDrop)}</p>
              </div>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded bg-muted">
              <div
                className="h-full rounded bg-sky-400"
                style={{ width: `${Math.min(Math.max(Number.isFinite(node.dropRate) ? node.dropRate * 100 : 0, 0), 100)}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Self-loading variant for places that only know the item id (Planning page farming rows).
export function ItemSources({ itemId }: { itemId: number }) {
  const { nodes, status, retry } = useItemFile(itemId)
  return <MaterialSourcesList itemId={itemId} nodes={nodes} status={status} onRetry={retry} />
}
