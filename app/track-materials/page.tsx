"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useMemo, useState } from "react"
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

interface MaterialIndexItem {
  id: number
  name: string
  icon: string
}

interface EfficiencyLookup {
  [materialId: number]: number
}

const NUMBER_FORMATTER = new Intl.NumberFormat("en-US")

function formatNumber(value: number) {
  return NUMBER_FORMATTER.format(Number.isFinite(value) ? value : 0)
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

function getTabHeader(activeTab: "tracker" | "materials" | "farming") {
  if (activeTab === "materials") return "Total Materials"
  if (activeTab === "farming") return "Farming Summary"
  return "Tracker"
}

export default function TrackMaterialsPage() {
  const router = useRouter()
  const [currentQpInput, setCurrentQpInput] = useState("0")

  const [activeTab, setActiveTab] = useState<"tracker" | "materials" | "farming">("tracker")
  const [trackerState, setTrackerState] = useState<TrackedMaterialsState>({
    version: 1,
    servants: [],
    ownedByMaterialId: {},
  })
  const [servantIndex, setServantIndex] = useState<ServantIndexItem[]>([])
  const [materialIndex, setMaterialIndex] = useState<MaterialIndexItem[]>([])
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [addingServantId, setAddingServantId] = useState<number | null>(null)
  const [isMaterialSearchOpen, setIsMaterialSearchOpen] = useState(false)
  const [materialSearchQuery, setMaterialSearchQuery] = useState("")
  const [pendingOwnedByMaterialId, setPendingOwnedByMaterialId] = useState<Record<number, string>>({})
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

    fetch("/api/atlas/materials-index", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        setMaterialIndex(Array.isArray(payload?.materials) ? payload.materials : [])
      })
      .catch(() => {
        setMaterialIndex([])
      })

    try {
      const raw = window.localStorage.getItem("trackerCurrentQp")
      const parsed = Number(raw ?? 0)
      const safeValue = Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0
      setCurrentQpInput(String(safeValue))
    } catch {
      setCurrentQpInput("0")
    }
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

  const aggregateByMaterialId = useMemo(() => {
    return new Map(aggregate.materialsWithOwned.map((material) => [material.id, material] as const))
  }, [aggregate.materialsWithOwned])

  const filteredMaterialResults = useMemo(() => {
    const query = materialSearchQuery.trim().toLowerCase()
    const base = materialIndex.length ? materialIndex : aggregate.materialsWithOwned
    if (!query) return base.slice(0, 100)

    return base
      .filter((material) => String(material.name ?? "").toLowerCase().includes(query))
      .slice(0, 100)
  }, [aggregate.materialsWithOwned, materialIndex, materialSearchQuery])

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

  const handleOpenMaterialSearch = () => {
    const defaults: Record<number, string> = {}
    const source = materialIndex.length ? materialIndex : aggregate.materialsWithOwned

    source.forEach((material) => {
      const owned = Number(trackerState.ownedByMaterialId[String(material.id)] ?? 0)
      defaults[material.id] = String(Math.max(0, Number.isFinite(owned) ? owned : 0))
    })
    setPendingOwnedByMaterialId(defaults)
    setMaterialSearchQuery("")
    setIsMaterialSearchOpen(true)
  }

  const handleSaveOwnedQuantity = (materialId: number) => {
    const raw = pendingOwnedByMaterialId[materialId] ?? "0"
    const parsed = Number(raw)
    const safeValue = Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0
    const nextState = materialTracker.setOwnedMaterialQuantity(materialId, safeValue)
    setTrackerState(nextState)
    setPendingOwnedByMaterialId((prev) => ({
      ...prev,
      [materialId]: String(safeValue),
    }))
  }

  const handleCurrentQpChange = (value: string) => {
    if (value === "") {
      setCurrentQpInput("")
      try {
        window.localStorage.setItem("trackerCurrentQp", "0")
      } catch {
        // no-op
      }
      return
    }

    const parsed = Number(value)
    const safeValue = Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0
    setCurrentQpInput(String(safeValue))
    try {
      window.localStorage.setItem("trackerCurrentQp", String(safeValue))
    } catch {
      // no-op
    }
  }

  const currentQp = Number(currentQpInput === "" ? 0 : currentQpInput)

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline">
          <Link href="/">Back to Homepage</Link>
        </Button>
      </div>

      <header className="rounded-md border p-4">
        <h1 className="text-2xl font-semibold">{getTabHeader(activeTab)}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant={activeTab === "tracker" ? "default" : "outline"}
          onClick={() => setActiveTab("tracker")}
        >
          Tracker
        </Button>
        <Button
          type="button"
          variant={activeTab === "materials" ? "default" : "outline"}
          onClick={() => setActiveTab("materials")}
        >
          Total Materials
        </Button>
        <Button
          type="button"
          variant={activeTab === "farming" ? "default" : "outline"}
          onClick={() => setActiveTab("farming")}
        >
          Farming Summary
        </Button>
        <Button type="button" variant="outline" onClick={handleOpenMaterialSearch}>
          Set Material Inventory
        </Button>
        </div>
      </header>

      {activeTab === "tracker" ? (
        <>
          <div className="rounded-md border p-4">
            <p className="text-sm text-muted-foreground">
              Total tracked: {trackerState.servants.length} servant
              {trackerState.servants.length === 1 ? "" : "s"}
            </p>
            <p className="mt-1 text-sm">QP total needed: {formatNumber(aggregate.qp)}</p>
            <div className="mt-2 grid gap-2 sm:max-w-sm">
              <label className="space-y-1 text-xs text-muted-foreground">
                Current QP
                <Input
                  type="number"
                  min={0}
                  value={currentQpInput}
                  onChange={(event) => handleCurrentQpChange(event.target.value)}
                />
              </label>
              <p className="text-xs text-muted-foreground">
                Remaining QP needed: {formatNumber(Math.max(0, aggregate.qp - currentQp))}
              </p>
            </div>
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
                          Ascension {servant.ascensionLevel >= 5 ? "Max" : `Lv ${servant.ascensionLevel}`} · Skills {formatSkillLevels(servant.skillLevels)} · Append Skills {formatSkillLevels(servant.appendSkillLevels)}
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

          {isMaterialSearchOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-2xl space-y-4 rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Set Material Inventory</h2>
                  <Button type="button" variant="ghost" onClick={() => setIsMaterialSearchOpen(false)}>
                    Close
                  </Button>
                </div>
                <Input
                  placeholder="Search material name..."
                  value={materialSearchQuery}
                  onChange={(event) => setMaterialSearchQuery(event.target.value)}
                />
                <div className="max-h-[60vh] space-y-2 overflow-y-auto">
                  {filteredMaterialResults.map((material) => (
                    <div
                      key={material.id}
                      className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                    >
                      {(() => {
                        const aggregateMaterial = aggregateByMaterialId.get(material.id)
                        const neededAmount = Number(aggregateMaterial?.amount ?? 0)
                        const ownedAmount = Number(
                          trackerState.ownedByMaterialId[String(material.id)] ?? 0
                        )

                        return (
                          <>
                            <div className="flex min-w-0 items-center gap-2">
                              <Image
                                src={material.icon}
                                alt={material.name}
                                width={20}
                                height={20}
                                className="rounded-sm"
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{material.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  Needed {formatNumber(neededAmount)} · Owned {formatNumber(ownedAmount)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min={0}
                                value={pendingOwnedByMaterialId[material.id] ?? ""}
                                onChange={(event) =>
                                  setPendingOwnedByMaterialId((prev) => ({
                                    ...prev,
                                    [material.id]: event.target.value,
                                  }))
                                }
                                className="w-24"
                              />
                              <Button type="button" size="sm" onClick={() => handleSaveOwnedQuantity(material.id)}>
                                Save
                              </Button>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  ))}
                  {!filteredMaterialResults.length ? (
                    <p className="text-sm text-muted-foreground">No matching materials.</p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : activeTab === "materials" ? (
        <section className="rounded-md border p-4">
          <h2 className="text-lg font-semibold">Total Materials Needed</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Open a material to edit owned quantity, remaining count, and progress.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {aggregate.materialsWithOwned.map((material) => (
              <Link
                key={material.id}
                href={`/material/${material.id}?name=${encodeURIComponent(material.name)}&icon=${encodeURIComponent(material.icon)}&returnTo=${encodeURIComponent("/track-materials")}`}
                className="block rounded-md border p-2 transition hover:bg-muted/40"
              >
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
                  Needed {formatNumber(material.amount)} · Owned {formatNumber(material.owned)} · Remaining{" "}
                  {formatNumber(material.remaining)}
                </p>
              </Link>
            ))}
            {!aggregate.materialsWithOwned.length ? (
              <p className="text-sm text-muted-foreground">No materials needed yet.</p>
            ) : null}
          </div>
        </section>
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
                  Remaining: {formatNumber(material.remaining)}
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
