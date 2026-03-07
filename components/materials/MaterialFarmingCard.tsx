"use client"

import Image from "next/image"
import { useEffect, useMemo, useState } from "react"

interface FarmingNode {
  id: number
  questName: string
  apCost: number
  dropRate: number
  apPerDrop: number
  warName?: string
  locationName?: string
  questTitle?: string
}

interface MaterialFarmingResponse {
  nodes?: FarmingNode[]
  error?: string
}

interface MaterialFarmingCardProps {
  itemId: number
  itemName: string
  itemIcon: string
  itemDescription?: string
  className?: string
}

function getContainerClassName(className?: string) {
  return `rounded-xl border border-slate-700/70 bg-slate-900/85 p-4 text-slate-100 shadow-sm ${className ?? ""}`.trim()
}

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

function getDisplayParts(node: FarmingNode) {
  if (node.questTitle || node.locationName || node.warName) {
    return {
      questTitle: node.questTitle?.trim() || node.questName,
      locationName: node.locationName?.trim() || "",
      warName: node.warName?.trim() || "",
    }
  }

  const raw = String(node.questName ?? "").trim()
  const separatorIndex = raw.indexOf(" - ")
  if (separatorIndex < 0) {
    return { questTitle: raw, locationName: "", warName: "" }
  }

  return {
    locationName: raw.slice(0, separatorIndex).trim(),
    questTitle: raw.slice(separatorIndex + 3).trim(),
    warName: "",
  }
}

function getLocationWarLine(node: FarmingNode, display: ReturnType<typeof getDisplayParts>) {
  if (display.locationName && display.warName) {
    return `${display.locationName} - ${display.warName}`
  }

  if (display.locationName) {
    return display.locationName
  }

  return ""
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={`material-skeleton-${index}`} className="space-y-2">
          <div className="h-4 w-3/4 animate-pulse rounded bg-slate-700/60" />
          <div className="h-3 w-full animate-pulse rounded bg-slate-800/70" />
        </div>
      ))}
    </div>
  )
}

export default function MaterialFarmingCard({
  itemId,
  itemName,
  itemIcon,
  itemDescription,
  className,
}: MaterialFarmingCardProps) {
  const [isLoading, setIsLoading] = useState(itemId !== 6999)
  const [nodes, setNodes] = useState<FarmingNode[]>([])
  const [errorMessage, setErrorMessage] = useState("")

  const isQP = useMemo(() => itemName.trim().toLowerCase() === "qp", [itemName])
  const isLore = itemId === 6999

  useEffect(() => {
    let cancelled = false

    if (isLore || isQP) {
      setIsLoading(false)
      setNodes([])
      setErrorMessage("")
      return () => {
        cancelled = true
      }
    }

    setIsLoading(true)
    setErrorMessage("")

    fetch(`/api/atlas/material-farming?itemId=${itemId}&limit=6`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = (await response.json()) as MaterialFarmingResponse

        if (!response.ok) {
          throw new Error(payload.error || "Failed to fetch farming data")
        }

        return payload
      })
      .then((payload) => {
        if (cancelled) return
        setNodes(Array.isArray(payload.nodes) ? payload.nodes : [])
      })
      .catch((error) => {
        if (cancelled) return
        setNodes([])
        setErrorMessage(error instanceof Error ? error.message : "Failed to fetch")
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [itemId, isLore, isQP])

  if (isQP) return null

  return (
    <section className={getContainerClassName(className)}>
      <header className="mb-4 flex items-center gap-3">
        {itemIcon ? (
          <Image
            src={itemIcon}
            alt={itemName}
            width={48}
            height={48}
            className="rounded-md border border-slate-700"
          />
        ) : (
          <div className="h-12 w-12 rounded-md border border-slate-700 bg-slate-800" />
        )}
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{itemName}</h2>
          {itemDescription ? (
            <p className="text-xs text-slate-300">{itemDescription}</p>
          ) : null}
        </div>
      </header>

      {isLore ? (
        <p className="text-sm text-slate-300">
          Crystallized Lore is primarily obtained through Rare Prism exchange and
          Rank Up Quests.
        </p>
      ) : isLoading ? (
        <LoadingSkeleton />
      ) : errorMessage ? (
        <p className="text-sm text-rose-300">{errorMessage}</p>
      ) : nodes.length ? (
        <div className="space-y-4">
          {nodes.map((node, index) => {
            const display = getDisplayParts(node)
            const locationWarLine = getLocationWarLine(node, display)
            return (
            <div key={`${node.id}-${index}`} className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-slate-100">{display.questTitle}</p>
                  {locationWarLine ? (
                    <p className="text-xs text-slate-300">{locationWarLine}</p>
                  ) : null}
                </div>
                <div className="text-right text-xs text-slate-300">
                  <p>AP {node.apCost}</p>
                  <p>{formatPercent(node.dropRate)}</p>
                  <p className={getApPerDropColor(node.apPerDrop)}>
                    {formatApPerDrop(node.apPerDrop)}
                  </p>
                </div>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded bg-slate-700/80">
                <div
                  className="h-full rounded bg-sky-400"
                  style={{
                    width: `${Math.min(
                      Math.max(Number.isFinite(node.dropRate) ? node.dropRate * 100 : 0, 0),
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>
            )
          })}
          {nodes[0]?.apPerDrop > 0 ? (
            <p className="text-xs text-slate-400">
              Best efficiency: {nodes[0].apPerDrop.toFixed(1)} AP per drop
            </p>
          ) : (
            <p className="text-xs text-slate-400">
              Training Grounds source listed; drop-rate sample data unavailable.
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-300">No farming data available</p>
      )}
    </section>
  )
}
