"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useMemo, useRef, useState } from "react"
import type { ChangeEvent } from "react"
import { useRouter } from "next/navigation"

import MaterialFarmingCard from "@/components/materials/MaterialFarmingCard"
import * as materialTracker from "@/lib/material-tracker"
import type { TrackedMaterialsState } from "@/lib/material-tracker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface ServantIndexItem {
  id: number
  name: string
  className: string
  rarity: number
  portrait: string
}

interface EfficiencyLookup {
  [materialId: number]: number
}

function getStarColorClass(rarity: number) {
  if (rarity <= 2) return "text-amber-700"
  if (rarity === 3) return "text-slate-400"
  return "text-yellow-500"
}

function moveBefore(ids: number[], draggedId: number, targetId: number) {
  if (draggedId === targetId) return ids

  const next = [...ids]
  const draggedIndex = next.indexOf(draggedId)
  const targetIndex = next.indexOf(targetId)
  if (draggedIndex < 0 || targetIndex < 0) return ids

  next.splice(draggedIndex, 1)
  next.splice(targetIndex, 0, draggedId)
  return next
}

function formatSkillLevels(levels: [number, number, number]) {
  return `${levels[0]}/${levels[1]}/${levels[2]}`
}

export default function TrackMaterialsPage() {
  const router = useRouter()
  const importInputRef = useRef<HTMLInputElement | null>(null)

  const [activeTab, setActiveTab] = useState<"tracker" | "farming">("tracker")
  const [trackerState, setTrackerState] = useState<TrackedMaterialsState>({
    version: 1,
    servants: [],
    ownedByMaterialId: {},
  })
  const [servantIndex, setServantIndex] = useState<ServantIndexItem[]>([])
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [addingServantId, setAddingServantId] = useState<number | null>(null)
  const [draggedServantId, setDraggedServantId] = useState<number | null>(null)
  const [efficiencyByMaterialId, setEfficiencyByMaterialId] = useState<EfficiencyLookup>({})

  useEffect(() => {
    setTrackerState(materialTracker.readTrackedMaterialsState())

    fetch("/api/atlas/servants-index", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        setServantIndex(Array.isArray(payload?.servants) ? payload.servants : [])
      })
      .catch(() => {
        setServantIndex([])
      })
  }, [])

  const aggregate = useMemo(
    () => materialTracker.calculateAggregateRequirements(trackerState),
    [trackerState]
  )

  const trackedServantIds = useMemo(
    () => new Set(trackerState.servants.map((entry) => entry.servantId)),
    [trackerState.servants]
  )

  const filteredSearchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const base = servantIndex.filter((item) => !trackedServantIds.has(Number(item.id)))

    if (!query) return base.slice(0, 40)

    return base
      .filter((item) => {
        const name = String(item.name ?? "").toLowerCase()
        const className = String(item.className ?? "").toLowerCase()
        return name.includes(query) || className.includes(query)
      })
      .slice(0, 40)
  }, [searchQuery, servantIndex, trackedServantIds])

  const incompleteMaterials = useMemo(
    () => aggregate.materialsWithOwned.filter((material) => material.remaining > 0),
    [aggregate.materialsWithOwned]
  )

  useEffect(() => {
    if (activeTab !== "farming" || !incompleteMaterials.length) return

    let cancelled = false
    Promise.all(
      incompleteMaterials.map(async (material) => {
        try {
          const response = await fetch(
            `/api/atlas/material-farming?itemId=${material.id}&limit=1`,
            { cache: "no-store" }
          )
          const payload = await response.json()
          const node = Array.isArray(payload?.nodes) ? payload.nodes[0] : null
          return [material.id, Number(node?.apPerDrop ?? Number.POSITIVE_INFINITY)] as const
        } catch {
          return [material.id, Number.POSITIVE_INFINITY] as const
        }
      })
    ).then((entries) => {
      if (cancelled) return
      setEfficiencyByMaterialId(Object.fromEntries(entries))
    })

    return () => {
      cancelled = true
    }
  }, [activeTab, incompleteMaterials])

  const farmingSortedMaterials = useMemo(() => {
    return [...incompleteMaterials].sort((a, b) => {
      const apA = Number(efficiencyByMaterialId[a.id] ?? Number.POSITIVE_INFINITY)
      const apB = Number(efficiencyByMaterialId[b.id] ?? Number.POSITIVE_INFINITY)
      if (apA !== apB) return apA - apB
      return b.remaining - a.remaining
    })
  }, [efficiencyByMaterialId, incompleteMaterials])

  const handleAddServant = async (servant: ServantIndexItem) => {
    setAddingServantId(servant.id)
    try {
      const response = await fetch(`/api/atlas/servant/${servant.id}`, {
        cache: "no-store",
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load servant")
      }

      const nextState = materialTracker.upsertTrackedServant({
        servantId: Number(payload.id),
        servantName: String(payload.name ?? servant.name),
        className: String(payload.className ?? servant.className),
        rarity: Number(payload.rarity ?? servant.rarity),
        portrait: String(payload.portrait ?? servant.portrait ?? ""),
        ascensionLevel: 5,
        skillLevels: [10, 10, 10],
        appendSkillLevels: [0, 0, 0],
        ascensionMaterials: payload.ascensionMaterials ?? {},
        skillMaterials: payload.skillMaterials ?? {},
        appendSkillMaterials: payload.appendSkillMaterials ?? {},
      })
      setTrackerState(nextState)
    } catch {
      // no-op
    } finally {
      setAddingServantId(null)
    }
  }

  const handleRemoveServant = (servantId: number) => {
    const nextState = materialTracker.removeTrackedServant(servantId)
    setTrackerState(nextState)
  }

  const handleExport = () => {
    const payload = materialTracker.exportTrackedMaterialsState()
    const blob = new Blob([payload], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "tracked-materials.json"
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleImportClick = () => {
    importInputRef.current?.click()
  }

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const nextState = materialTracker.importTrackedMaterialsState(text)
      setTrackerState(nextState)
    } catch {
      // no-op
    } finally {
      event.target.value = ""
    }
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline">
          <Link href="/">Back to Homepage</Link>
        </Button>
        <Button
          type="button"
          variant={activeTab === "tracker" ? "default" : "outline"}
          onClick={() => setActiveTab("tracker")}
        >
          Tracker
        </Button>
        <Button
          type="button"
          variant={activeTab === "farming" ? "default" : "outline"}
          onClick={() => setActiveTab("farming")}
        >
          Farming Summary
        </Button>
      </div>

      {activeTab === "tracker" ? (
        <>
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={() => setIsSearchOpen(true)}>
              Add Servant
            </Button>
            <Button type="button" variant="outline" onClick={handleExport}>
              Export JSON
            </Button>
            <Button type="button" variant="outline" onClick={handleImportClick}>
              Import JSON
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={handleImportFile}
            />
          </div>

          <div className="rounded-md border p-4">
            <p className="text-sm text-muted-foreground">
              Total tracked: {trackerState.servants.length} servant
              {trackerState.servants.length === 1 ? "" : "s"}
            </p>
            <p className="mt-1 text-sm">QP total needed: {aggregate.qp.toLocaleString()}</p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded bg-muted">
              <div
                className="h-full bg-sky-500"
                style={{ width: `${Math.min(100, Math.max(0, aggregate.progressPercent))}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Overall progress: {aggregate.progressPercent.toFixed(1)}%
            </p>
          </div>

          <div className="grid gap-4">
            {trackerState.servants.map((servant) => {
              const totals = materialTracker.calculateServantRequirements(
                servant,
                trackerState.ownedByMaterialId
              )
              const remainingCount = totals.materialsWithOwned.filter((item) => item.remaining > 0).length

              return (
                <article
                  key={servant.servantId}
                  draggable
                  onDragStart={() => setDraggedServantId(servant.servantId)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (!draggedServantId) return
                    const orderedIds = moveBefore(
                      trackerState.servants.map((entry) => entry.servantId),
                      draggedServantId,
                      servant.servantId
                    )
                    const nextState = materialTracker.reorderTrackedServants(orderedIds)
                    setTrackerState(nextState)
                    setDraggedServantId(null)
                  }}
                  onClick={() => router.push(`/track-materials/${servant.servantId}`)}
                  className="cursor-pointer rounded-md border p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {servant.portrait ? (
                        <Image
                          src={servant.portrait}
                          alt={servant.servantName}
                          width={56}
                          height={56}
                          className="rounded-md"
                        />
                      ) : null}
                      <div className="space-y-1">
                        <p className="font-semibold">{servant.servantName}</p>
                        <p className="text-sm text-muted-foreground">
                          {servant.className} ·{" "}
                          <span className={getStarColorClass(servant.rarity)}>
                            {"★".repeat(servant.rarity)}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Ascension {servant.ascensionLevel >= 5 ? "Max" : `Lv ${servant.ascensionLevel}`} · Skills {formatSkillLevels(servant.skillLevels)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation()
                          handleRemoveServant(servant.servantId)
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded bg-muted">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${Math.min(100, Math.max(0, totals.progressPercent))}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Progress: {totals.progressPercent.toFixed(1)}%</span>
                    <span>{remainingCount} material type{remainingCount === 1 ? "" : "s"} remaining</span>
                  </div>
                </article>
              )
            })}
            {!trackerState.servants.length ? (
              <p className="text-sm text-muted-foreground">No tracked servants yet.</p>
            ) : null}
          </div>

          <section className="rounded-md border p-4">
            <h2 className="text-lg font-semibold">Total Materials Needed</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {aggregate.materialsWithOwned.map((material) => (
                <div key={material.id} className="rounded-md border p-2">
                  <div className="flex items-center gap-2">
                    <Image
                      src={material.icon}
                      alt={material.name}
                      width={24}
                      height={24}
                      className="rounded-sm"
                    />
                    <p className="text-sm font-medium">{material.name}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Needed {material.amount.toLocaleString()} · Owned {material.owned.toLocaleString()} · Remaining{" "}
                    {material.remaining.toLocaleString()}
                  </p>
                </div>
              ))}
              {!aggregate.materialsWithOwned.length ? (
                <p className="text-sm text-muted-foreground">No materials needed yet.</p>
              ) : null}
            </div>
          </section>

          {isSearchOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-2xl space-y-4 rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Add Servant</h2>
                  <Button type="button" variant="ghost" onClick={() => setIsSearchOpen(false)}>
                    Close
                  </Button>
                </div>
                <Input
                  placeholder="Search by servant name or class..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
                <div className="max-h-[50vh] space-y-2 overflow-y-auto">
                  {filteredSearchResults.map((servant) => (
                    <button
                      key={servant.id}
                      type="button"
                      className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left"
                      onClick={() => handleAddServant(servant)}
                      disabled={addingServantId === servant.id}
                    >
                      <span>
                        {servant.name} · {servant.className}
                      </span>
                      <span className={getStarColorClass(servant.rarity)}>{"★".repeat(servant.rarity)}</span>
                    </button>
                  ))}
                  {!filteredSearchResults.length ? (
                    <p className="text-sm text-muted-foreground">No matching servants.</p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <section className="space-y-4">
          <h1 className="text-2xl font-semibold">Farming Summary</h1>
          <p className="text-sm text-muted-foreground">
            Incomplete materials across all tracked servants sorted by best AP/drop.
          </p>
          {farmingSortedMaterials.map((material) => (
            <div key={material.id} className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Image
                    src={material.icon}
                    alt={material.name}
                    width={24}
                    height={24}
                    className="rounded-sm"
                  />
                  <p className="font-medium">{material.name}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Remaining: {material.remaining.toLocaleString()}
                </p>
              </div>
              <MaterialFarmingCard
                itemId={material.id}
                itemName={material.name}
                itemIcon={material.icon}
              />
            </div>
          ))}
          {!farmingSortedMaterials.length ? (
            <p className="text-sm text-muted-foreground">No incomplete materials.</p>
          ) : null}
        </section>
      )}
    </main>
  )
}
