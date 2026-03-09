"use client"

import Link from "next/link"
import Image from "next/image"
import type { ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Boxes, Heart, Home, Pickaxe, Users } from "lucide-react"

import { HEADER_ACTION_BUTTON_CLASS, HeaderActionLink } from "@/components/HeaderActionLink"
import MaterialFarmingCard from "@/components/materials/MaterialFarmingCard"
import { PageHeader } from "@/components/PageHeader"
import * as materialTracker from "@/lib/material-tracker"
import type { TrackedMaterialsState } from "@/lib/material-tracker"
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
  return "text-yellow-400"
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

// ─── Tab bar ─────────────────────────────────────────────────────────────────

function TabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: string; icon?: ReactNode }[]
  active: string
  onChange: (key: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-all ${
            active === tab.key
              ? "border-border bg-secondary text-secondary-foreground"
              : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  )
}

// ─── Modal shell ─────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-xl border border-white/10 bg-[#0f0d12] shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <h2 className="text-sm font-semibold text-white/90">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-white/30 hover:text-white/70 transition-colors"
          >
            <svg viewBox="0 0 14 14" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
              <path d="M1 1l12 12M13 1L1 13" />
            </svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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
  const [expandedFarmingMaterialIds, setExpandedFarmingMaterialIds] = useState<number[]>([])

  useEffect(() => {
    setTrackerState(materialTracker.readTrackedMaterialsState())
    fetch("/api/atlas/servants-index", { cache: "no-store" })
      .then((r) => r.json())
      .then((p) => setServantIndex(Array.isArray(p?.servants) ? p.servants : []))
      .catch(() => setServantIndex([]))
    fetch("/api/atlas/materials-index", { cache: "no-store" })
      .then((r) => r.json())
      .then((p) => setMaterialIndex(Array.isArray(p?.materials) ? p.materials : []))
      .catch(() => setMaterialIndex([]))
    try {
      const raw = window.localStorage.getItem("trackerCurrentQp")
      const parsed = Number(raw ?? 0)
      setCurrentQpInput(String(Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0))
    } catch {
      setCurrentQpInput("0")
    }
  }, [])

  const aggregate = useMemo(() => materialTracker.calculateAggregateRequirements(trackerState), [trackerState])
  const trackedServantIds = useMemo(() => new Set(trackerState.servants.map((e) => e.servantId)), [trackerState.servants])

  const filteredSearchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const base = servantIndex.filter((item) => !trackedServantIds.has(Number(item.id)))
    if (!query) return base.slice(0, 40)
    return base.filter((item) =>
      String(item.name ?? "").toLowerCase().includes(query) ||
      String(item.className ?? "").toLowerCase().includes(query)
    ).slice(0, 40)
  }, [searchQuery, servantIndex, trackedServantIds])

  const incompleteMaterials = useMemo(
    () => aggregate.materialsWithOwned.filter((m) => m.remaining > 0),
    [aggregate.materialsWithOwned]
  )
  const aggregateByMaterialId = useMemo(
    () => new Map(aggregate.materialsWithOwned.map((m) => [m.id, m] as const)),
    [aggregate.materialsWithOwned]
  )
  const filteredMaterialResults = useMemo(() => {
    const query = materialSearchQuery.trim().toLowerCase()
    const base = materialIndex.length ? materialIndex : aggregate.materialsWithOwned
    if (!query) return base.slice(0, 100)
    return base.filter((m) => String(m.name ?? "").toLowerCase().includes(query)).slice(0, 100)
  }, [aggregate.materialsWithOwned, materialIndex, materialSearchQuery])

  useEffect(() => {
    if (activeTab !== "farming" || !incompleteMaterials.length) return
    let cancelled = false
    Promise.all(
      incompleteMaterials.map(async (material) => {
        try {
          const r = await fetch(`/api/atlas/material-farming?itemId=${material.id}&limit=1`, { cache: "no-store" })
          const p = await r.json()
          const node = Array.isArray(p?.nodes) ? p.nodes[0] : null
          return [material.id, Number(node?.apPerDrop ?? Infinity)] as const
        } catch {
          return [material.id, Infinity] as const
        }
      })
    ).then((entries) => { if (!cancelled) setEfficiencyByMaterialId(Object.fromEntries(entries)) })
    return () => { cancelled = true }
  }, [activeTab, incompleteMaterials])

  const farmingSortedMaterials = useMemo(() => {
    return [...incompleteMaterials].sort((a, b) => {
      const apA = Number(efficiencyByMaterialId[a.id] ?? Infinity)
      const apB = Number(efficiencyByMaterialId[b.id] ?? Infinity)
      return apA !== apB ? apA - apB : b.remaining - a.remaining
    })
  }, [efficiencyByMaterialId, incompleteMaterials])

  const handleAddServant = async (servant: ServantIndexItem) => {
    setAddingServantId(servant.id)
    try {
      const r = await fetch(`/api/atlas/servant/${servant.id}`, { cache: "no-store" })
      const payload = await r.json()
      if (!r.ok) throw new Error(payload?.error || "Failed to load servant")
      setTrackerState(materialTracker.upsertTrackedServant({
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
      }))
    } catch { /* no-op */ } finally { setAddingServantId(null) }
  }

  const handleRemoveServant = (servantId: number) => setTrackerState(materialTracker.removeTrackedServant(servantId))

  const handleSaveOwnedQuantity = (materialId: number) => {
    const raw = pendingOwnedByMaterialId[materialId] ?? String(trackerState.ownedByMaterialId[String(materialId)] ?? 0)
    const safeValue = Math.max(0, Math.floor(Number.isFinite(Number(raw)) ? Number(raw) : 0))
    setTrackerState(materialTracker.setOwnedMaterialQuantity(materialId, safeValue))
    setPendingOwnedByMaterialId((prev) => ({ ...prev, [materialId]: String(safeValue) }))
  }

  const handleCurrentQpChange = (value: string) => {
    if (value === "") { setCurrentQpInput(""); try { window.localStorage.setItem("trackerCurrentQp", "0") } catch {} return }
    const safeValue = Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0
    setCurrentQpInput(String(safeValue))
    try { window.localStorage.setItem("trackerCurrentQp", String(safeValue)) } catch {}
  }

  const currentQp = Number(currentQpInput === "" ? 0 : currentQpInput)
  const overallProgress = Math.min(100, Math.max(0, aggregate.progressPercent))

  return (
    <main className="min-h-screen bg-background pb-16" suppressHydrationWarning>
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-br from-amber-950/10 via-transparent to-violet-950/10" />

      <div className="sticky top-0 z-40 isolate">
        <PageHeader
          sticky={false}
          title="Material Tracker"
          subtitle={`${trackerState.servants.length} servant${trackerState.servants.length === 1 ? "" : "s"} tracked`}
          actions={
            <>
              <HeaderActionLink href="/" icon={<Home className="size-3.5" />} label="Home" />
              <HeaderActionLink href="/favorites" icon={<Heart className="size-3.5" />} label="Favorites" />
            </>
          }
        />

        <div className="border-b border-border bg-background shadow-sm">
          <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-5 py-3 md:px-8">
            <TabBar
              tabs={[
                { key: "tracker", label: "Servants", icon: <Users className="size-3.5" /> },
                { key: "materials", label: "Total Materials", icon: <Boxes className="size-3.5" /> },
                { key: "farming", label: "Farming Summary", icon: <Pickaxe className="size-3.5" /> },
              ]}
              active={activeTab}
              onChange={(k) => setActiveTab(k as typeof activeTab)}
            />
            <button
              type="button"
              onClick={() => { setPendingOwnedByMaterialId({}); setMaterialSearchQuery(""); setIsMaterialSearchOpen(true) }}
              className={HEADER_ACTION_BUTTON_CLASS}
            >
              <svg className="size-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v10M3 8h10" />
              </svg>
              Set Inventory
            </button>
          </div>
        </div>
      </div>

      <div className="relative z-0 mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 pt-6 md:px-8">

        {/* ── TRACKER TAB ─────────────────────────────────────────────────── */}
        {activeTab === "tracker" && (
          <>
            {/* Summary card */}
            <section className="rounded-xl border border-white/8 bg-white/[0.025] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Total QP Needed</p>
                  <p className="mt-1 text-2xl font-semibold text-white/90">{formatNumber(aggregate.qp)}</p>
                </div>
                <div className="w-full sm:w-48">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">
                    Current QP
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={currentQpInput}
                    onChange={(e) => handleCurrentQpChange(e.target.value)}
                    className="w-full rounded-md border border-white/10 bg-white/5 px-2.5 py-2 text-sm text-white/80 focus:border-white/20 focus:outline-none"
                  />
                  <p className="mt-1.5 text-xs text-white/30">
                    Remaining: <span className="text-white/55">{formatNumber(Math.max(0, aggregate.qp - currentQp))}</span>
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Overall Progress</span>
                  <span className="text-xs font-medium text-white/50">{overallProgress.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
                  <div className="h-full rounded-full bg-sky-500 transition-all duration-500" style={{ width: `${overallProgress}%` }} />
                </div>
              </div>
            </section>

            {/* Add servant button */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/30">
                {trackerState.servants.length} servant{trackerState.servants.length === 1 ? "" : "s"} · drag to reorder
              </p>
              <button
                type="button"
                onClick={() => { setSearchQuery(""); setIsSearchOpen(true) }}
                className="flex h-8 items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 text-xs font-medium text-amber-400 hover:border-amber-500/50 hover:bg-amber-500/15 transition-all"
              >
                <svg className="size-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <path d="M8 3v10M3 8h10" />
                </svg>
                Add Servant
              </button>
            </div>

            {/* Servant list */}
            <div className="grid gap-4">
              {trackerState.servants.map((servant) => {
                const totals = materialTracker.calculateServantRequirements(servant, trackerState.ownedByMaterialId)
                const remainingCount = totals.materialsWithOwned.filter((item) => item.remaining > 0).length
                const progress = Math.min(100, Math.max(0, totals.progressPercent))

                return (
                  <article
                    key={servant.servantId}
                    draggable
                    onDragStart={() => setDraggedServantId(servant.servantId)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (!draggedServantId) return
                      const nextState = materialTracker.reorderTrackedServants(
                        moveBefore(trackerState.servants.map((e) => e.servantId), draggedServantId, servant.servantId)
                      )
                      setTrackerState(nextState)
                      setDraggedServantId(null)
                    }}
                    onClick={() => router.push(`/track-materials/${servant.servantId}`)}
                    className="group cursor-pointer rounded-xl border border-white/8 bg-white/[0.025] p-5 transition-all hover:border-white/15 hover:bg-white/[0.04]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-4">
                        {servant.portrait && (
                          <Image src={servant.portrait} alt={servant.servantName} width={64} height={64} className="rounded-lg border border-white/10" />
                        )}
                        <div>
                          <p className="text-base font-semibold text-white/90">{servant.servantName}</p>
                          <p className="mt-1 text-sm text-white/40">
                            {servant.className}{" "}
                            <span className={getStarColorClass(servant.rarity)}>{"★".repeat(servant.rarity)}</span>
                          </p>
                          <p className="mt-1.5 text-xs text-white/25">
                            Asc {servant.ascensionLevel >= 5 ? "Max" : servant.ascensionLevel} · Skills {formatSkillLevels(servant.skillLevels)} · Append {formatSkillLevels(servant.appendSkillLevels)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleRemoveServant(servant.servantId) }}
                        className="rounded-md border border-white/8 bg-transparent px-2.5 py-1.5 text-[11px] text-white/30 opacity-0 transition-all group-hover:opacity-100 hover:border-red-500/30 hover:text-red-400"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="mt-4">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
                        <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${progress}%` }} />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-white/25">
                        <span>{progress.toFixed(1)}% complete</span>
                        <span>{remainingCount} material type{remainingCount === 1 ? "" : "s"} remaining</span>
                      </div>
                    </div>
                  </article>
                )
              })}
              {!trackerState.servants.length && (
                <div className="rounded-xl border border-dashed border-white/10 p-10 text-center">
                  <p className="text-sm text-white/25">No servants tracked yet.</p>
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(""); setIsSearchOpen(true) }}
                    className="mt-3 text-xs text-amber-400/70 hover:text-amber-400 transition-colors underline underline-offset-2"
                  >
                    Add your first servant
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── MATERIALS TAB ───────────────────────────────────────────────── */}
        {activeTab === "materials" && (
          <section className="rounded-xl border border-white/8 bg-white/[0.025] p-5">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-white/90">Total Materials Needed</h2>
              <p className="mt-0.5 text-xs text-white/30">Click a material to view details and edit owned quantity.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {aggregate.materialsWithOwned.map((material) => (
                <Link
                  key={material.id}
                  href={`/material/${material.id}?name=${encodeURIComponent(material.name)}&icon=${encodeURIComponent(material.icon)}&returnTo=${encodeURIComponent("/track-materials")}`}
                  className="group flex items-center gap-3 rounded-lg border border-white/8 bg-black/20 p-3 transition-all hover:border-white/15 hover:bg-white/5"
                >
                  <Image src={material.icon} alt={material.name} width={28} height={28} className="rounded-md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-white/80">{material.name}</p>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-white/30">
                      <span>Need <span className="text-white/50">{formatNumber(material.amount)}</span></span>
                      <span>·</span>
                      <span className={material.remaining > 0 ? "text-red-400/60" : "text-emerald-400/60"}>
                        {material.remaining > 0 ? `${formatNumber(material.remaining)} left` : "Complete"}
                      </span>
                    </div>
                  </div>
                  <svg className="size-3.5 flex-shrink-0 text-white/15 group-hover:text-white/40 transition-colors" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 4l4 4-4 4" />
                  </svg>
                </Link>
              ))}
              {!aggregate.materialsWithOwned.length && (
                <p className="col-span-3 text-sm text-white/25">No materials needed yet.</p>
              )}
            </div>
          </section>
        )}

        {/* ── FARMING TAB ─────────────────────────────────────────────────── */}
        {activeTab === "farming" && (
          <section>
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-white/90">Farming Summary</h2>
              <p className="mt-0.5 text-xs text-white/30">Incomplete materials sorted by best AP/drop efficiency.</p>
            </div>
            <div className="overflow-hidden rounded-xl border border-white/8">
              {/* Table head */}
              <div className="hidden grid-cols-[minmax(0,1fr)_120px_120px_100px] gap-3 border-b border-white/8 bg-white/[0.03] px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/25 sm:grid">
                <p>Material</p>
                <p className="text-right">Remaining</p>
                <p className="text-right">AP / Drop</p>
                <p className="text-right">Details</p>
              </div>
              <div className="divide-y divide-white/5">
                {farmingSortedMaterials.map((material) => {
                  const bestAp = Number(efficiencyByMaterialId[material.id] ?? Infinity)
                  const isExpanded = expandedFarmingMaterialIds.includes(material.id)

                  return (
                    <article key={material.id} className="space-y-3 p-4">
                      <div className="grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_120px_120px_100px]">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Image src={material.icon} alt={material.name} width={26} height={26} className="rounded-md" />
                          <p className="truncate text-sm font-medium text-white/80">{material.name}</p>
                        </div>
                        <p className="text-xs text-white/40 sm:text-right">{formatNumber(material.remaining)}</p>
                        <p className="text-xs text-white/40 sm:text-right">
                          {Number.isFinite(bestAp) ? bestAp.toFixed(1) : <span className="text-white/20">—</span>}
                        </p>
                        <div className="flex justify-start sm:justify-end">
                          <button
                            type="button"
                            onClick={() => setExpandedFarmingMaterialIds((cur) =>
                              cur.includes(material.id) ? cur.filter((id) => id !== material.id) : [...cur, material.id]
                            )}
                            className="rounded-md border border-white/10 bg-white/4 px-2.5 py-1 text-[11px] text-white/40 hover:border-white/20 hover:text-white/70 transition-all"
                          >
                            {isExpanded ? "Hide" : "Details"}
                          </button>
                        </div>
                      </div>
                      {isExpanded && (
                        <MaterialFarmingCard itemId={material.id} itemName={material.name} itemIcon={material.icon} />
                      )}
                    </article>
                  )
                })}
                {!farmingSortedMaterials.length && (
                  <p className="p-6 text-center text-sm text-white/25">No incomplete materials.</p>
                )}
              </div>
            </div>
          </section>
        )}
      </div>

      {/* ── Add Servant modal ───────────────────────────────────────────────── */}
      {isSearchOpen && (
        <Modal title="Add Servant" onClose={() => setIsSearchOpen(false)}>
          <input
            autoFocus
            placeholder="Search by name or class..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 placeholder:text-white/25 focus:border-white/20 focus:outline-none"
          />
          <div className="mt-3 max-h-[52vh] space-y-1 overflow-y-auto pr-1">
            {filteredSearchResults.map((servant) => (
              <button
                key={servant.id}
                type="button"
                onClick={() => handleAddServant(servant)}
                disabled={addingServantId === servant.id}
                className="flex w-full items-center justify-between rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2.5 text-left transition-all hover:border-white/15 hover:bg-white/5 disabled:opacity-50"
              >
                <div>
                  <p className="text-sm font-medium text-white/80">{servant.name}</p>
                  <p className="mt-0.5 text-xs text-white/30">{servant.className}</p>
                </div>
                <span className={`text-sm ${getStarColorClass(servant.rarity)}`}>{"★".repeat(servant.rarity)}</span>
              </button>
            ))}
            {!filteredSearchResults.length && (
              <p className="py-4 text-center text-sm text-white/25">No matching servants.</p>
            )}
          </div>
        </Modal>
      )}

      {/* ── Set Inventory modal ─────────────────────────────────────────────── */}
      {isMaterialSearchOpen && (
        <Modal title="Set Material Inventory" onClose={() => setIsMaterialSearchOpen(false)}>
          <input
            autoFocus
            placeholder="Search material name..."
            value={materialSearchQuery}
            onChange={(e) => setMaterialSearchQuery(e.target.value)}
            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 placeholder:text-white/25 focus:border-white/20 focus:outline-none"
          />
          <div className="mt-3 max-h-[58vh] space-y-1.5 overflow-y-auto pr-1">
            {filteredMaterialResults.map((material) => {
              const agg = aggregateByMaterialId.get(material.id)
              const neededAmount = Number(agg?.amount ?? 0)
              const ownedAmount = Number(trackerState.ownedByMaterialId[String(material.id)] ?? 0)

              return (
                <div key={material.id} className="flex items-center gap-3 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2.5">
                  <Image src={material.icon} alt={material.name} width={22} height={22} className="rounded-sm flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-white/80">{material.name}</p>
                    <p className="text-[10px] text-white/25">
                      Need {formatNumber(neededAmount)} · Owned {formatNumber(ownedAmount)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <input
                      type="number"
                      min={0}
                      value={pendingOwnedByMaterialId[material.id] ?? String(Math.max(0, ownedAmount))}
                      onChange={(e) => setPendingOwnedByMaterialId((prev) => ({ ...prev, [material.id]: e.target.value }))}
                      className="w-20 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white/80 focus:border-white/20 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveOwnedQuantity(material.id)}
                      className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-medium text-amber-400 hover:border-amber-500/50 hover:bg-amber-500/15 transition-all"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )
            })}
            {!filteredMaterialResults.length && (
              <p className="py-4 text-center text-sm text-white/25">No matching materials.</p>
            )}
          </div>
        </Modal>
      )}
    </main>
  )
}
