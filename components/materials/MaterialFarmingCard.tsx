"use client"

import Image from "next/image"
import { useEffect, useMemo, useState } from "react"
import * as materialTracker from "@/lib/material-tracker"

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
  showOwnershipControls?: boolean
  className?: string
}

const NUMBER_FORMATTER = new Intl.NumberFormat("en-US")

function formatNumber(value: number) {
  return NUMBER_FORMATTER.format(Number.isFinite(value) ? value : 0)
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
    return {
      questTitle: questTitle || node.questName,
      locationName,
      warName,
    }
  }

  const raw = String(node.questName ?? "").trim()
  const separatorIndex = raw.indexOf(" - ")
  if (separatorIndex < 0) {
    return { questTitle: raw, locationName: "", warName: "" }
  }

  return {
    locationName: sanitizeLabel(raw.slice(0, separatorIndex)),
    questTitle: sanitizeLabel(raw.slice(separatorIndex + 3)),
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
  showOwnershipControls = false,
  className,
}: MaterialFarmingCardProps) {
  const [isLoading, setIsLoading] = useState(itemId !== 6999)
  const [nodes, setNodes] = useState<FarmingNode[]>([])
  const [errorMessage, setErrorMessage] = useState("")
  const [ownedQuantity, setOwnedQuantity] = useState(0)
  const [totalRequiredQuantity, setTotalRequiredQuantity] = useState(0)

  const isQP = useMemo(() => itemName.trim().toLowerCase() === "qp", [itemName])
  const isLore = itemId === 6999

  useEffect(() => {
    if (!showOwnershipControls || !itemId) return

    const trackerState = materialTracker.readTrackedMaterialsState()
    const aggregate = materialTracker.calculateAggregateRequirements(trackerState)
    const material = aggregate.requiredMaterials.find((entry) => entry.id === itemId)
    const owned = Number(trackerState.ownedByMaterialId[String(itemId)] ?? 0)

    setOwnedQuantity(Number.isFinite(owned) ? Math.max(0, owned) : 0)
    setTotalRequiredQuantity(material?.amount ?? 0)
  }, [itemId, showOwnershipControls])

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
      cache: "force-cache",
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

  const remainingQuantity = Math.max(0, totalRequiredQuantity - ownedQuantity)
  const ownedProgress = totalRequiredQuantity > 0
    ? Math.min(100, (Math.max(0, ownedQuantity) / totalRequiredQuantity) * 100)
    : 0

  const handleOwnedChange = (nextValue: string) => {
    const parsed = Number(nextValue)
    const safeValue = Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0
    setOwnedQuantity(safeValue)
    materialTracker.setOwnedMaterialQuantity(itemId, safeValue)
  }

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
      {showOwnershipControls ? (
        <div className="mb-4 space-y-2 rounded-md border border-slate-700/70 p-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="space-y-1 text-xs text-slate-300">
              Owned quantity
              <input
                type="number"
                min={0}
                value={ownedQuantity}
                onChange={(event) => handleOwnedChange(event.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
              />
            </label>
            <div className="text-xs text-slate-300">
              <p>Total needed</p>
              <p className="text-sm font-medium text-slate-100">{formatNumber(totalRequiredQuantity)}</p>
            </div>
            <div className="text-xs text-slate-300">
              <p>Remaining</p>
              <p className="text-sm font-medium text-slate-100">{formatNumber(remainingQuantity)}</p>
            </div>
          </div>
          <div className="h-2 w-full overflow-hidden rounded bg-slate-700/80">
            <div className="h-full rounded bg-emerald-400" style={{ width: `${ownedProgress}%` }} />
          </div>
          <p className="text-[11px] text-slate-400">Progress: {ownedProgress.toFixed(1)}%</p>
        </div>
      ) : null}

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
        </div>
      ) : (
        <p className="text-sm text-slate-300">No farming data available</p>
      )}
    </section>
  )
}
